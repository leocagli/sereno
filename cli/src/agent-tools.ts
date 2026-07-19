// Privacy-preserving tools for the Sereno agent.
// PureCircuits are REAL; deploy/callTx are simulated (no secret keys leave this module).

import { webcrypto } from "node:crypto";
import {
  Sereno,
  createSerenoPrivateState,
  randomBytes32,
  type SerenoNote,
  type SerenoPrivateState,
} from "sereno-contract";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(globalThis as any).crypto) (globalThis as any).crypto = webcrypto;

const toHex = (b: Uint8Array) => Buffer.from(b).toString("hex");
const short = (h: string, n = 8) => `${h.slice(0, n)}…${h.slice(-4)}`;

export type ToolResult = {
  ok: boolean;
  tool: string;
  /** Safe for LLM / logs — never includes secret keys */
  public: Record<string, string | number | boolean | null>;
  message: string;
};

export type PublicLedgerView = {
  tvl: string;
  commitmentCount: number;
  nullifierCount: number;
  transferCiphertextCount: number;
  auditDisclosureCount: number;
  contractAddress: string | null;
  auditorSealed: boolean;
};

type InternalNote = SerenoNote & { commitment: string; ownerLabel: "sender" | "recipient" };

type CorridorState = {
  contractAddress: string | null;
  tvl: bigint;
  nextLeaf: bigint;
  commitments: string[];
  nullifiers: string[];
  transferCiphertexts: { outCommitment: string; hint: string }[];
  auditDisclosures: { requestId: string; commitment: string; amount: string }[];
  senderSk: Uint8Array;
  recipientSk: Uint8Array;
  senderPk: Uint8Array;
  recipientPk: Uint8Array;
  auditorSk: bigint;
  auditorPk: { x: bigint; y: bigint };
  senderPs: SerenoPrivateState;
  recipientPs: SerenoPrivateState;
  notesByOwner: { sender: InternalNote[]; recipient: InternalNote[] };
};

const FAUCET_TX =
  "00bc9da4d80c86b1b7805df25384ef87228111e56734f94d64bf9f7ef148a141ab";
const WALLET =
  "mn_addr_preprod1c2ljvsln2z5aca6nmd44skj72kmdavnm03vm9v3rwm37kclfnptsffuh6t";

function randomFieldScalar(): bigint {
  const bytes = webcrypto.getRandomValues(new Uint8Array(30));
  let x = 0n;
  for (const b of bytes) x = (x << 8n) | BigInt(b);
  return x;
}

function makeState(): CorridorState {
  const senderSk = randomBytes32();
  const recipientSk = randomBytes32();
  const auditorSk = randomFieldScalar();
  return {
    contractAddress: null,
    tvl: 0n,
    nextLeaf: 0n,
    commitments: [],
    nullifiers: [],
    transferCiphertexts: [],
    auditDisclosures: [],
    senderSk,
    recipientSk,
    senderPk: Sereno.pureCircuits.publicKey(senderSk),
    recipientPk: Sereno.pureCircuits.publicKey(recipientSk),
    auditorSk,
    auditorPk: Sereno.pureCircuits.elGamalPublicKey(auditorSk),
    senderPs: createSerenoPrivateState(senderSk),
    recipientPs: createSerenoPrivateState(recipientSk),
    notesByOwner: { sender: [], recipient: [] },
  };
}

let state = makeState();

