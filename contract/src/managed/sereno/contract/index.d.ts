import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Note = { amount: bigint; randomness: Uint8Array };

export type AuditRecord = { commitment: Uint8Array; amount: bigint };

export type ElGamalCiphertext = { c1: __compactRuntime.JubjubPoint;
                                  c2: __compactRuntime.JubjubPoint
                                };

export type Witnesses<PS> = {
  ownerSecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  activeNote(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Note];
  newNoteRandomness(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  findNotePath(context: __compactRuntime.WitnessContext<Ledger, PS>,
               commitment_0: Uint8Array): [PS, { leaf: Uint8Array,
                                                 path: { sibling: { field: bigint
                                                                  },
                                                         goes_left: boolean
                                                       }[]
                                               }];
  elGamalNonce(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
}

export type ImpureCircuits<PS> = {
  shield(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  transfer(context: __compactRuntime.CircuitContext<PS>,
           recipientPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  unshield(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
  discloseToAuditor(context: __compactRuntime.CircuitContext<PS>,
                    auditRequestId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  shield(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  transfer(context: __compactRuntime.CircuitContext<PS>,
           recipientPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  unshield(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
  discloseToAuditor(context: __compactRuntime.CircuitContext<PS>,
                    auditRequestId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  publicKey(sk_0: Uint8Array): Uint8Array;
  noteCommitment(amount_0: bigint,
                 ownerPk_0: Uint8Array,
                 randomness_0: Uint8Array): Uint8Array;
  elGamalPublicKey(sk_0: bigint): __compactRuntime.JubjubPoint;
}

export type Circuits<PS> = {
  publicKey(context: __compactRuntime.CircuitContext<PS>, sk_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  noteCommitment(context: __compactRuntime.CircuitContext<PS>,
                 amount_0: bigint,
                 ownerPk_0: Uint8Array,
                 randomness_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  elGamalPublicKey(context: __compactRuntime.CircuitContext<PS>, sk_0: bigint): __compactRuntime.CircuitResults<PS, __compactRuntime.JubjubPoint>;
  shield(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  transfer(context: __compactRuntime.CircuitContext<PS>,
           recipientPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  unshield(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
  discloseToAuditor(context: __compactRuntime.CircuitContext<PS>,
                    auditRequestId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  commitments: {
    isFull(): boolean;
    checkRoot(rt_0: { field: bigint }): boolean;
    root(): __compactRuntime.MerkleTreeDigest;
    firstFree(): bigint;
    pathForLeaf(index_0: bigint, leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array>;
    findPathForLeaf(leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array> | undefined;
    history(): Iterator<__compactRuntime.MerkleTreeDigest>
  };
  nullifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  readonly auditorPk: __compactRuntime.JubjubPoint;
  auditDisclosures: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): AuditRecord;
    [Symbol.iterator](): Iterator<[Uint8Array, AuditRecord]>
  };
  transferCiphertexts: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): ElGamalCiphertext;
    [Symbol.iterator](): Iterator<[Uint8Array, ElGamalCiphertext]>
  };
  readonly totalValueLocked: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               auditorPublicKey_0: __compactRuntime.JubjubPoint): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
