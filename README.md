# PromptForge

**Anchor scaffolding infrastructure with verified compilation.**

> *PromptForge is the Vercel of Solana programs — type what you want, get a compiled Anchor program deployed to devnet in 60 seconds.*

No hallucinated APIs. No broken builds. Every output is a real `.so` file that passed `anchor build`.

> *"Operationalizing the ZETA Framework — from IEEE research paper to shipping product."*

## The Research Foundation

This project operationalizes concepts from the **ZETA Framework** ([IEEE ICOSEC 2025, pp. 1777–1783](https://ieeexplore.ieee.org/)), a published research paper on zero-shot task automation using foundation language models. ZETA demonstrated that hierarchical planning with LLMs can decompose complex tasks into executable sub-steps without prior training. PromptForge applies this to Solana program development: decomposing natural-language specifications into composable Anchor patterns, compiling them with `anchor build`, and deploying the resulting bytecode — all autonomously.

The key insight: use LLMs for **decomposition and composition**, not for writing raw Anchor code from scratch. The template library is the safety net that keeps compilation deterministic.

## How It Works

```
"Create a token vesting schedule with a 6-month cliff"
                          ↓
        PromptForge decomposes the spec (ZETA)
                          ↓
      Selects + composes from template library
                          ↓
         Generates complete Anchor.toml project
                          ↓
               anchor build  ← verified here
                          ↓
       solana program deploy --provider.cluster devnet
                          ↓
        Live on devnet. Explorer link returned.
```

The build step is not optional. If `anchor build` fails, PromptForge reports the compiler errors and exits — it never returns an uncompilable program.

## Quick Start

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...
npx ts-node src/cli.ts "Create a payment splitter with 3 recipients"
```

The terminal streams the full `anchor build` log in real time. You see the compilation succeed before you see the generated code.

## Template Library

PromptForge doesn't write Anchor code from scratch. It selects and composes from a library of hand-written, anchor-lang 0.30.1 templates:

| Template | Description |
|----------|-------------|
| `spl-token-basic` | Standard SPL token — mint, transfer, burn |
| `escrow` | Two-party time-locked escrow |
| `vesting` | Linear unlock schedule with configurable cliff |
| `vault` | Per-user deposit/withdraw vault |
| `payments` | Payment splitter, up to 5 recipients, basis-point shares |

Each template compiles standalone. Composition merges them into a single `lib.rs`. The LLM never invents an Anchor API — it only fills in parameters and wires templates together.

## Architecture

```
┌─────────────────────────────────────────┐
│           Orchestrator (Claude API)     │
│                                         │
│  1. Parse natural language spec         │
│  2. Select templates from library       │
│  3. Compose + parameterize lib.rs       │
│  4. Scaffold full Anchor project        │
│  5. anchor build  (verified compile)    │
│  6. solana program deploy (devnet)      │
│  7. Return program ID + explorer link   │
└─────────────────────────────────────────┘
```

## Built For

- **Solana Frontier Hackathon 2026** — Colosseum (Infrastructure Track)
- **Superteam India Payments Track** — payments template targets this directly

## Builder

**Divesh Kumar** — AI Developer Intern @ BSAP Inc. | Blockchain Research Associate @ CoE Blockchain CIT | IEEE-published researcher

- GitHub: [@DiveshK007](https://github.com/DiveshK007)
- LinkedIn: [diveshk007](https://linkedin.com/in/diveshk007)
- Superteam: [divzzzoo7](https://superteam.fun/earn/t/divzzzoo7)

## License

MIT
