import { NextRequest } from "next/server";
import { generateProgram } from "@/src/orchestrator";
import { scaffoldProject } from "@/src/scaffolder";
import { spawn } from "child_process";
import * as path from "path";

export const runtime = "nodejs";

function encode(controller: ReadableStreamDefaultController, enc: TextEncoder, event: object) {
  controller.enqueue(enc.encode(JSON.stringify(event) + "\n"));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const prompt: string = body?.prompt ?? "";

  if (!prompt.trim()) {
    return new Response(JSON.stringify({ error: "prompt is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => encode(controller, enc, event);

      try {
        // ── Generate ──────────────────────────────────────────────────────────
        const result = await generateProgram(prompt);
        send({
          type: "generate",
          data: {
            programName: result.programName,
            templates: result.selectedTemplates,
            explanation: result.explanation,
          },
        });

        // ── Scaffold ──────────────────────────────────────────────────────────
        const projectDir = scaffoldProject(result);

        // ── Build ─────────────────────────────────────────────────────────────
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

        // ── Deploy ────────────────────────────────────────────────────────────
        const soName = result.programName.replace(/-/g, "_");
        const soPath = path.join(projectDir, "target", "deploy", `${soName}.so`);

        let deployOut = "";
        await new Promise<void>((resolve, reject) => {
          const child = spawn("solana", ["program", "deploy", soPath, "--url", "devnet"], {
            stdio: ["ignore", "pipe", "pipe"],
          });

          child.stdout.on("data", (chunk: Buffer) => {
            deployOut += chunk.toString();
          });

          child.stderr.on("data", (chunk: Buffer) => {
            deployOut += chunk.toString();
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

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
