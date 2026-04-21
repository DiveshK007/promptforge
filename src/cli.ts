#!/usr/bin/env node

import { generateProgram } from "./orchestrator";
import { scaffoldProject } from "./scaffolder";

// Simple chalk-like colors without ESM issues
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

async function main() {
  const prompt = process.argv.slice(2).join(" ");

  if (!prompt) {
    console.log(`
${bold("⚡ PromptForge")} — Natural Language → Solana Programs

${cyan("Usage:")}
  npx ts-node src/cli.ts "your program description here"

${cyan("Examples:")}
  npx ts-node src/cli.ts "Create a basic SPL token called MoonCoin with 9 decimals"
  npx ts-node src/cli.ts "Create a time-locked escrow that releases tokens after 7 days"
  npx ts-node src/cli.ts "Create a token with a 2% transfer fee sent to the creator"

${dim("Set ANTHROPIC_API_KEY environment variable before running.")}
`);
    process.exit(0);
  }

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(red("✗ ANTHROPIC_API_KEY not set. Export it first:"));
    console.error(dim("  export ANTHROPIC_API_KEY=sk-ant-..."));
    process.exit(1);
  }

  console.log(`\n${bold("⚡ PromptForge")}\n`);
  console.log(`${cyan("Prompt:")} "${prompt}"\n`);

  // Step 1: Generate
  console.log(`${yellow("▸")} Generating Anchor program...`);
  const startGen = Date.now();

  let result;
  try {
    result = await generateProgram(prompt);
  } catch (err: any) {
    console.error(red(`✗ Generation failed: ${err.message}`));
    process.exit(1);
  }

  const genTime = ((Date.now() - startGen) / 1000).toFixed(1);
  console.log(
    `${green("✓")} Generated ${bold(result.programName)} in ${genTime}s`
  );
  console.log(
    `${dim("  Templates used:")} ${result.selectedTemplates.join(", ")}`
  );
  console.log(`${dim("  Explanation:")} ${result.explanation}\n`);

  // Step 2: Scaffold
  console.log(`${yellow("▸")} Scaffolding Anchor project...`);
  const projectDir = scaffoldProject(result);
  console.log(`${green("✓")} Project created at ${cyan(projectDir)}\n`);

  // Step 3: Show the generated code
  console.log(`${bold("━━━ Generated lib.rs ━━━")}\n`);
  console.log(dim(result.anchorCode));
  console.log(`\n${bold("━━━━━━━━━━━━━━━━━━━━━━━")}\n`);

  // Step 4: Next steps
  console.log(`${bold("Next steps:")}`);
  console.log(`  1. ${cyan(`cd ${projectDir}`)}`);
  console.log(`  2. ${cyan("anchor build")} ${dim("(compile the program)")}`);
  console.log(
    `  3. ${cyan("anchor deploy --provider.cluster devnet")} ${dim("(deploy to devnet)")}`
  );
  console.log(
    `  4. ${dim("View on explorer:")} ${cyan("https://explorer.solana.com/address/<PROGRAM_ID>?cluster=devnet")}\n`
  );
}

main().catch((err) => {
  console.error(red(`\nFatal error: ${err.message}`));
  process.exit(1);
});
