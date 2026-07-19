// cli.ts — interactive menu for the Sereno shielded remittance corridor.
//
// Usage:  node dist/cli.js [standalone|preview|testnet|preprod]   (default: testnet/preprod)
//
// Requires a local proof server on http://127.0.0.1:6300 and, for preprod,
// tNight from https://faucet.preprod.midnight.network/ (then DUST generation).

import { createInterface, type Interface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { webcrypto } from 'node:crypto';
import pino from 'pino';
import { Sereno } from 'sereno-contract';
import { StandaloneConfig, PreviewConfig, TestnetConfig, type Config } from './config.js';
import {
  buildWalletFromSeed,
  configureProviders,
  deploy,
  joinContract,
  shield,
  transfer,
  receiveNote,
  unshield,
  discloseToAuditor,
  displayLedgerState,
  getLedgerState,
  ownSerenoAddress,
} from './api.js';
import { SerenoPrivateStateId, type SerenoProviders, type DeployedSerenoContract } from './common-types.js';

const logger = pino({ level: 'info', transport: { target: 'pino-pretty', options: { colorize: true } } });

const toHex = (b: Uint8Array): string => Buffer.from(b).toString('hex');
const fromHex = (s: string): Uint8Array => Uint8Array.from(Buffer.from(s.trim().replace(/^0x/, ''), 'hex'));

const pickConfig = (): Config => {
  const net = process.argv[2] ?? 'testnet';
  switch (net) {
    case 'standalone':
      return new StandaloneConfig();
    case 'preview':
      return new PreviewConfig();
    case 'testnet':
    case 'preprod':
      return new TestnetConfig();
    default:
      throw new Error(`unknown network '${net}' (expected standalone | preview | testnet | preprod)`);
  }
};

const randomFieldScalar = (): bigint => {
  const bytes = webcrypto.getRandomValues(new Uint8Array(30));
  let x = 0n;
  for (const b of bytes) x = (x << 8n) | BigInt(b);
  return x;
};

const MENU = `
Sereno — shielded remittance corridor (private interior, accountable edges)
  1. Deploy a new Sereno contract
  2. Join an existing Sereno contract
  3. Shield (deposit — amount is public on entry)
  4. Transfer a note (private to public; ElGamal amount to auditor)
  5. Receive a note (register preimage sent to you off-band)
  6. Unshield (withdraw — amount is public on exit)
  7. Disclose a note to the auditor (audit request)
  8. Show public ledger state
  9. Show my private state (address + notes)
  0. Exit
`;

const listNotes = async (providers: SerenoProviders): Promise<void> => {
  const ps = await providers.privateStateProvider.get(SerenoPrivateStateId);
  if (ps == null || ps.notes.length === 0) {
    logger.info('No notes in local private state.');
    return;
  }
  logger.info(`My Sereno address (share with senders): ${toHex(ownSerenoAddress(ps))}`);
  ps.notes.forEach((n, i) => {
    logger.info(
      `  [${i}] amount=${n.amount.toString()} randomness=${toHex(n.randomness)} mtIndex=${n.mtIndex === null ? '?' : n.mtIndex.toString()}`,
    );
  });
};

const requireContract = (
  contract: DeployedSerenoContract | null,
  contractAddress: string | null,
): { contract: DeployedSerenoContract; contractAddress: string } => {
  if (contract == null || contractAddress == null) {
    throw new Error('No contract loaded — deploy (1) or join (2) first.');
  }
  return { contract, contractAddress };
};

const mainLoop = async (providers: SerenoProviders, rl: Interface): Promise<void> => {
  let contract: DeployedSerenoContract | null = null;
  let contractAddress: string | null = null;

  for (;;) {
    const choice = (await rl.question(`${MENU}\nChoice: `)).trim();
    try {
      switch (choice) {
        case '1': {
          const auditorSk = randomFieldScalar();
          logger.info(`AUDITOR SECRET (demo only — hand to the auditor persona): ${auditorSk.toString()}`);
          const deployed = await deploy(providers, auditorSk, logger);
          contract = deployed;
          contractAddress = deployed.deployTxData.public.contractAddress;
          logger.info(`Contract address: ${contractAddress}`);
          break;
        }
        case '2': {
          const addr = (await rl.question('Contract address: ')).trim();
          contract = await joinContract(providers, addr, logger);
          contractAddress = addr;
          break;
        }
        case '3': {
          const c = requireContract(contract, contractAddress);
          const amount = BigInt((await rl.question('Amount to shield (public): ')).trim());
          await shield(providers, c.contract, c.contractAddress, amount, logger);
          await listNotes(providers);
          break;
        }
        case '4': {
          const c = requireContract(contract, contractAddress);
          await listNotes(providers);
          const idx = Number((await rl.question('Index of the note to spend: ')).trim());
          const recipientPk = fromHex(await rl.question("Recipient's Sereno address (64 hex chars): "));
          const { outNote, outCommitment } = await transfer(
            providers,
            c.contract,
            c.contractAddress,
            idx,
            recipientPk,
            logger,
          );
          logger.info('Send this note preimage to the recipient OFF-BAND (it lets them spend the note):');
          logger.info(`  amount=${outNote.amount.toString()}`);
          logger.info(`  randomness=${toHex(outNote.randomness)}`);
          logger.info(`  mtIndex=${outNote.mtIndex === null ? '?' : outNote.mtIndex.toString()}`);
          logger.info(`  (commitment on-chain: ${toHex(outCommitment)})`);
          break;
        }
        case '5': {
          const amount = BigInt((await rl.question('Note amount: ')).trim());
          const randomness = fromHex(await rl.question('Note randomness (64 hex chars): '));
          const mtIndexStr = (await rl.question('Merkle index (blank if unknown): ')).trim();
          await receiveNote(providers, {
            amount,
            randomness,
            mtIndex: mtIndexStr === '' ? null : BigInt(mtIndexStr),
          });
          logger.info('Note registered in local private state.');
          await listNotes(providers);
          break;
        }
        case '6': {
          const c = requireContract(contract, contractAddress);
          await listNotes(providers);
          const idx = Number((await rl.question('Index of the note to unshield: ')).trim());
          await unshield(providers, c.contract, idx, logger);
          break;
        }
        case '7': {
          const c = requireContract(contract, contractAddress);
          await listNotes(providers);
          const idx = Number((await rl.question('Index of the note to disclose: ')).trim());
          const reqStr = (await rl.question('Audit request id (64 hex chars, blank = random): ')).trim();
          const auditRequestId = reqStr === '' ? webcrypto.getRandomValues(new Uint8Array(32)) : fromHex(reqStr);
          logger.info(`Audit request id: ${toHex(auditRequestId)}`);
          await discloseToAuditor(providers, c.contract, idx, auditRequestId, logger);
          break;
        }
        case '8': {
          const c = requireContract(contract, contractAddress);
          await displayLedgerState(providers, c.contractAddress, logger);
          break;
        }
        case '9': {
          await listNotes(providers);
          if (contractAddress != null) {
            const ledgerState = await getLedgerState(providers, contractAddress);
            if (ledgerState != null) {
              logger.info(`Pool TVL (public): ${ledgerState.totalValueLocked.toString()}`);
            }
          }
          break;
        }
        case '0':
          return;
        default:
          logger.warn(`Unknown choice: ${choice}`);
      }
    } catch (e) {
      logger.error(e instanceof Error ? e.message : String(e));
    }
  }
};

const main = async (): Promise<void> => {
  const config = pickConfig();
  logger.info(
    `Network: ${process.argv[2] ?? 'testnet'} | indexer: ${config.indexer} | proof server: ${config.proofServer}`,
  );

  const rl = createInterface({ input, output, terminal: true });
  try {
    const seedHex = (await rl.question('Wallet seed (64 hex chars; generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"): ')).trim();
    if (!/^[0-9a-fA-F]{64}$/.test(seedHex)) {
      throw new Error('Seed must be exactly 64 hex characters (32 bytes).');
    }
    const walletCtx = await buildWalletFromSeed(config, seedHex, logger);
    const providers = await configureProviders(walletCtx, config);
    await mainLoop(providers, rl);
  } finally {
    rl.close();
  }
  logger.info('Bye.');
  process.exit(0);
};

main().catch((e) => {
  logger.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
  process.exit(1);
});

void Sereno;
