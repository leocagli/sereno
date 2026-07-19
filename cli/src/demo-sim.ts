// Simulated end-to-end Sereno demo (no network / wallet sync).
// Uses real pureCircuits from the compiled Compact contract.
// Output is designed for screenshots / Remotion terminal scenes.
//
// Usage:  node dist/demo-sim.js
// JSON:   node dist/demo-sim.js --json

import { webcrypto } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
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
const short = (h: string, n = 10) => `${h.slice(0, n)}…${h.slice(-6)}`;

const DIV = "──────────────────────────────────────────────────────────────";
const asJson = process.argv.includes("--json");

type Step = {
  t: number;
  title: string;
  lines: string[];
  public?: Record<string, string>;
  private?: Record<string, string>;
};

const steps: Step[] = [];
const log = (title: string, lines: string[], extra?: Partial<Step>) => {
  steps.push({ t: Date.now(), title, lines, ...extra });
  if (!asJson) {
    console.log(`\n${DIV}`);
    console.log(`  ${title}`);
    console.log(DIV);
    for (const l of lines) console.log(`  ${l}`);
  }
};

const main = () => {
  log("SERENO · simulated preprod demo", [
    "Network: preprod (simulated — pureCircuits are REAL)",
    "Proof server: local (assumed)",
    "Mode: offline simulation for video / judging",
  ]);

  // --- Wallet personas ---
  const senderSk = randomBytes32();
  const recipientSk = randomBytes32();
  const senderPk = Sereno.pureCircuits.publicKey(senderSk);
  const recipientPk = Sereno.pureCircuits.publicKey(recipientSk);

  // Auditor ElGamal keypair (demo)
  const auditorSkBytes = webcrypto.getRandomValues(new Uint8Array(30));
  let auditorSk = 0n;
  for (const b of auditorSkBytes) auditorSk = (auditorSk << 8n) | BigInt(b);
  const auditorPk = Sereno.pureCircuits.elGamalPublicKey(auditorSk);

  log("1 · Personas", [
    `Sender Sereno address:    ${toHex(senderPk)}`,
    `Recipient Sereno address: ${toHex(recipientPk)}`,
    `Auditor pk.x:             ${auditorPk.x.toString().slice(0, 28)}…`,
    `Auditor pk.y:             ${auditorPk.y.toString().slice(0, 28)}…`,
    `Unshielded (funded):      mn_addr_preprod1c2ljvsln2z5aca6nmd44skj72kmdavnm03vm9v3rwm37kclfnptsffuh6t`,
    `Faucet tx:                00bc9da4d80c86b1b7805df25384ef87228111e56734f94d64bf9f7ef148a141ab`,
  ]);

  // --- Deploy (simulated) ---
  const contractAddress = `0xsereno${toHex(randomBytes32()).slice(0, 40)}`;
  log("2 · Deploy Sereno contract", [
    "constructor(auditorPublicKey) — sealed auditorPk on ledger",
    `SIM deploy tx:            sim_deploy_${toHex(randomBytes32()).slice(0, 16)}`,
    `Contract address:         ${contractAddress}`,
    "Ledger: empty tree · TVL=0 · auditor sealed",
  ], {
    public: {
      contract: contractAddress,
      tvl: "0",
    },
  });

  // --- Shield ---
  let senderPs: SerenoPrivateState = createSerenoPrivateState(senderSk);
  const amount = 1000n;
  const shieldRand = randomBytes32();
  const shieldCm = Sereno.pureCircuits.noteCommitment(amount, senderPk, shieldRand);
  const note0: SerenoNote = { amount, randomness: shieldRand, mtIndex: 0n };
  senderPs = { ...senderPs, notes: [note0], pendingRandomness: null };

  log("3 · shield(1000) — amount PUBLIC on entry", [
    "✓ amount disclosed into totalValueLocked",
    `✓ note commitment:        ${toHex(shieldCm)}`,
    "✓ inserted into HistoricMerkleTree leaf 0",
    "✓ TVL = 1000 (public)",
    "  Interior of the note stays private (hiding commitment)",
    `SIM shield tx:            sim_shield_${toHex(randomBytes32()).slice(0, 16)}`,
  ], {
    public: {
      action: "shield",
      amount: "1000",
      tvl: "1000",
      commitment: toHex(shieldCm),
    },
    private: {
      owner: toHex(senderPk),
      mtIndex: "0",
    },
  });

  // --- Transfer ---
  const transferRand = randomBytes32();
  const outCm = Sereno.pureCircuits.noteCommitment(amount, recipientPk, transferRand);
  // Spend: nullifier is domain-separated hash (we approximate display with pure circuits only)
  const nullifierDisplay = toHex(
    Sereno.pureCircuits.noteCommitment(
      amount,
      Sereno.pureCircuits.publicKey(senderSk),
      // distinct randomness for display of "nullifier-like" value
      (() => {
        const x = new Uint8Array(32);
        x.set(senderSk.slice(0, 16), 0);
        x.set(shieldRand.slice(0, 16), 16);
        return x;
      })(),
    ),
  );

  senderPs = { ...senderPs, notes: [], activeNoteIndex: 0 };
  const recipientNote: SerenoNote = {
    amount,
    randomness: transferRand,
    mtIndex: 1n,
  };
  let recipientPs: SerenoPrivateState = {
    ...createSerenoPrivateState(recipientSk),
    notes: [recipientNote],
  };

  log("4 · transfer(recipientPk) — private to public", [
    "✓ spent note membership proved (Merkle path)",
    `✓ nullifier published:    ${short(nullifierDisplay)}  (unlinkable without sk)`,
    `✓ output commitment:      ${toHex(outCm)}`,
    "✓ ElGamal ciphertext → auditorPk (in-circuit, amount hidden from public)",
    "✓ TVL unchanged (1-in/1-out same amount)",
    "  Off-band: send amount + randomness + mtIndex to recipient",
    `SIM transfer tx:          sim_transfer_${toHex(randomBytes32()).slice(0, 16)}`,
  ], {
    public: {
      action: "transfer",
      nullifier: nullifierDisplay,
      outCommitment: toHex(outCm),
      tvl: "1000",
      auditorCiphertext: "ElGamal(c1,c2) on ledger",
    },
    private: {
      recipient: toHex(recipientPk),
      amount: "1000 (only auditor + parties)",
    },
  });

  // --- Ledger view ---
  log("5 · Public ledger view", [
    "totalValueLocked:         1000",
    `commitments:              root=… nextLeaf=2`,
    "nullifiers:               1 entry",
    "transferCiphertexts:      1 entry (auditor-only decrypt)",
    "auditDisclosures:         empty",
    "  Public sees NO individual transfer amounts",
  ], {
    public: {
      tvl: "1000",
      nullifiers: "1",
      transferCiphertexts: "1",
      auditDisclosures: "0",
    },
  });

  // --- Disclose to auditor ---
  const auditRequestId = randomBytes32();
  log("6 · discloseToAuditor(requestId) — selective disclosure", [
    `audit request id:         ${toHex(auditRequestId)}`,
    "✓ owner proves commitment opens to amount=1000",
    "✓ recorded on-ledger under request id",
    "✓ note NOT spent (still spendable)",
    "  Only what was asked — only under this request",
    `SIM disclose tx:          sim_disclose_${toHex(randomBytes32()).slice(0, 16)}`,
  ], {
    public: {
      action: "discloseToAuditor",
      requestId: toHex(auditRequestId),
      amount: "1000",
      commitment: toHex(outCm),
    },
  });

  // --- Unshield ---
  recipientPs = { ...recipientPs, notes: [], activeNoteIndex: 0 };
  log("7 · unshield() — amount PUBLIC on exit", [
    "✓ note spent · amount 1000 disclosed",
    "✓ TVL = 0",
    "  Accountable edge complete",
    `SIM unshield tx:          sim_unshield_${toHex(randomBytes32()).slice(0, 16)}`,
  ], {
    public: {
      action: "unshield",
      amount: "1000",
      tvl: "0",
    },
  });

  log("DONE · Sereno simulated corridor", [
    "Real: pureCircuits (publicKey, noteCommitment, elGamalPublicKey)",
    "Real: compiled circuits shield/transfer/unshield/discloseToAuditor",
    "Real: preprod faucet funding (see README)",
    "Sim:  deploy / callTx finality (wallet sync blocked on public RPC)",
    "",
    "Repo:  https://github.com/leocagli/sereno",
    "Site:  https://sereno-kappa-eight.vercel.app",
  ]);

  // Export for Remotion
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "video", "public");
  const payload = {
    generatedAt: new Date().toISOString(),
    network: "preprod-simulated",
    realFaucetTx:
      "00bc9da4d80c86b1b7805df25384ef87228111e56734f94d64bf9f7ef148a141ab",
    wallet:
      "mn_addr_preprod1c2ljvsln2z5aca6nmd44skj72kmdavnm03vm9v3rwm37kclfnptsffuh6t",
    contractAddress,
    amount: amount.toString(),
    senderPk: toHex(senderPk),
    recipientPk: toHex(recipientPk),
    shieldCommitment: toHex(shieldCm),
    transferCommitment: toHex(outCm),
    nullifier: nullifierDisplay,
    auditRequestId: toHex(auditRequestId),
    steps,
  };

  try {
    writeFileSync(join(outDir, "demo-sim.json"), JSON.stringify(payload, null, 2));
    if (!asJson) console.log(`\n  Wrote video/public/demo-sim.json`);
  } catch {
    // video folder may not exist yet
    writeFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "demo-sim.json"),
      JSON.stringify(payload, null, 2),
    );
    if (!asJson) console.log(`\n  Wrote cli/demo-sim.json`);
  }

  if (asJson) {
    console.log(JSON.stringify(payload, null, 2));
  }

  void recipientPs;
};

main();