export const TOOL_CATALOG = [
  {
    name: "get_public_ledger",
    description: "Read only PUBLIC ledger fields (TVL, counts). Never returns private notes or secret keys.",
    args: {},
  },
  {
    name: "get_faucet_proof",
    description: "Return the real Midnight Preprod faucet funding proof for the demo wallet.",
    args: {},
  },
  {
    name: "deploy_corridor",
    description: "Simulate deploy of Sereno with sealed auditor public key. Returns contract address only.",
    args: {},
  },
  {
    name: "shield",
    description:
      "Simulate shield(amount). Amount is PUBLIC on entry. Returns commitment + TVL. Does not expose owner secret key.",
    args: { amount: "uint64" },
  },
  {
    name: "transfer",
    description:
      "Simulate private transfer to recipient. Public sees nullifier + output commitment + auditor ElGamal ciphertext only.",
    args: { from: "sender|recipient", noteIndex: "number (default 0)" },
  },
  {
    name: "disclose_to_auditor",
    description:
      "Simulate selective disclosure: prove a note opens to its amount under an audit request id. Note is NOT spent.",
    args: { owner: "sender|recipient", noteIndex: "number", requestId: "hex optional" },
  },
  {
    name: "unshield",
    description: "Simulate unshield — amount becomes PUBLIC on exit, note spent, TVL decreases.",
    args: { owner: "sender|recipient", noteIndex: "number" },
  },
  {
    name: "list_tools",
    description: "List available tools and the privacy policy of the agent.",
    args: {},
  },
] as const;

export type ToolName = (typeof TOOL_CATALOG)[number]["name"];

function publicLedger(): PublicLedgerView {
  return {
    tvl: state.tvl.toString(),
    commitmentCount: state.commitments.length,
    nullifierCount: state.nullifiers.length,
    transferCiphertextCount: state.transferCiphertexts.length,
    auditDisclosureCount: state.auditDisclosures.length,
    contractAddress: state.contractAddress,
    auditorSealed: state.contractAddress != null,
  };
}

function requireDeployed(): ToolResult | null {
  if (!state.contractAddress) {
    return {
      ok: false,
      tool: "guard",
      public: {},
      message: "Corridor not deployed. Call deploy_corridor first.",
    };
  }
  return null;
}

export function resetCorridor(): void {
  state = makeState();
}

