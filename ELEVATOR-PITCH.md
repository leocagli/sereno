# Elevator pitch — Sereno

## 30 seconds (spoken)

Latin American remittances force a bad trade: **surveillance or the black market**.  
**Sereno** is a shielded corridor on **Midnight** — private transfers in the middle, public amounts only when money enters or leaves the pool, and a designated auditor who can decrypt transfer amounts or request an in-circuit note opening.  

Named for the night watchman of Buenos Aires who called *“¡…y sereno!”* at midnight: **order without turning on every light**.

## 10 seconds (one-liner)

**Sereno:** remittances that stay private by default and provable on request — built in Compact on Midnight.

## 60 seconds (judges / investors)

Families sending money home today choose between formal rails that log every amount and informal rails with zero compliance. Sereno is a Zerocash-style note pool on Midnight: `shield` and `unshield` make the edges accountable; `transfer` keeps the interior private to the public while encrypting amounts to a fixed auditor key with in-circuit ElGamal; `discloseToAuditor` lets a note owner prove an opening under a concrete request ID without spending the note.  

That maps to real LatAm regulation (e.g. Argentina Ley 27.739 / VASP reporting) without demanding a global viewing key for the whole world. We shipped the Compact contract (four circuits, compiled keys), a TypeScript CLI, a WSL/Windows runbook, and a live preprod-funded wallet with a public faucet transaction hash.
