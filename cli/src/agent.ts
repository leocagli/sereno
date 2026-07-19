// Sereno Agent (Option A) — privacy-preserving tool-using agent for dual DeFi + AI track.
//
// Usage:
//   npm run agent              # interactive REPL
//   npm run agent -- --demo    # scripted conversation for video / judges
//
// Privacy policy: tools never return secret keys or note preimages.
// PureCircuits are real; callTx path is simulated (see demo-sim).

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { TOOL_CATALOG, resetCorridor, routeIntent, runTool, type ToolResult } from "./agent-tools.js";

const DIV = "──────────────────────────────────────────────────────────────";
const BANNER = `
${DIV}
  SERENO AGENT · privacy-preserving corridor operator
  Tracks: DeFi (Compact notes) + AI (tools without exposing secrets)
${DIV}
  Policy: never prints secret keys · only public ledger + explicit disclosures
  Mode:   simulated callTx · REAL pureCircuits · REAL preprod faucet proof
${DIV}
`;

function printResult(r: ToolResult): void {
  const icon = r.ok ? "✓" : "✗";
  console.log(`\n  ${icon} tool:${r.tool}`);
  console.log(`  ${r.message}`);
  const keys = Object.keys(r.public);
  if (keys.length) {
    console.log("  public payload:");
    for (const k of keys) {
      const v = r.public[k];
      console.log(`    ${k}: ${typeof v === "string" && v.length > 72 ? v.slice(0, 64) + "…" : v}`);
    }
  }
}

function printHelp(): void {
  console.log("\n  Commands:");
  console.log("    natural language  →  agent routes to a tool (ES/EN)");
  console.log("    /tools            →  list tools");
  console.log("    /demo             →  run scripted dual-track demo");
  console.log("    /reset            →  fresh corridor state");
  console.log("    /quit             →  exit");
  console.log("\n  Examples:");
  console.log('    "deploy the corridor"');
  console.log('    "shield 1000"');
  console.log('    "transfer to recipient"');
  console.log('    "audit request on the note"');
  console.log('    "show public ledger"');
  console.log('    "show faucet proof"');
}

async function handleLine(line: string): Promise<boolean> {
  const trimmed = line.trim();
  if (!trimmed) return true;

  if (trimmed === "/quit" || trimmed === "/exit") return false;
  if (trimmed === "/help") {
    printHelp();
    return true;
  }
  if (trimmed === "/tools") {
    printResult(runTool("list_tools"));
    console.log("\n  Catalog:");
    for (const t of TOOL_CATALOG) {
      console.log(`    · ${t.name} — ${t.description}`);
    }
    return true;
  }
  if (trimmed === "/reset") {
    resetCorridor();
    console.log("  Corridor state reset.");
    return true;
  }
  if (trimmed === "/demo") {
    await runDemo();
    return true;
  }

  // Explicit tool:  tool:name key=value key=value
  if (trimmed.startsWith("tool:")) {
    const body = trimmed.slice(5).trim();
    const [toolName, ...rest] = body.split(/\s+/);
    const args: Record<string, string> = {};
    for (const part of rest) {
      const eq = part.indexOf("=");
      if (eq > 0) args[part.slice(0, eq)] = part.slice(eq + 1);
    }
    console.log(`\n  → calling ${toolName}(${JSON.stringify(args)})`);
    printResult(runTool(toolName ?? "list_tools", args));
    return true;
  }

  const routed = routeIntent(trimmed);
  console.log(`\n  → intent → ${routed.tool}(${JSON.stringify(routed.args)})`);
  printResult(runTool(routed.tool, routed.args));
  return true;
}

async function runDemo(): Promise<void> {
  console.log(`\n${DIV}`);
  console.log("  DEMO · dual-track script (DeFi + AI agent)");
  console.log(DIV);

  const turns: { user: string; note: string }[] = [
    {
      user: "list tools and privacy policy",
      note: "AI agent exposes tools only — no raw private state",
    },
    {
      user: "show faucet proof",
      note: "DeFi: real preprod funding artifact",
    },
    {
      user: "deploy the corridor",
      note: "DeFi: Sereno contract with sealed auditor",
    },
    {
      user: "shield 1000",
      note: "DeFi: accountable edge — amount PUBLIC on entry",
    },
    {
      user: "transfer to recipient",
      note: "DeFi: private interior + ElGamal to auditor",
    },
    {
      user: "show public ledger",
      note: "AI sees only public fields (TVL, counts) — not amounts of transfer",
    },
    {
      user: "compliance audit request on the note",
      note: "AI + DeFi: selective discloseToAuditor without spending",
    },
    {
      user: "unshield",
      note: "DeFi: accountable edge on exit",
    },
  ];

  resetCorridor();
  for (const turn of turns) {
    console.log(`\n  user> ${turn.user}`);
    console.log(`  (${turn.note})`);
    await handleLine(turn.user);
  }

  console.log(`\n${DIV}`);
  console.log("  DEMO complete.");
  console.log("  DeFi: shield/transfer/unshield/disclose corridor semantics");
  console.log("  AI:   agent operated only via tools; secrets never returned");
  console.log(DIV);
}

async function main(): Promise<void> {
  const demo = process.argv.includes("--demo");
  console.log(BANNER);

  if (demo) {
    await runDemo();
    process.exit(0);
  }

  printHelp();
  const rl = createInterface({ input, output, terminal: true });
  try {
    for (;;) {
      const line = await rl.question("\nagent> ");
      const cont = await handleLine(line);
      if (!cont) break;
    }
  } finally {
    rl.close();
  }
  console.log("  Bye.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exit(1);
});
