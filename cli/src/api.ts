// api.ts — providers, wallet bridge and contract operations for Sereno CLI.
// Wallet bootstrap is the literal pattern from example-counter counter-cli/src/api.ts.

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { webcrypto } from 'node:crypto';
import { Buffer } from 'node:buffer';
import * as Rx from 'rxjs';
import { WebSocket } from 'ws';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8';
import { type Logger } from 'pino';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js/contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { type FinalizedTxData, type MidnightProvider, type WalletProvider } from '@midnight-ntwrk/midnight-js/types';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { getNetworkId } from '@midnight-ntwrk/midnight-js/network-id';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  createKeystore,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  UnshieldedWallet,
  type UnshieldedKeystore,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import {
  MidnightBech32m,
  ShieldedAddress,
  ShieldedCoinPublicKey,
  ShieldedEncryptionPublicKey,
} from '@midnight-ntwrk/wallet-sdk-address-format';
import {
  Sereno,
  witnesses,
  createSerenoPrivateState,
  randomBytes32,
  type SerenoPrivateState,
  type SerenoNote,
} from 'sereno-contract';
import { type Config, contractConfig } from './config.js';
import {
  SerenoPrivateStateId,
  type SerenoCircuits,
  type SerenoProviders,
  type DeployedSerenoContract,
} from './common-types.js';

// GraphQL subscriptions need WebSocket in Node.
// @ts-expect-error wallet/apollo expect global WebSocket
globalThis.WebSocket = WebSocket;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(globalThis as any).crypto) (globalThis as any).crypto = webcrypto;

// ---------------------------------------------------------------------------
// Compiled contract
// ---------------------------------------------------------------------------

// Prefer withWitnesses when present (real witnesses). Fall back to vacant
// pipe + Contract(witnesses) shape if the installed compact-js is older.
const makeCompiled = () => {
  const base = CompiledContract.make('sereno', Sereno.Contract);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CC = CompiledContract as any;
  if (typeof CC.withWitnesses === 'function') {
    return base.pipe(CC.withWitnesses(witnesses), CC.withCompiledFileAssets(contractConfig.zkConfigPath));
  }
  return base.pipe(CC.withVacantWitnesses, CC.withCompiledFileAssets(contractConfig.zkConfigPath));
};

export const serenoCompiledContract = makeCompiled();

// ---------------------------------------------------------------------------
// Wallet context (literal counter types)
// ---------------------------------------------------------------------------

export interface WalletContext {
  wallet: WalletFacade;
  shieldedSecretKeys: ledger.ZswapSecretKeys;
  dustSecretKey: ledger.DustSecretKey;
  unshieldedKeystore: UnshieldedKeystore;
}

/**
 * Sign unshielded offers with the correct proof marker.
 * Work around wallet SDK bug: signRecipe hardcodes 'pre-proof'.
 * LOCAL helper — not an export of ledger-v8.
 */
const signTransactionIntents = (
  tx: { intents?: Map<number, any> },
  signFn: (payload: Uint8Array) => ledger.Signature,
  proofMarker: 'proof' | 'pre-proof',
): void => {
  if (!tx.intents || tx.intents.size === 0) return;

  for (const segment of tx.intents.keys()) {
    const intent = tx.intents.get(segment);
    if (!intent) continue;

    const cloned = ledger.Intent.deserialize<ledger.SignatureEnabled, ledger.Proofish, ledger.PreBinding>(
      'signature',
      proofMarker,
      'pre-binding',
      intent.serialize(),
    );

    const sigData = cloned.signatureData(segment);
    const signature = signFn(sigData);

    if (cloned.fallibleUnshieldedOffer) {
      const sigs = cloned.fallibleUnshieldedOffer.inputs.map(
        (_: ledger.UtxoSpend, i: number) => cloned.fallibleUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.fallibleUnshieldedOffer = cloned.fallibleUnshieldedOffer.addSignatures(sigs);
    }

    if (cloned.guaranteedUnshieldedOffer) {
      const sigs = cloned.guaranteedUnshieldedOffer.inputs.map(
        (_: ledger.UtxoSpend, i: number) => cloned.guaranteedUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.guaranteedUnshieldedOffer = cloned.guaranteedUnshieldedOffer.addSignatures(sigs);
    }

    tx.intents.set(segment, cloned);
  }
};

export const createWalletAndMidnightProvider = async (
  ctx: WalletContext,
): Promise<WalletProvider & MidnightProvider> => {
  const state = await Rx.firstValueFrom(ctx.wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  return {
    getCoinPublicKey() {
      return state.shielded.coinPublicKey.toHexString();
    },
    getEncryptionPublicKey() {
      return state.shielded.encryptionPublicKey.toHexString();
    },
    async balanceTx(tx, ttl?) {
      const recipe = await ctx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: ctx.shieldedSecretKeys, dustSecretKey: ctx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      const signFn = (payload: Uint8Array) => ctx.unshieldedKeystore.signData(payload);
      signTransactionIntents(recipe.baseTransaction, signFn, 'proof');
      if (recipe.balancingTransaction) {
        signTransactionIntents(recipe.balancingTransaction, signFn, 'pre-proof');
      }
      return ctx.wallet.finalizeRecipe(recipe);
    },
    submitTx(tx) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ctx.wallet.submitTransaction(tx) as any;
    },
  };
};

export const waitForSync = (wallet: WalletFacade) =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(5_000),
      Rx.filter((state) => state.isSynced),
    ),
  );

