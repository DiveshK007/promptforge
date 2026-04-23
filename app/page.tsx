"use client";

import { useRef, useState } from "react";

type Status = "pending" | "running" | "done" | "failed";

interface GenerateData {
  programName: string;
  templates: string[];
  explanation: string;
}

interface DeployData {
  programId: string;
  explorerUrl: string;
}

function StatusDot({ status }: { status: Status }) {
  const cls =
    status === "pending"
      ? "dot dot-pending"
      : status === "running"
      ? "dot dot-running"
      : status === "done"
      ? "dot dot-done"
      : "dot dot-failed";
  return <span className={cls} />;
}

function PanelHeader({
  title,
  status,
}: {
  title: string;
  status: Status;
}) {
  return (
    <div className="panel-header">
      <StatusDot status={status} />
      {title}
    </div>
  );
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [showPanels, setShowPanels] = useState(false);

  const [genStatus, setGenStatus] = useState<Status>("pending");
  const [genData, setGenData] = useState<GenerateData | null>(null);

  const [buildStatus, setBuildStatus] = useState<Status>("pending");
  const [buildLogs, setBuildLogs] = useState("");
  const [buildDuration, setBuildDuration] = useState("");

  const [deployStatus, setDeployStatus] = useState<Status>("pending");
  const [deployData, setDeployData] = useState<DeployData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const logRef = useRef<HTMLDivElement>(null);

  function resetState() {
    setGenStatus("pending");
    setGenData(null);
    setBuildStatus("pending");
    setBuildLogs("");
    setBuildDuration("");
    setDeployStatus("pending");
    setDeployData(null);
    setErrorMsg("");
  }

  function appendLog(chunk: string) {
    setBuildLogs((prev) => prev + chunk);
    requestAnimationFrame(() => {
      if (logRef.current) {
        logRef.current.scrollTop = logRef.current.scrollHeight;
      }
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || running) return;

    setRunning(true);
    setShowPanels(true);
    resetState();
    setGenStatus("running");

    let phase: "generate" | "build" | "deploy" = "generate";

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            type: string;
            data: unknown;
          };

          if (event.type === "generate") {
            const d = event.data as GenerateData;
            setGenStatus("done");
            setGenData(d);
            phase = "build";
            setBuildStatus("running");
          } else if (event.type === "build_log") {
            appendLog(event.data as string);
          } else if (event.type === "build_done") {
            const d = event.data as { duration: string };
            setBuildStatus("done");
            setBuildDuration(d.duration);
            phase = "deploy";
            setDeployStatus("running");
          } else if (event.type === "deploy_done") {
            const d = event.data as DeployData;
            setDeployStatus("done");
            setDeployData(d);
          } else if (event.type === "error") {
            const msg = event.data as string;
            setErrorMsg(msg);
            if (phase === "generate") setGenStatus("failed");
            else if (phase === "build") setBuildStatus("failed");
            else setDeployStatus("failed");
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      if (phase === "generate") setGenStatus("failed");
      else if (phase === "build") setBuildStatus("failed");
      else setDeployStatus("failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main>
      <div className="container">
        {/* Top bar */}
        <header className="topbar">
          <span className="topbar-logo">⚡ PromptForge</span>
          <div className="topbar-right">
            <span className="topbar-tagline">Vercel of Solana programs</span>
            <a
              className="topbar-link"
              href="https://github.com/DiveshK007/promptforge"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub ↗
            </a>
          </div>
        </header>

        {/* Hero input */}
        <section className="hero">
          <span className="hero-label">Anchor scaffolding · verified compilation · devnet deploy</span>
          <form
            onSubmit={handleSubmit}
            style={{ width: "100%", maxWidth: 680, display: "flex", flexDirection: "column", gap: 12 }}
          >
            <textarea
              className="textarea"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your Solana program in plain English..."
              disabled={running}
              rows={3}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSubmit(e as unknown as React.FormEvent);
                }
              }}
            />
            <div className="hero-actions">
              <button className="submit-btn" type="submit" disabled={running || !prompt.trim()}>
                {running ? "Building…" : "Deploy →"}
              </button>
            </div>
          </form>
        </section>

        {/* Output panels */}
        {showPanels && (
          <div className="panels-wrap">
            <div className="panels">
              {/* Generate panel */}
              <div className="panel">
                <PanelHeader title="Generate" status={genStatus} />
                <div className="panel-body">
                  {genStatus === "pending" && (
                    <span className="pending-text">Waiting…</span>
                  )}
                  {genStatus === "running" && (
                    <span className="pending-text">Calling Claude API…</span>
                  )}
                  {genStatus === "done" && genData && (
                    <>
                      <div className="gen-name">{genData.programName}</div>
                      <div className="tags">
                        {genData.templates.map((t) => (
                          <span key={t} className="tag">{t}</span>
                        ))}
                      </div>
                      <p className="gen-explanation">{genData.explanation}</p>
                    </>
                  )}
                  {genStatus === "failed" && (
                    <span className="error-text">{errorMsg}</span>
                  )}
                </div>
              </div>

              {/* Build panel */}
              <div className="panel">
                <PanelHeader title="Build" status={buildStatus} />
                <div className="panel-body">
                  {buildStatus === "pending" && (
                    <span className="pending-text">Waiting for generate…</span>
                  )}
                  {(buildStatus === "running" || buildStatus === "done") && (
                    <>
                      <div className="log-scroll" ref={logRef}>
                        <pre className="log-text">{buildLogs}</pre>
                      </div>
                      {buildStatus === "done" && buildDuration && (
                        <div className="log-duration">✓ Compiled in {buildDuration}</div>
                      )}
                    </>
                  )}
                  {buildStatus === "failed" && (
                    <>
                      <div className="log-scroll" ref={logRef}>
                        <pre className="log-text">{buildLogs}</pre>
                      </div>
                      <div className="error-text" style={{ marginTop: 10 }}>{errorMsg}</div>
                    </>
                  )}
                </div>
              </div>

              {/* Deploy panel */}
              <div className="panel">
                <PanelHeader title="Deploy" status={deployStatus} />
                <div className="panel-body">
                  {deployStatus === "pending" && (
                    <span className="pending-text">Waiting for build…</span>
                  )}
                  {deployStatus === "running" && (
                    <span className="deploy-waiting">Deploying to devnet…</span>
                  )}
                  {deployStatus === "done" && deployData && (
                    <>
                      <div className="deploy-label">Program ID</div>
                      <div className="program-id">{deployData.programId}</div>
                      <a
                        className="explorer-link"
                        href={deployData.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View on Explorer ↗
                      </a>
                    </>
                  )}
                  {deployStatus === "failed" && (
                    <span className="error-text">{errorMsg}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
