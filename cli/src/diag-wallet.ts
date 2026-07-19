// Diagnose wallet sync: print state snapshots for 90s then exit.
import { Buffer } from 'node:buffer';
import { WebSocket } from 'ws';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  createKeystore,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  UnshieldedWallet,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { getNetworkId } from '@midnight-ntwrk/midnight-js/network-id';
import * as Rx from 'rxjs';
import { TestnetConfig } from './config.js';

// @ts-expect-error global WS
globalThis.WebSocket = WebSocket;

const seed = (process.argv[2] ?? 'b34732e9f507a0f2cae43b716bc846519f62110a4f9c9f826cc71446e91a5017').trim();
const config = new TestnetConfig();
const networkId = getNetworkId();
console.log('network', networkId);
console.log('indexer', config.indexer);
console.log('indexerWS', config.indexerWS);
console.log('node', config.node);
console.log('proof', config.proofServer);

const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
if (hdWallet.type !== 'seedOk') throw new Error('bad seed');
const derivationResult = hdWallet.hdWallet
  .selectAccount(0)
  .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
  .deriveKeysAt(0);
if (derivationResult.type !== 'keysDerived') throw new Error('derive failed');
const keys = derivationResult.keys;
hdWallet.hdWallet.clear();

const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], networkId);
console.log('unshielded', String(unshieldedKeystore.getBech32Address()));

const walletConfig = {
  networkId,
  indexerClientConnection: {
    indexerHttpUrl: config.indexer,
    indexerWsUrl: config.indexerWS,
  },
  provingServerUrl: new URL(config.proofServer),
  relayURL: new URL(config.node.replace(/^http/, 'ws')),
  txHistoryStorage: new InMemoryTransactionHistoryStorage(),
  costParameters: {
    additionalFeeOverhead: 300_000_000_000_000n,
    feeBlocksMargin: 5,
  },
};
console.log('relayURL', walletConfig.relayURL.toString());

const wallet = await WalletFacade.init({
  configuration: walletConfig,
  shielded: (cfg) => ShieldedWallet(cfg).startWithSecretKeys(shieldedSecretKeys),
  unshielded: (cfg) => UnshieldedWallet(cfg).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
  dust: (cfg) => DustWallet(cfg).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust),
});
await wallet.start(shieldedSecretKeys, dustSecretKey);
console.log('wallet started');

const sub = wallet.state().pipe(Rx.throttleTime(3000)).subscribe((s) => {
  const bal = s.unshielded?.balances?.[unshieldedToken().raw] ?? 0n;
  console.log(
    JSON.stringify({
      t: new Date().toISOString(),
      isSynced: s.isSynced,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      progress: (s as any).syncProgress ?? (s as any).progress ?? null,
      unshieldedBal: bal.toString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      keys: Object.keys(s as any),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      shieldedKeys: s.shielded ? Object.keys(s.shielded as any) : [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dustCoins: (s.dust as any)?.availableCoins?.length ?? null,
    }),
  );
});

await new Promise((r) => setTimeout(r, 90_000));
sub.unsubscribe();
console.log('diag done');
process.exit(0);