export const waitForFunds = (wallet: WalletFacade): Promise<bigint> =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(10_000),
      Rx.filter((state) => state.isSynced),
      Rx.map((s) => s.unshielded.balances[unshieldedToken().raw] ?? 0n),
      Rx.filter((balance) => balance > 0n),
    ),
  );

const buildShieldedConfig = ({ indexer, indexerWS, node, proofServer }: Config) => ({
  networkId: getNetworkId(),
  indexerClientConnection: {
    indexerHttpUrl: indexer,
    indexerWsUrl: indexerWS,
  },
  provingServerUrl: new URL(proofServer),
  relayURL: new URL(node.replace(/^http/, 'ws')),
});

const buildUnshieldedConfig = ({ indexer, indexerWS }: Config) => ({
  networkId: getNetworkId(),
  indexerClientConnection: {
    indexerHttpUrl: indexer,
    indexerWsUrl: indexerWS,
  },
  txHistoryStorage: new InMemoryTransactionHistoryStorage(),
});

const buildDustConfig = ({ indexer, indexerWS, node, proofServer }: Config) => ({
  networkId: getNetworkId(),
  costParameters: {
    additionalFeeOverhead: 300_000_000_000_000n,
    feeBlocksMargin: 5,
  },
  indexerClientConnection: {
    indexerHttpUrl: indexer,
    indexerWsUrl: indexerWS,
  },
  provingServerUrl: new URL(proofServer),
  relayURL: new URL(node.replace(/^http/, 'ws')),
});

const deriveKeysFromSeed = (seed: string) => {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hdWallet.type !== 'seedOk') {
    throw new Error('Failed to initialize HDWallet from seed');
  }

  const derivationResult = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);

  if (derivationResult.type !== 'keysDerived') {
    throw new Error('Failed to derive keys');
  }

  hdWallet.hdWallet.clear();
  return derivationResult.keys;
};

const formatBalance = (balance: bigint): string => balance.toLocaleString();

