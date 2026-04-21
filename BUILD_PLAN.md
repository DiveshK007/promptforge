# PromptForge — 21-Day Solo Build Plan

**Builder**: Divesh Kumar (solo)
**Start**: Apr 20, 2026
**Deadline**: May 11, 2026 (21 days)
**Daily budget**: ~4–5 hours
**Total build hours**: ~90–100 hours

---

## Week 1: Core Pipeline (Apr 20–26)

The goal this week is ONE thing: type English → get a deployed program on devnet.

### Day 1 (Apr 20) — TODAY
- [x] Git init
- [x] Colosseum registration
- [ ] Push README.md
- [ ] Set up project: `npm init`, install typescript, ts-node
- [ ] Create `/templates` folder with first template: `spl-token-basic`
- [ ] Write the orchestrator skeleton: takes prompt → calls Claude API → returns Anchor code
- [ ] **End-of-day goal**: Run `npx ts-node src/cli.ts "create a basic SPL token"` and see generated Anchor code printed to terminal

### Day 2 (Apr 21)
- [ ] Add template: `spl-token-fee` (Token-2022 with transfer fee extension)
- [ ] Add template: `escrow` (two-party with timelock)
- [ ] Build the Anchor project generator: takes generated code → writes to temp dir → creates full Anchor project structure (Anchor.toml, Cargo.toml, lib.rs, tests/)
- [ ] **End-of-day goal**: Generated Anchor project compiles with `anchor build` locally

### Day 3 (Apr 22)
- [ ] Dockerize the build step (cargo build-sbf in a container so it works on any machine)
- [ ] Add devnet deployment: `solana program deploy` with a funded devnet keypair
- [ ] Return Solana Explorer link after deploy
- [ ] **End-of-day goal**: Full CLI pipeline works end-to-end — prompt in, explorer link out

### Day 4 (Apr 23)
- [ ] Add template: `vesting` (linear unlock schedule)
- [ ] Add template: `vault` (deposit/withdraw)
- [ ] Add template: `payments` (payment splitter — needed for Superteam India Payments side track)
- [ ] Improve prompt decomposition: multi-template composition (e.g., "token with vesting" = spl-token + vesting)
- [ ] **End-of-day goal**: 6 templates working, multi-template composition working

### Day 5 (Apr 24) — PIVOT GATE
- [ ] Add template: `staking` and `dao-voting`
- [ ] Test all 8 templates end-to-end (prompt → deploy)
- [ ] Record rough 60-second demo of CLI working
- [ ] **DECISION**: If pipeline works for ≥5 templates → proceed. If stuck → pivot to PaperMint.

### Day 6–7 (Apr 25–26)
- [ ] Start Next.js frontend: Monaco editor + API route
- [ ] Streaming output (show cargo build logs in real-time)
- [ ] Basic dark theme UI — terminal aesthetic
- [ ] **End-of-week goal**: Web UI where you type a prompt, see code generate, see build logs stream, get explorer link

---

## Week 2: UI + Integrations (Apr 27 – May 3)

### Day 8–9 (Apr 27–28)
- [ ] Phantom wallet integration: "Connect Wallet" button, use connected wallet as program authority
- [ ] Post-deploy interaction panel: after deploying, show the program's IDL and let users call instructions directly from the UI
- [ ] Mobile-responsive layout

### Day 10–11 (Apr 29–30)
- [ ] **Umbra integration** (for $10k side track): Add "confidential token" template using Umbra Privacy SDK
- [ ] **SNS integration** (for $5k side track): Option to register deployed program under a .sol domain
- [ ] Deploy history: show all programs you've deployed in this session

### Day 12–13 (May 1–2)
- [ ] **Payments template polish** (for $10k Superteam India Dodo side track): Ensure payment-related templates work flawlessly, add Dodo Payments-specific template if their SDK requirements are clear
- [ ] Error handling + retry logic (build failures, deploy failures, insufficient SOL)
- [ ] Auto-airdrop devnet SOL if wallet is empty
- [ ] Add "Fork & Edit" — click to open generated code in Monaco, edit, re-build, re-deploy

### Day 14 (May 3)
- [ ] **Deploy to Vercel** — public URL
- [ ] First real-user test (share link with Superteam India friends, Blockchain Club members)
- [ ] Collect feedback, fix top 3 bugs
- [ ] **End-of-week goal**: Public URL that anyone can use to deploy Solana programs from English

---

## Week 3: Polish + Submission (May 4–11)

### Day 15–16 (May 4–5)
- [ ] Landing page: hero section explaining what PromptForge does, with embedded demo GIF
- [ ] "Gallery" page: showcase programs deployed by users (anonymized)
- [ ] Add 100xDevs branding/mention if their track requires it
- [ ] Open-source cleanup: LICENSE, CONTRIBUTING.md, code comments

### Day 17–18 (May 6–7)
- [ ] **Record pitch video** (2–3 min):
  - Open with IEEE paper on screen: "I published this research. Today I'm showing you the product."
  - Live demo: type prompt → watch code generate → watch build → deployed → interact via Phantom
  - Close with: monetization (free devnet / paid mainnet via micropayments), traction (N programs deployed during hackathon), team (solo CIT university builder)
- [ ] **Record technical demo** (3–5 min):
  - Architecture walkthrough
  - Template composition system
  - Multi-template generation
  - Error handling + edge cases

### Day 19 (May 8)
- [ ] Write submission document for Colosseum
- [ ] Submit to Superteam Earn side tracks:
  - Superteam India Payments Track
  - 100xDevs Track
  - Umbra Side Track
  - SNS Identity Track (if integrated)
  - Jupiter Track (if integrated)

### Day 20 (May 9)
- [ ] Final bug fixes from any feedback
- [ ] Weekly update video #3 (optional but increases visibility)
- [ ] Prep GitHub repo: clean commit history, remove any API keys, add .env.example

### Day 21 (May 10) — SUBMISSION DAY
- [ ] Final submission on Colosseum platform before May 11 deadline
- [ ] Verify all side track submissions on Superteam Earn
- [ ] Post announcement on X tagging @colosseum @SuperteamIN @solaborantes
- [ ] **Ship it. 🚀**

---

## Weekly Video Updates (optional but high-ROI)

- **Week 1 (Apr 26)**: "Built the core pipeline — watch me deploy a Solana program from English in 60 seconds" (CLI demo)
- **Week 2 (May 3)**: "PromptForge now has a web UI — try it yourself" (share Vercel link)
- **Week 3 (May 10)**: "Final submission — here's what PromptForge can do" (polished demo)

Post these on X and in the Colosseum Discord #showcase channel.

---

## Risk Mitigation

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| LLM generates broken Anchor code | High | Template library constrains generation; cargo build catches errors; retry with error context |
| Docker build too slow | Medium | Pre-build base image with Solana toolchain; cache cargo registry |
| Devnet rate limits | Low | Use multiple RPC endpoints (Helius, QuickNode free tier) |
| Scope creep | High | Stick to the plan. No new features after May 6. |
| Burnout (solo, 21 days) | Medium | 4–5 hr/day max. Skip days if needed. Week 3 is polish, not new features. |
