// Non-interactive Sereno demo: wallet → deploy → shield → ledger state.
// Usage: node dist/demo.js [seedHex] [amount]
// Env: SERENO_SKIP_FUNDS=1 to continue without waiting for faucet (will fail on deploy).

import { webcrypto } from 'node:crypto';
import pino from 'pino';
import { TestnetConfig } from './config.js';
import {
  buildWalletFromSeed,
  configureProviders,
  deploy,
  shield,
  displayLedgerState,
  ownSerenoAddress,
  getLedgerState,
} from './api.js';
import { SerenoPrivateStateId } from './common-types.js';

const logger = pino({ level: 'info', transport: { target: 'pino-pretty', options: { colorize: true } } });

const randomFieldScalar = (): bigint => {
  const bytes = webcrypto.getRandomValues(new Uint8Array(30));
  let x = 0n;
  for (const b of bytes) x = (x << 8n) | BigInt(b);
  return x;
};

const main = async (): Promise<void> => {
  const seed = (process.argv[2] ?? '').trim();
  const amount = BigInt(process.argv[3] ?? '100');
  if (!/^[0-9a-fA-F]{64}$/.test(seed)) {
    throw new Error('Usage: node dist/demo.js <64-hex-seed> [amount]');
  }

  const config = new TestnetConfig();
  logger.info({ indexer: config.indexer, proofServer: config.proofServer }, 'Sereno demo → preprod');

  const walletCtx = await buildWalletFromSeed(config, seed, logger);
  const providers = await configureProviders(walletCtx, config);

  const auditorSk = randomFieldScalar();
  logger.info(`AUDITOR SECRET (demo): ${auditorSk.toString()}`);
  const contract = await deploy(providers, auditorSk, logger);
  const contractAddress = contract.deployTxData.public.contractAddress;
  logger.info(`Contract: ${contractAddress}`);

  await shield(providers, contract, contractAddress, amount, logger);

  const ps = await providers.privateStateProvider.get(SerenoPrivateStateId);
  if (ps) {
    const addr = ownSerenoAddress(ps);
    logger.info(`Sereno address: ${Buffer.from(addr).toString('hex')}`);
    logger.info(`Notes: ${ps.notes.length}`);
    for (const [i, n] of ps.notes.entries()) {
      logger.info(`  [${i}] amount=${n.amount} mtIndex=${n.mtIndex}`);
    }
  }

  await displayLedgerState(providers, contractAddress, logger);
  const ledger = await getLedgerState(providers, contractAddress);
  if (ledger) {
    logger.info(`TVL after shield: ${ledger.totalValueLocked.toString()}`);
  }

  logger.info('Demo complete: deploy + shield + ledger view OK');
  process.exit(0);
};

main().catch((e) => {
  logger.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
  process.exit(1);
});
