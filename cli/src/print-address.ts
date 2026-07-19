// Print unshielded faucet address for a 64-hex seed (no wallet sync).
import { Buffer } from 'node:buffer';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { createKeystore } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { setNetworkId, getNetworkId } from '@midnight-ntwrk/midnight-js/network-id';

const seed = (process.argv[2] ?? '').trim();
if (!/^[0-9a-fA-F]{64}$/.test(seed)) {
  console.error('Usage: node dist/print-address.js <64-hex-seed>');
  process.exit(1);
}

setNetworkId('preprod');
const networkId = getNetworkId();

const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
if (hdWallet.type !== 'seedOk') throw new Error('bad seed');
const derivationResult = hdWallet.hdWallet
  .selectAccount(0)
  .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
  .deriveKeysAt(0);
if (derivationResult.type !== 'keysDerived') throw new Error('derive failed');
const keys = derivationResult.keys;
hdWallet.hdWallet.clear();

const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], networkId);
const raw = unshieldedKeystore.getBech32Address();
const addr = typeof raw === 'string' ? raw : String(raw);

console.log('NETWORK', networkId);
console.log('UNSHIELDED', addr);
console.log('FAUCET', 'https://faucet.preprod.midnight.network/');
console.log('FAUCET_ALT', 'https://midnight-tmnight-preprod.nethermind.dev/');
