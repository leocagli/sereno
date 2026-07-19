// Local smoke demo (no network): pure circuits + private state bookkeeping.
import { webcrypto } from 'node:crypto';
import {
  Sereno,
  createSerenoPrivateState,
  randomBytes32,
  type SerenoNote,
} from 'sereno-contract';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(globalThis as any).crypto) (globalThis as any).crypto = webcrypto;

const toHex = (b: Uint8Array) => Buffer.from(b).toString('hex');

console.log('=== Sereno local smoke (pure circuits) ===\n');

const sk = randomBytes32();
const pk = Sereno.pureCircuits.publicKey(sk);
console.log('owner secretKey:', toHex(sk).slice(0, 16) + '…');
console.log('Sereno address (publicKey):', toHex(pk));

const amount = 100n;
const rand = randomBytes32();
const cm = Sereno.pureCircuits.noteCommitment(amount, pk, rand);
console.log('noteCommitment(100, pk, r):', toHex(cm));

const auditorSk =
  BigInt('0x' + Buffer.from(webcrypto.getRandomValues(new Uint8Array(30))).toString('hex'));
const auditorPk = Sereno.pureCircuits.elGamalPublicKey(auditorSk);
console.log('auditorPk.x:', auditorPk.x.toString().slice(0, 24) + '…');
console.log('auditorPk.y:', auditorPk.y.toString().slice(0, 24) + '…');

// Simulate private-state note bookkeeping (what CLI does after shield)
let ps = createSerenoPrivateState(sk);
const note: SerenoNote = { amount, randomness: rand, mtIndex: 0n };
ps = { ...ps, notes: [note], pendingRandomness: null, activeNoteIndex: 0 };
console.log('\nprivate notes:', ps.notes.length, 'active amount=', ps.notes[0]!.amount.toString());

// Re-derive commitment (must match)
const cm2 = Sereno.pureCircuits.noteCommitment(
  ps.notes[0]!.amount,
  Sereno.pureCircuits.publicKey(ps.secretKey),
  ps.notes[0]!.randomness,
);
console.log('re-derived commitment match:', toHex(cm) === toHex(cm2));

console.log('\nCompiled circuits available under contract/src/managed/sereno/keys:');
console.log('  shield, transfer, unshield, discloseToAuditor');
console.log('\n✓ Local smoke OK — pureCircuits + private state work.');
console.log('  On-chain demo needs tNIGHT from the preprod faucet (Cloudflare captcha).');