export function runTool(name: string, args: Record<string, string> = {}): ToolResult {
  switch (name) {
    case "list_tools":
      return {
        ok: true,
        tool: name,
        public: {
          policy:
            "Agent never returns secret keys, full private state, or note randomness. Only public ledger fields and explicit disclosures.",
          tools: TOOL_CATALOG.map((t) => t.name).join(", "),
        },
        message:
          "Sereno agent tools ready. Privacy policy: no secret keys, no private preimages in tool outputs.",
      };

    case "get_faucet_proof":
      return {
        ok: true,
        tool: name,
        public: {
          network: "preprod",
          unshieldedWallet: WALLET,
          faucetTx: FAUCET_TX,
          amount: "5000 tNIGHT",
          explorers: "preprod.midnightexplorer.com | midnight-preprod.subscan.io",
        },
        message: `Real preprod funding: ${short(FAUCET_TX, 12)} · 5000 tNIGHT`,
      };

    case "get_public_ledger": {
      const L = publicLedger();
      return {
        ok: true,
        tool: name,
        public: { ...L },
        message: L.contractAddress
          ? `TVL=${L.tvl} · commitments=${L.commitmentCount} · nullifiers=${L.nullifierCount} · disclosures=${L.auditDisclosureCount}`
          : "No contract deployed yet (public ledger empty).",
      };
    }

    case "deploy_corridor": {
      if (state.contractAddress) {
        return {
          ok: true,
          tool: name,
          public: { contractAddress: state.contractAddress, alreadyDeployed: true },
          message: `Already deployed at ${state.contractAddress}`,
        };
      }
      state.contractAddress = `0xsereno${toHex(randomBytes32()).slice(0, 40)}`;
      return {
        ok: true,
        tool: name,
        public: {
          contractAddress: state.contractAddress,
          auditorPkX: state.auditorPk.x.toString().slice(0, 24) + "…",
          auditorPkY: state.auditorPk.y.toString().slice(0, 24) + "…",
          mode: "simulated-deploy + real pureCircuits for keys",
          tx: `sim_deploy_${toHex(randomBytes32()).slice(0, 16)}`,
        },
        message: `Deployed Sereno corridor (sim). Auditor sealed. contract=${state.contractAddress}`,
      };
    }

    case "shield": {
      const guard = requireDeployed();
      if (guard) return { ...guard, tool: name };
      const amount = BigInt(args.amount ?? "1000");
      if (amount <= 0n) {
        return { ok: false, tool: name, public: {}, message: "amount must be > 0" };
      }
      const rand = randomBytes32();
      const cm = Sereno.pureCircuits.noteCommitment(amount, state.senderPk, rand);
      const cmHex = toHex(cm);
      const note: InternalNote = {
        amount,
        randomness: rand,
        mtIndex: state.nextLeaf,
        commitment: cmHex,
        ownerLabel: "sender",
      };
      state.commitments.push(cmHex);
      state.nextLeaf += 1n;
      state.tvl += amount;
      state.notesByOwner.sender.push(note);
      state.senderPs = {
        ...state.senderPs,
        notes: [...state.senderPs.notes, { amount, randomness: rand, mtIndex: note.mtIndex }],
      };
      return {
        ok: true,
        tool: name,
        public: {
          amount: amount.toString(),
          amountVisibility: "PUBLIC (accountable edge)",
          commitment: cmHex,
          mtIndex: note.mtIndex!.toString(),
          tvl: state.tvl.toString(),
          tx: `sim_shield_${toHex(randomBytes32()).slice(0, 16)}`,
        },
        message: `shield(${amount}) · commitment=${short(cmHex)} · TVL=${state.tvl} (amount public on entry only)`,
      };
    }

    case "transfer": {
      const guard = requireDeployed();
      if (guard) return { ...guard, tool: name };
      const from = (args.from ?? "sender") as "sender" | "recipient";
      const idx = Number(args.noteIndex ?? "0");
      const bag = state.notesByOwner[from];
      const spent = bag[idx];
      if (!spent) {
        return {
          ok: false,
          tool: name,
          public: { from, noteIndex: idx },
          message: `No note at ${from}[${idx}]`,
        };
      }
      const outRand = randomBytes32();
      const toPk = from === "sender" ? state.recipientPk : state.senderPk;
      const toLabel = from === "sender" ? "recipient" : "sender";
      const outCm = Sereno.pureCircuits.noteCommitment(spent.amount, toPk, outRand);
      const outHex = toHex(outCm);
      // Display nullifier (domain-separated style value; not the sk)
      const nulMaterial = new Uint8Array(32);
      nulMaterial.set(spent.randomness.slice(0, 16), 0);
      nulMaterial.set((from === "sender" ? state.senderPk : state.recipientPk).slice(0, 16), 16);
      const nul = toHex(Sereno.pureCircuits.noteCommitment(spent.amount, nulMaterial, spent.randomness));

      bag.splice(idx, 1);
      state.nullifiers.push(nul);
      state.commitments.push(outHex);
      const outNote: InternalNote = {
        amount: spent.amount,
        randomness: outRand,
        mtIndex: state.nextLeaf,
        commitment: outHex,
        ownerLabel: toLabel,
      };
      state.nextLeaf += 1n;
      state.notesByOwner[toLabel].push(outNote);
      state.transferCiphertexts.push({
        outCommitment: outHex,
        hint: "ElGamal(c1,c2) → auditor only",
      });

      return {
        ok: true,
        tool: name,
        public: {
          amountVisibility: "HIDDEN from public · ElGamal to auditor only",
          nullifier: nul,
          outCommitment: outHex,
          tvl: state.tvl.toString(),
          transferCiphertexts: state.transferCiphertexts.length,
          tx: `sim_transfer_${toHex(randomBytes32()).slice(0, 16)}`,
        },
        message: `transfer · nullifier=${short(nul)} · out=${short(outHex)} · public sees no amount`,
      };
    }

    case "disclose_to_auditor": {
      const guard = requireDeployed();
      if (guard) return { ...guard, tool: name };
      const owner = (args.owner ?? "recipient") as "sender" | "recipient";
      const idx = Number(args.noteIndex ?? "0");
      const note = state.notesByOwner[owner][idx];
      if (!note) {
        return {
          ok: false,
          tool: name,
          public: { owner, noteIndex: idx },
          message: `No note at ${owner}[${idx}] to disclose`,
        };
      }
      const requestId = args.requestId
        ? args.requestId.replace(/^0x/, "")
        : toHex(randomBytes32());
      state.auditDisclosures.push({
        requestId,
        commitment: note.commitment,
        amount: note.amount.toString(),
      });
      return {
        ok: true,
        tool: name,
        public: {
          requestId,
          commitment: note.commitment,
          amount: note.amount.toString(),
          amountVisibility: "DISCLOSED under this audit request only",
          noteSpent: false,
          tx: `sim_disclose_${toHex(randomBytes32()).slice(0, 16)}`,
        },
        message: `discloseToAuditor · request=${short(requestId)} · amount=${note.amount} (explicit disclosure, note kept)`,
      };
    }

    case "unshield": {
      const guard = requireDeployed();
      if (guard) return { ...guard, tool: name };
      const owner = (args.owner ?? "recipient") as "sender" | "recipient";
      const idx = Number(args.noteIndex ?? "0");
      const bag = state.notesByOwner[owner];
      const note = bag[idx];
      if (!note) {
        return {
          ok: false,
          tool: name,
          public: { owner, noteIndex: idx },
          message: `No note at ${owner}[${idx}]`,
        };
      }
      bag.splice(idx, 1);
      state.tvl -= note.amount;
      if (state.tvl < 0n) state.tvl = 0n;
      return {
        ok: true,
        tool: name,
        public: {
          amount: note.amount.toString(),
          amountVisibility: "PUBLIC (accountable edge on exit)",
          tvl: state.tvl.toString(),
          tx: `sim_unshield_${toHex(randomBytes32()).slice(0, 16)}`,
        },
        message: `unshield · amount=${note.amount} public · TVL=${state.tvl}`,
      };
    }

    default:
      return {
        ok: false,
        tool: name,
        public: {},
        message: `Unknown tool '${name}'. Use list_tools.`,
      };
  }
}

