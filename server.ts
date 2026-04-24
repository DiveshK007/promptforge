import express, { Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { generateProgram } from "./src/orchestrator";
import { scaffoldProject } from "./src/scaffolder";

const app = express();
app.use(express.json());

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

app.options("/api/generate", (_req, res) => {
  res.set(corsHeaders).status(204).end();
});

app.post("/api/generate", async (req: Request, res: Response) => {
  const prompt: string = req.body?.prompt ?? "";

  if (!prompt.trim()) {
    res.set(corsHeaders).status(400).json({ error: "prompt is required" });
    return;
  }

  const keypairJson = process.env.SOLANA_KEYPAIR_JSON;
  const keypairPath = keypairJson
    ? "/tmp/solana-keypair.json"
    : "/Users/bond/.config/solana/apex-bot-devnet.json";

  if (keypairJson) {
    fs.writeFileSync("/tmp/solana-keypair.json", keypairJson, { mode: 0o600 });
  }

  res.set({
    ...corsHeaders,
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Transfer-Encoding": "chunked",
  });

  const send = (event: object) => res.write(JSON.stringify(event) + "\n");

  try {
    // ── Generate ────────────────────────────────────────────────────────────
    const result = await generateProgram(prompt);
    send({
      type: "generate",
      data: {
        programName: result.programName,
        templates: result.selectedTemplates,
        explanation: result.explanation,
      },
    });

    // ── Scaffold ─────────────────────────────────────────────────────────────
    const outputBase = process.env.RAILWAY_ENVIRONMENT || process.env.RENDER
      ? "/tmp/promptforge-output"
      : path.join(process.cwd(), "output");
    const projectDir = scaffoldProject(result, path.join(outputBase, result.programName));

    // ── Build ─────────────────────────────────────────────────────────────────
    const buildStart = Date.now();
    await new Promise<void>((resolve, reject) => {
      const child = spawn("cargo", ["build-sbf"], {
        cwd: projectDir,
        stdio: ["ignore", "pipe", "pipe"],
      });

      child.stdout.on("data", (chunk: Buffer) => {
        send({ type: "build_log", data: chunk.toString() });
      });

      child.stderr.on("data", (chunk: Buffer) => {
        send({ type: "build_log", data: chunk.toString() });
      });

      child.on("close", (code) => {
        if (code !== 0) reject(new Error(`cargo build-sbf exited with code ${code}`));
        else resolve();
      });

      child.on("error", (err) => reject(err));
    });

    send({
      type: "build_done",
      data: { duration: `${((Date.now() - buildStart) / 1000).toFixed(1)}s` },
    });

    // ── Balance check (non-blocking) ──────────────────────────────────────────
    try {
      const balOut = await new Promise<string>((resolve) => {
        const child = spawn(
          "solana",
          ["balance", "--url", "devnet", "--keypair", keypairPath],
          {
            stdio: ["ignore", "pipe", "pipe"],
            env: { ...process.env, HOME: process.env.HOME ?? "/root" },
          }
        );
        let out = "";
        child.stdout.on("data", (c: Buffer) => { out += c.toString(); });
        child.stderr.on("data", (c: Buffer) => { out += c.toString(); });
        child.on("close", () => resolve(out));
        child.on("error", () => resolve(""));
      });
      const balMatch = balOut.match(/([0-9.]+)\s*SOL/);
      if (balMatch && parseFloat(balMatch[1]) < 2) {
        send({ type: "balance_warning", data: balMatch[1].trim() });
      }
    } catch {
      // non-fatal
    }

    // ── Deploy ────────────────────────────────────────────────────────────────
    const soName = result.programName.replace(/-/g, "_");
    const soPath = path.join(projectDir, "target", "deploy", `${soName}.so`);

    let deployOut = "";
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        "solana",
        [
          "program", "deploy", soPath,
          "--url", "devnet",
          "--keypair", keypairPath,
        ],
        {
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env, HOME: process.env.HOME ?? "/root" },
        }
      );

      child.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        deployOut += text;
        send({ type: "build_log", data: text });
      });

      child.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        deployOut += text;
        send({ type: "build_log", data: text });
      });

      child.on("close", (code) => {
        if (code !== 0) reject(new Error(`solana program deploy exited with code ${code}`));
        else resolve();
      });

      child.on("error", (err) => reject(err));
    });

    const match = deployOut.match(/Program Id:\s*([1-9A-HJ-NP-Za-km-z]{32,44})/);
    if (!match) {
      throw new Error("Deploy succeeded but could not parse Program ID from output");
    }
    const programId = match[1];

    send({
      type: "deploy_done",
      data: {
        programId,
        explorerUrl: `https://explorer.solana.com/address/${programId}?cluster=devnet`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    send({ type: "error", data: msg });
  }

  res.end();
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;
app.listen(port, () => {
  console.log(`PromptForge server listening on port ${port}`);
});