export const withStatus = async <T>(message: string, fn: () => Promise<T>): Promise<T> => {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r  ${frames[i++ % frames.length]} ${message}`);
  }, 80);
  try {
    const result = await fn();
    clearInterval(interval);
    process.stdout.write(`\r  ✓ ${message}\n`);
    return result;
  } catch (e) {
    clearInterval(interval);
    process.stdout.write(`\r  ✗ ${message}\n`);
    throw e;
  }
};

const registerForDustGeneration = async (
  wallet: WalletFacade,
  unshieldedKeystore: UnshieldedKeystore,
): Promise<void> => {
  const state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));

  if (state.dust.availableCoins.length > 0) {
    const dustBal = state.dust.balance(new Date());
    console.log(`  ✓ Dust tokens already available (${formatBalance(dustBal)} DUST)`);
    return;
  }

  const nightUtxos = state.unshielded.availableCoins.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coin: any) => coin.meta?.registeredForDustGeneration !== true,
  );
  if (nightUtxos.length === 0) {
    await withStatus('Waiting for dust tokens to generate', () =>
      Rx.firstValueFrom(
        wallet.state().pipe(
          Rx.throttleTime(5_000),
          Rx.filter((s) => s.isSynced),
          Rx.filter((s) => s.dust.balance(new Date()) > 0n),
        ),
      ),
    );
    return;
  }

  await withStatus(`Registering ${nightUtxos.length} NIGHT UTXO(s) for dust generation`, async () => {
    const recipe = await wallet.registerNightUtxosForDustGeneration(
      nightUtxos,
      unshieldedKeystore.getPublicKey(),
      (payload) => unshieldedKeystore.signData(payload),
    );
    const finalized = await wallet.finalizeRecipe(recipe);
    await wallet.submitTransaction(finalized);
  });

  await withStatus('Waiting for dust tokens to generate', () =>
    Rx.firstValueFrom(
      wallet.state().pipe(
        Rx.throttleTime(5_000),
        Rx.filter((s) => s.isSynced),
        Rx.filter((s) => s.dust.balance(new Date()) > 0n),
      ),
    ),
  );
};

const printWalletSummary = (state: any, unshieldedKeystore: UnshieldedKeystore) => {
  const networkId = getNetworkId();
  const unshieldedBalance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;

  const coinPubKey = ShieldedCoinPublicKey.fromHexString(state.shielded.coinPublicKey.toHexString());
  const encPubKey = ShieldedEncryptionPublicKey.fromHexString(state.shielded.encryptionPublicKey.toHexString());
  const shieldedAddress = MidnightBech32m.encode(networkId, new ShieldedAddress(coinPubKey, encPubKey)).toString();

  const DIV = '──────────────────────────────────────────────────────────────';
  console.log(`
${DIV}
  Wallet Overview                            Network: ${networkId}
${DIV}

  Shielded (ZSwap)
  └─ Address: ${shieldedAddress}

  Unshielded
  ├─ Address: ${unshieldedKeystore.getBech32Address()}
  └─ Balance: ${formatBalance(unshieldedBalance)} tNight

  Dust
  └─ Address: ${MidnightBech32m.encode(networkId, state.dust.address).toString()}

${DIV}`);
};

/**
 * Build wallet from 64-char hex seed, wait for sync, funds, and DUST generation.
 */
export const buildWalletFromSeed = async (config: Config, seed: string, _logger?: Logger): Promise<WalletContext> => {
  console.log('');

  const { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore } = await withStatus(
    'Building wallet',
    async () => {
      const keys = deriveKeysFromSeed(seed);
      const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
      const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
      const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], getNetworkId());

      const walletConfig = {
        ...buildShieldedConfig(config),
        ...buildUnshieldedConfig(config),
        ...buildDustConfig(config),
      };
      const wallet = await WalletFacade.init({
        configuration: walletConfig,
        shielded: (cfg) => ShieldedWallet(cfg).startWithSecretKeys(shieldedSecretKeys),
        unshielded: (cfg) => UnshieldedWallet(cfg).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
        dust: (cfg) =>
          DustWallet(cfg).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust),
      });
      await wallet.start(shieldedSecretKeys, dustSecretKey);

      return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
    },
  );

  const networkId = getNetworkId();
  const DIV = '──────────────────────────────────────────────────────────────';
  console.log(`
${DIV}
  Wallet Overview                            Network: ${networkId}
${DIV}
  Unshielded Address (send tNight here):
  ${unshieldedKeystore.getBech32Address()}

  Fund your wallet with tNight from the Preprod faucet:
  https://faucet.preprod.midnight.network/
${DIV}
`);

  const syncedState = await withStatus('Syncing with network', () => waitForSync(wallet));
  printWalletSummary(syncedState, unshieldedKeystore);

  const balance = syncedState.unshielded.balances[unshieldedToken().raw] ?? 0n;
  if (balance === 0n) {
    const fundedBalance = await withStatus('Waiting for incoming tokens', () => waitForFunds(wallet));
    console.log(`    Balance: ${formatBalance(fundedBalance)} tNight\n`);
  }

  await registerForDustGeneration(wallet, unshieldedKeystore);

  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
};

export const configureProviders = async (ctx: WalletContext, config: Config): Promise<SerenoProviders> => {
  const walletAndMidnightProvider = await createWalletAndMidnightProvider(ctx);
  const zkConfigProvider = new NodeZkConfigProvider<SerenoCircuits>(contractConfig.zkConfigPath);
  const accountId = walletAndMidnightProvider.getCoinPublicKey();
  const storagePassword = `${Buffer.from(accountId, 'hex').toString('base64')}!`;
  return {
    privateStateProvider: levelPrivateStateProvider<typeof SerenoPrivateStateId>({
      privateStateStoreName: contractConfig.privateStateStoreName,
      accountId,
      privateStoragePasswordProvider: () => storagePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(config.proofServer, zkConfigProvider),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider,
  } as SerenoProviders;
};

// ---------------------------------------------------------------------------
// Private-state bookkeeping
// ---------------------------------------------------------------------------

const getPrivateState = async (providers: SerenoProviders): Promise<SerenoPrivateState> => {
  const ps = await providers.privateStateProvider.get(SerenoPrivateStateId);
  if (ps == null) {
    throw new Error('Sereno private state not found — deploy or join a contract first.');
  }
  return ps;
};

const setPrivateState = async (providers: SerenoProviders, ps: SerenoPrivateState): Promise<void> => {
  await providers.privateStateProvider.set(SerenoPrivateStateId, ps);
};

export const getLedgerState = async (providers: SerenoProviders, contractAddress: string) => {
  const contractState = await providers.publicDataProvider.queryContractState(contractAddress);
  return contractState != null ? Sereno.ledger(contractState.data) : null;
};

export const ownSerenoAddress = (ps: SerenoPrivateState): Uint8Array => Sereno.pureCircuits.publicKey(ps.secretKey);

// ---------------------------------------------------------------------------
// Deploy / join
// ---------------------------------------------------------------------------

export const deploy = async (
  providers: SerenoProviders,
  auditorSk: bigint,
  logger: Logger,
): Promise<DeployedSerenoContract> => {
  const auditorPk = Sereno.pureCircuits.elGamalPublicKey(auditorSk);
  logger.info({ auditorPk: { x: auditorPk.x.toString(), y: auditorPk.y.toString() } }, 'Deploying Sereno...');

  // Constructor args via `args` (JubjubPoint auditor pk). Cast: CompiledContract
  // generics erase private-state type; runtime uses initialPrivateState + witnesses.
  const serenoContract = (await deployContract(providers, {
    compiledContract: serenoCompiledContract,
    privateStateId: SerenoPrivateStateId,
    initialPrivateState: createSerenoPrivateState(randomBytes32()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...( { args: [auditorPk] } as any ),
  })) as unknown as DeployedSerenoContract;
  logger.info({ contractAddress: serenoContract.deployTxData.public.contractAddress }, 'Deployed');
  return serenoContract;
};

export const joinContract = async (
  providers: SerenoProviders,
  contractAddress: string,
  logger: Logger,
): Promise<DeployedSerenoContract> => {
  const existing = await providers.privateStateProvider.get(SerenoPrivateStateId);
  const serenoContract = (await findDeployedContract(providers, {
    contractAddress,
    compiledContract: serenoCompiledContract,
    privateStateId: SerenoPrivateStateId,
    initialPrivateState: existing ?? createSerenoPrivateState(randomBytes32()),
  })) as unknown as DeployedSerenoContract;
  logger.info({ contractAddress }, 'Joined Sereno contract');
  return serenoContract;
};

// ---------------------------------------------------------------------------
// Circuit calls
// ---------------------------------------------------------------------------

export const shield = async (
  providers: SerenoProviders,
  contract: DeployedSerenoContract,
  contractAddress: string,
  amount: bigint,
  logger: Logger,
): Promise<FinalizedTxData> => {
  const ps = await getPrivateState(providers);
  const rand = randomBytes32();
  await setPrivateState(providers, { ...ps, pendingRandomness: rand });

  const ledgerBefore = await getLedgerState(providers, contractAddress);
  const mtIndex = ledgerBefore != null ? ledgerBefore.commitments.firstFree() : 0n;

  const txData = await contract.callTx.shield(amount);
  logger.info({ txHash: txData.public.txHash, blockHeight: txData.public.blockHeight }, 'shield finalized');

  // mtIndex captured as firstFree() pre-insert. On concurrent inserts the witness
  // falls back to findPathForLeaf when pathForLeaf fails (or set mtIndex null).
  const after = await getPrivateState(providers);
  const newNote: SerenoNote = { amount, randomness: rand, mtIndex };
  await setPrivateState(providers, {
    ...after,
    notes: [...after.notes, newNote],
    pendingRandomness: null,
  });
  return txData.public;
};

export const transfer = async (
  providers: SerenoProviders,
  contract: DeployedSerenoContract,
  contractAddress: string,
  noteIndex: number,
  recipientPk: Uint8Array,
  logger: Logger,
): Promise<{ txData: FinalizedTxData; outNote: SerenoNote; outCommitment: Uint8Array }> => {
  const ps = await getPrivateState(providers);
  const spent = ps.notes[noteIndex];
  if (spent === undefined) throw new Error(`no note at index ${noteIndex}`);
  const outRand = randomBytes32();
  await setPrivateState(providers, { ...ps, activeNoteIndex: noteIndex, pendingRandomness: outRand });

  const ledgerBefore = await getLedgerState(providers, contractAddress);
  const outMtIndex = ledgerBefore != null ? ledgerBefore.commitments.firstFree() : 0n;

  const txData = await contract.callTx.transfer(recipientPk);
  logger.info({ txHash: txData.public.txHash }, 'transfer finalized');

  const after = await getPrivateState(providers);
  await setPrivateState(providers, {
    ...after,
    notes: after.notes.filter((_, i) => i !== noteIndex),
    activeNoteIndex: 0,
    pendingRandomness: null,
  });

  const outNote: SerenoNote = { amount: spent.amount, randomness: outRand, mtIndex: outMtIndex };
  const outCommitment = Sereno.pureCircuits.noteCommitment(spent.amount, recipientPk, outRand);
  return { txData: txData.public, outNote, outCommitment };
};

export const receiveNote = async (providers: SerenoProviders, note: SerenoNote): Promise<void> => {
  const ps = await getPrivateState(providers);
  await setPrivateState(providers, { ...ps, notes: [...ps.notes, note] });
};

export const unshield = async (
  providers: SerenoProviders,
  contract: DeployedSerenoContract,
  noteIndex: number,
  logger: Logger,
): Promise<FinalizedTxData> => {
  const ps = await getPrivateState(providers);
  if (ps.notes[noteIndex] === undefined) throw new Error(`no note at index ${noteIndex}`);
  await setPrivateState(providers, { ...ps, activeNoteIndex: noteIndex });

  const txData = await contract.callTx.unshield();
  logger.info({ txHash: txData.public.txHash }, 'unshield finalized');

  const after = await getPrivateState(providers);
  await setPrivateState(providers, {
    ...after,
    notes: after.notes.filter((_, i) => i !== noteIndex),
    activeNoteIndex: 0,
  });
  return txData.public;
};

export const discloseToAuditor = async (
  providers: SerenoProviders,
  contract: DeployedSerenoContract,
  noteIndex: number,
  auditRequestId: Uint8Array,
  logger: Logger,
): Promise<FinalizedTxData> => {
  const ps = await getPrivateState(providers);
  if (ps.notes[noteIndex] === undefined) throw new Error(`no note at index ${noteIndex}`);
  await setPrivateState(providers, { ...ps, activeNoteIndex: noteIndex });

  const txData = await contract.callTx.discloseToAuditor(auditRequestId);
  logger.info({ txHash: txData.public.txHash }, 'discloseToAuditor finalized');
  return txData.public;
};

const toHex = (b: Uint8Array): string => Buffer.from(b).toString('hex');

export const displayLedgerState = async (
  providers: SerenoProviders,
  contractAddress: string,
  logger: Logger,
): Promise<void> => {
  const state = await getLedgerState(providers, contractAddress);
  if (state == null) {
    logger.info('No contract state found at this address.');
    return;
  }
  logger.info(`totalValueLocked: ${state.totalValueLocked.toString()}`);
  logger.info(
    `commitments: root=${state.commitments.root().field.toString()} nextLeaf=${state.commitments.firstFree().toString()}`,
  );
  logger.info(`auditorPk: x=${state.auditorPk.x.toString()} y=${state.auditorPk.y.toString()}`);
  logger.info(`nullifiers (${state.nullifiers.size().toString()}):`);
  for (const nul of state.nullifiers) {
    logger.info(`  ${toHex(nul)}`);
  }
  logger.info(`auditDisclosures (${state.auditDisclosures.size().toString()}):`);
  for (const [reqId, rec] of state.auditDisclosures) {
    logger.info(`  request=${toHex(reqId)} commitment=${toHex(rec.commitment)} amount=${rec.amount.toString()}`);
  }
  logger.info(`transferCiphertexts (${state.transferCiphertexts.size().toString()}):`);
  for (const [cm, ct] of state.transferCiphertexts) {
    logger.info(
      `  outCommitment=${toHex(cm)} c1=(${ct.c1.x.toString()},${ct.c1.y.toString()}) c2=(${ct.c2.x.toString()},${ct.c2.y.toString()})`,
    );
  }
};
