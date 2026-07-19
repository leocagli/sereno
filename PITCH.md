# PITCH — 2-minute video script (Sereno)

Target: ≤ 2:00. Name the hackathon in the first seconds; show the working demo; end with the repo.

## Second-by-second script

**0:00 – 0:10 — Cold open**
> "This is **Sereno**, built during the **MLH Midnight Hackathon**, July 2026 — a shielded remittance corridor that regulators can actually live with."

*On screen: Sereno + MLH Midnight Hackathon 2026. Sereno = the night watchman who called “y sereno” at midnight in Buenos Aires.*

**0:10 – 0:30 — Problem**
> "Latin American remittances force a bad choice: formal rails with total surveillance, or informal rails with zero compliance. Families shouldn't publish their finances to send money home, and regulators shouldn't accept a black box."

**0:30 – 1:10 — Live demo: shield and transfer**
> "Sereno is private in the middle and accountable at the edges. I **shield** funds — the deposit amount is public. Then I **transfer** to a recipient. The chain sees a commitment and a nullifier — no public amount, no linkable parties. The **auditor** alone can decrypt an in-circuit ElGamal ciphertext of that amount. Zerocash notes, on Midnight Compact."

*On screen: CLI shield → transfer → ledger (commitments, nullifiers, TVL; no public per-transfer amounts).*

**1:10 – 1:40 — Live demo: selective disclosure**
> "When a request lands, the note owner runs **discloseToAuditor** and proves in-circuit that their commitment opens to this exact amount — on ledger, under that request only. Accountable privacy, not a backdoor."

**1:40 – 1:55 — Why Midnight**
> "Compact gives us commitments, Merkle trees, and private witnesses as first-class primitives, with client-side proving."

**1:55 – 2:00 — Close**
> "Sereno: send money home, keep your privacy, keep the regulator satisfied. Repo is public — thanks!"

---

## Judging criteria bullets

**Technology**
1. Zerocash-style note lifecycle in one Compact contract.
2. Selective disclosure as a ZK circuit + continuous ElGamal to auditor on transfer.
3. Client-side proving against a local proof server.

**Originality**
1. Boundary design: public edges, private interior, dual auditor lanes.
2. Privacy Pools-style accountability on Midnight.
3. Sereno metaphor = Midnight + night watchman (auditor).

**Execution**
1. CLI: deploy, shield, transfer, unshield, disclose on preprod once funded.
2. Value conservation and double-spend prevention in-circuit.
3. Scope cut (CLI, note registry) to ship cryptographic core.

**Completion**
1. MVP circuits implemented: shield, transfer, unshield, discloseToAuditor, ElGamal lane.
2. Documented runbook (SETUP.md).
3. Roadmap honest: native shielded coins, splits — not hand-waved as done.

**Documentation**
1. README architecture + visibility table matching the contract.
2. SETUP.md Windows/WSL2 runbook.
3. Argentine Ley 27.739 / PSAV / UIF context without overclaiming approval.

**Business Value**
1. LatAm remittances: surveillance vs informality.
2. VASP reporting need → cryptographic answer path.
3. Same architecture for payroll / B2B / aid.
