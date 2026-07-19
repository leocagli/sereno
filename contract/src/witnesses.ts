// witnesses.ts — private (off-chain) state and witness implementations for Sereno.
//
// Witnesses are NOT verified by themselves. Every value is re-validated
// in-circuit (commitment re-derivation, Merkle membership, nullifier uniqueness)
// before it can affect public state.

import type { WitnessContext } from "@midnight-ntwrk/compact-runtime";
import type { Ledger, Note } from "./managed/sereno/contract/index.js";

/** One unspent note owned by this user (preimage of an on-chain commitment). */
export type SerenoNote = {
  readonly amount: bigint;
  readonly randomness: Uint8Array;
  /**
   * Leaf index once known (from commitments.firstFree() at insertion).
   * When null, the witness falls back to findPathForLeaf.
   */
  readonly mtIndex: bigint | null;
};

export type SerenoPrivateState = {
  /** Owner spending key. publicKey(sk) is the user's Sereno address. */
  readonly secretKey: Uint8Array;
  readonly notes: SerenoNote[];
  /** Index into `notes` for transfer / unshield / discloseToAuditor. */
  readonly activeNoteIndex: number;
  /**
   * Randomness reserved for the next output note (shield/transfer).
   * Set by the dApp before the call when possible.
   */
  readonly pendingRandomness: Uint8Array | null;
};

export const createSerenoPrivateState = (secretKey: Uint8Array): SerenoPrivateState => ({
  secretKey,
  notes: [],
  activeNoteIndex: 0,
  pendingRandomness: null,
});

export const randomBytes32 = (): Uint8Array => crypto.getRandomValues(new Uint8Array(32));

/** Uniform random Field-sized scalar for ElGamal nonce (30 random bytes). */
export const randomFieldElement = (): bigint => {
  const bytes = crypto.getRandomValues(new Uint8Array(30));
  let x = 0n;
  for (const b of bytes) {
    x = (x << 8n) | BigInt(b);
  }
  return x;
};

const activeNoteOf = (ps: SerenoPrivateState): SerenoNote => {
  const note = ps.notes[ps.activeNoteIndex];
  if (note === undefined) {
    throw new Error(
      `no active note: activeNoteIndex=${ps.activeNoteIndex} but private state holds ${ps.notes.length} note(s)`,
    );
  }
  return note;
};

/** Shape required by Compact-generated Witnesses type (`goes_left`, not `goesLeft`). */
export type MerkleTreePathTS = {
  leaf: Uint8Array;
  path: { sibling: { field: bigint }; goes_left: boolean }[];
};

// Runtime MerkleTreePath uses camelCase goesLeft; Compact witness API wants goes_left.
const toWitnessPath = (path: {
  leaf: Uint8Array;
  path: { sibling: { field: bigint }; goesLeft?: boolean; goes_left?: boolean }[];
}): MerkleTreePathTS => ({
  leaf: path.leaf,
  path: path.path.map((e) => ({
    sibling: e.sibling,
    goes_left: e.goes_left ?? e.goesLeft ?? false,
  })),
});

export const witnesses = {
  ownerSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, SerenoPrivateState>): [SerenoPrivateState, Uint8Array] => [
    privateState,
    privateState.secretKey,
  ],

  activeNote: ({
    privateState,
  }: WitnessContext<Ledger, SerenoPrivateState>): [SerenoPrivateState, Note] => {
    const note = activeNoteOf(privateState);
    return [privateState, { amount: note.amount, randomness: note.randomness }];
  },

  newNoteRandomness: ({
    privateState,
  }: WitnessContext<Ledger, SerenoPrivateState>): [SerenoPrivateState, Uint8Array] => {
    const rand = privateState.pendingRandomness ?? randomBytes32();
    return [{ ...privateState, pendingRandomness: rand }, rand];
  },

  findNotePath: (
    { ledger, privateState }: WitnessContext<Ledger, SerenoPrivateState>,
    commitment: Uint8Array,
  ): [SerenoPrivateState, MerkleTreePathTS] => {
    const note = activeNoteOf(privateState);
    const path =
      note.mtIndex !== null
        ? ledger.commitments.pathForLeaf(note.mtIndex, commitment)
        : ledger.commitments.findPathForLeaf(commitment);
    if (path == null) {
      throw new Error("active note commitment not present in the on-chain commitment tree");
    }
    return [privateState, toWitnessPath(path)];
  },

  elGamalNonce: ({
    privateState,
  }: WitnessContext<Ledger, SerenoPrivateState>): [SerenoPrivateState, bigint] => [
    privateState,
    randomFieldElement(),
  ],
};
