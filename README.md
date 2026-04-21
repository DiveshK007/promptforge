# PromptForge 🔨⚡

**Describe a Solana program in plain English. Deploy it to devnet in 60 seconds.**

PromptForge is a natural-language-to-Anchor IDE that turns English descriptions into fully deployed Solana programs — with generated tests, an explorer link, and a Phantom wallet button to interact with your program instantly.

> *"Operationalizing the ZETA Framework — from IEEE research paper to shipping product."*

## The Research Foundation

This project operationalizes concepts from the **ZETA Framework** ([IEEE ICOSEC 2025, pp. 1777–1783](https://ieeexplore.ieee.org/)), a published research paper on zero-shot task automation using foundation language models. ZETA demonstrated that hierarchical planning with LLMs can decompose complex tasks into executable sub-steps without prior training. PromptForge applies this principle to Solana program development — decomposing natural-language specifications into composable Anchor program patterns, then building and deploying them autonomously.

## How It Works

```
"Create a token with a 2% transfer fee, sending fees to my wallet"
                              ↓
              PromptForge decomposes the spec
                              ↓
            Selects from composable template library
                              ↓
              Generates complete Anchor project
                              ↓
                    cargo build-sbf
                              ↓
                  solana program deploy
                              ↓
              Live on devnet in ~60 seconds
              Explorer link + Phantom connect
```

## Quick Start

```bash
# Install dependencies
npm install

# Set your API key
export ANTHROPIC_API_KEY=your_key_here

# Run the CLI
npx ts-node src/cli.ts "Create an SPL token with a 2% transfer fee"

# Or start the web UI
npm run dev
```

## Template Library

PromptForge doesn't hallucinate code from scratch. It composes from a curated library of battle-tested Anchor patterns:

| Template | Description |
|----------|-------------|
| `spl-token-basic` | Standard SPL token mint + transfer |
| `spl-token-fee` | Token with transfer fee extension (Token-2022) |
| `escrow` | Two-party escrow with timelock |
| `vesting` | Linear token vesting schedule |
| `vault` | Deposit/withdraw vault with authority |
| `staking` | Single-asset staking with rewards |
| `payments` | Payment splitter with configurable recipients |
| `dao-voting` | Simple proposal + vote system |

More templates are added continuously. Each template is individually tested and audited for common vulnerabilities.

## Architecture

```
┌─────────────────────────────────────────┐
│              Web UI (Next.js)           │
│  Monaco Editor │ Stream Output │ Wallet │
└──────────────────┬──────────────────────┘
                   │ API
┌──────────────────▼──────────────────────┐
│           Orchestrator (Node.js)        │
│                                         │
│  1. Parse natural language spec         │
│  2. Select + compose templates          │
│  3. Generate Anchor project             │
│  4. cargo build-sbf (Docker)            │
│  5. solana program deploy (devnet)      │
│  6. Return explorer link + IDL          │
└─────────────────────────────────────────┘
```

## Built For

- **Solana Frontier Hackathon 2026** — Colosseum
- **University Award Track** — Chennai Institute of Technology (CIT), B.Tech CSE

## Builder

**Divesh Kumar** — AI Developer Intern @ BSAP Inc. | Blockchain Research Associate @ CoE Blockchain CIT | IEEE-published researcher

- GitHub: [@DiveshK007](https://github.com/DiveshK007)
- LinkedIn: [diveshk007](https://linkedin.com/in/diveshk007)
- Superteam: [divzzzoo7](https://superteam.fun/earn/t/divzzzoo7)

## License

MIT