/** Map natural language (ES/EN) to a tool call — local policy agent, no cloud LLM required. */
export function routeIntent(userText: string): { tool: string; args: Record<string, string> } {
  const t = userText.toLowerCase().trim();

  if (/tool|ayuda|help|qué podés|que podes|capabilities/.test(t)) {
    return { tool: "list_tools", args: {} };
  }
  if (/faucet|fondos|funding|tnight|prueba on.?chain|tx real/.test(t)) {
    return { tool: "get_faucet_proof", args: {} };
  }
  if (/ledger|estado|tvl|público|publico|pool/.test(t) && !/disclose|audit/.test(t)) {
    return { tool: "get_public_ledger", args: {} };
  }
  if (/deploy|despleg|contrato/.test(t)) {
    return { tool: "deploy_corridor", args: {} };
  }
  // unshield BEFORE shield (otherwise "unshield" matches /shield/)
  if (/\bunshield\b|retir|withdraw|cash.?out|sacar fondos/.test(t)) {
    return { tool: "unshield", args: { owner: "recipient", noteIndex: "0" } };
  }
  if (/\bshield\b|deposit|ingres|entrar al pool|meter/.test(t)) {
    const m = t.match(/(\d+)/);
    return { tool: "shield", args: { amount: m?.[1] ?? "1000" } };
  }
  if (/transfer|enviar|mandar|remit/.test(t)) {
    return { tool: "transfer", args: { from: "sender", noteIndex: "0" } };
  }
  if (/disclose|audit|auditor|uif|revel|compliance|pedido/.test(t)) {
    return { tool: "disclose_to_auditor", args: { owner: "recipient", noteIndex: "0" } };
  }
  if (/reset|reinic/.test(t)) {
    resetCorridor();
    return { tool: "list_tools", args: {} };
  }

  return { tool: "list_tools", args: {} };
}
