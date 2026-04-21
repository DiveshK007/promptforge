# PromptForge — Positioning

## What This Is

PromptForge is **Anchor scaffolding infrastructure with verified compilation**. It accepts a natural-language description of a Solana program, selects and composes from a curated template library, generates a complete Anchor project, compiles it with `anchor build`, and deploys the `.so` bytecode to devnet.

It is not an AI chat assistant. It is not a no-code visual builder. It is an automated scaffolding pipeline — the Vercel deploy button, but for Anchor programs.

## Target User

**Solana developers** who already know what an Anchor program is and want to stop writing boilerplate.

They understand Rust and Anchor. They know what a PDA is. They're frustrated that standing up a new program — vesting schedule, escrow, payment splitter — takes hours of scaffolding before they can write the interesting part. PromptForge eliminates that.

This is explicitly **not** targeting non-technical founders or Web2 developers who have never seen Rust. That positioning has been tried repeatedly in the Colosseum ecosystem (at least 7 prior projects) and has never won. The judges are infrastructure-literate and can smell an unshippable demo.

## Hackathon Track

**Infrastructure** — not AI.

The AI track at Breakout and Cypherpunk is where NL-to-Anchor projects go to lose. Every prior attempt entered AI and received no prize. The winning developer tooling projects (txtx: Radar Infrastructure 1st; idl-space: Breakout Public Goods; opensol: Breakout University Award) all entered Infrastructure. PromptForge belongs there: it's a build pipeline, not a chatbot.

Secondary target: **Superteam India Payments Track** — the `payments` template (payment splitter with basis-point shares) is a direct submission for this side track.

## The Three Differentiators

**1. Template library — not raw LLM generation.**
Every prior NL-to-Anchor project sends the user's description to an LLM and hopes it produces valid Anchor code. It doesn't — the models hallucinate struct fields, nonexistent CPI methods, and wrong account constraints. PromptForge uses the LLM only for decomposition and composition: which templates, which parameters. The actual Anchor code comes from hand-written, individually compiled templates. The LLM cannot invent an API that doesn't exist.

**2. Verified compilation — `anchor build` is mandatory.**
The pipeline fails loudly if `anchor build` fails. It never returns a program that doesn't compile. This is the proof-of-work that distinguishes PromptForge from every competitor: the demo shows a real build log streaming to the terminal, not just code appearing in an editor. The `.so` file exists. The program ID resolves on devnet.

**3. Multi-template composition.**
A request for "a token with a vesting schedule" produces a single compilable `lib.rs` that merges both templates — not two separate programs. The orchestrator uses the ZETA decomposition approach to identify which templates satisfy the spec, then wires their accounts and instructions together. No prior project in this space has demonstrated this.

## The Demo Script

Lead with the build log. Open the terminal, run:

```
npx ts-node src/cli.ts "Create a payment splitter for 3 recipients — 50%, 30%, 20%"
```

Let the audience watch `anchor build` stream in real time. The moment the build succeeds is the demo moment. Then scroll up to show the generated `lib.rs`.

The pitch to judges: *"Every prior project in this space showed you generated code. We show you a compiled program. The difference is everything."*

## What Not To Say

- "No-code for non-technical founders" — wrong user, wrong track, wrong signal
- "AI IDE" — frames it as a chat tool, not infrastructure
- "Automatically generates Anchor code" — invites skepticism about hallucination
- "Any developer can build Solana programs" — too broad, sounds like a tutorial

## Research Backing

The ZETA Framework (IEEE ICOSEC 2025, pp. 1777–1783) provides the theoretical foundation for the decomposition step: LLMs as hierarchical planners that map high-level intent to executable sub-tasks without task-specific training. PromptForge operationalizes this specifically for Solana program scaffolding. This gives the submission a published research citation that no competitor has.

Open with the paper. Close with the build log.
