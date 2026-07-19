# SETUP — Midnight development on Windows 11 (Sereno)

Runbook for building and running **Sereno** on Windows 11. Verified against [docs.midnight.network](https://docs.midnight.network) on **2026-07-18**. Unconfirmed items are flagged.

> **Network note.** Current docs use **preprod**, **preview**, and **mainnet**. The faucet dispenses **tNIGHT**; **DUST** for fees is generated after registering NIGHT UTXOs (the Sereno CLI does this automatically after funding). This project targets **preprod**.

## 1. Compact compiler — WSL2 required

No native Windows binary. Install inside WSL:

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
source ~/.local/bin/env   # installer may put binary in ~/.local/bin
compact update
compact --version
compact compile --version
```

Do **not** use Git Bash for linux-musl binaries.

## 2. Proof server (Docker)

```powershell
docker run -d -p 6300:6300 --name midnight-proof-server `
  midnightntwrk/proof-server:latest midnight-proof-server -v
```

## 3. Node

Prefer Node **≥ 24.11.1** inside WSL (covers counter + hello-world docs).

```bash
# example with nvm
nvm install 24.11.1 && nvm use 24.11.1
```

## 4. Endpoints (match `cli/src/config.ts`)

| What | URL |
|---|---|
| Node RPC | `https://rpc.preprod.midnight.network` |
| Indexer GraphQL | `https://indexer.preprod.midnight.network/api/v3/graphql` |
| Indexer WS | `wss://indexer.preprod.midnight.network/api/v3/graphql/ws` |
| Faucet (tNIGHT) | `https://faucet.preprod.midnight.network/` |
| Proof server (local) | `http://127.0.0.1:6300` |

Paste the CLI’s **unshielded** bech32 address into the faucet (not the shielded address).

## 5. Sereno build loop

```bash
# Prefer repo under the WSL filesystem for performance; /mnt/c works for compile.
cd /mnt/c/Users/usuario/sereno/contract   # or ~/sereno/contract
export PATH="$HOME/.local/bin:/root/.local/bin:$PATH"
npm install
npm run build

cd ../cli
npm install
npm run build
npm run start    # default = preprod (testnet alias)
```

Wallet seed: generate once:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save the 64 hex chars. On start the CLI prints the unshielded address → fund faucet → wait for DUST registration → menu.

### Menu

1 Deploy · 2 Join · 3 Shield · 4 Transfer · 5 Receive note · 6 Unshield · 7 Disclose · 8 Ledger · 9 Private state · 0 Exit

## 6. Windows gotchas

- Run `compact` **inside WSL**, not PowerShell.
- Docker Desktop: WSL2 engine + integration for your distro.
- Proof server on 6300 is reachable from WSL and from Windows Lace via localhost forwarding.
- Prefer `git config core.autocrlf false` in WSL for `.compact` files.

## Sources

[installation](https://docs.midnight.network/getting-started/installation) · [counter-cli](https://docs.midnight.network/tutorials/counter/counter-cli) · [faucet](https://docs.midnight.network/develop/tutorial/using/faucet) · [compact releases](https://github.com/midnightntwrk/compact/releases/latest)
