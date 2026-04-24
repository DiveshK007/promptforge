"use client";

import { useEffect, useRef, useState } from "react";

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

interface HistoryEntry {
  programName: string;
  programId: string;
  explorerUrl: string;
  timestamp: number;
}

const HISTORY_KEY = "promptforge_deployments";

function truncatePubkey(key: string): string {
  return key.length > 20 ? `${key.slice(0, 8)}…${key.slice(-8)}` : key;
}

function formatAge(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
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

function PanelHeader({ title, status }: { title: string; status: Status }) {
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
  const [balanceWarning, setBalanceWarning] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const logRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const EXAMPLE_PROMPTS = [
    "Create an SPL token with a 2% transfer fee",
    "Create a two-party escrow that releases after 7 days",
    "Create a payment splitter: 70% to creator, 30% to treasury",
  ];

  function fillPrompt(text: string) {
    setPrompt(text);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) setHistory(JSON.parse(stored));
    } catch {}
  }, []);

  function addToHistory(entry: HistoryEntry) {
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, 10);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function clearHistory() {
    setHistory([]);
    try { localStorage.removeItem(HISTORY_KEY); } catch {}
  }

  function resetState() {
    setGenStatus("pending");
    setGenData(null);
    setBuildStatus("pending");
    setBuildLogs("");
    setBuildDuration("");
    setDeployStatus("pending");
    setDeployData(null);
    setBalanceWarning(null);
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
    let programName = "";

    try {
      const res = await fetch(
        process.env.NEXT_PUBLIC_API_URL
          ? `${process.env.NEXT_PUBLIC_API_URL}/api/generate`
          : "/api/generate",
        {
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
          const event = JSON.parse(line) as { type: string; data: unknown };

          if (event.type === "generate") {
            const d = event.data as GenerateData;
            programName = d.programName;
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
          } else if (event.type === "balance_warning") {
            setBalanceWarning(event.data as string);
          } else if (event.type === "deploy_done") {
            const d = event.data as DeployData;
            setDeployStatus("done");
            setDeployData(d);
            addToHistory({
              programName,
              programId: d.programId,
              explorerUrl: d.explorerUrl,
              timestamp: Date.now(),
            });
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
              ref={textareaRef}
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
            <div className="example-chips">
              {EXAMPLE_PROMPTS.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  className="example-chip"
                  disabled={running}
                  onClick={() => fillPrompt(ex)}
                >
                  {ex}
                </button>
              ))}
            </div>
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
              {/* Generate */}
              <div className="panel">
                <PanelHeader title="Generate" status={genStatus} />
                <div className="panel-body">
                  {genStatus === "pending" && <span className="pending-text">Waiting…</span>}
                  {genStatus === "running" && <span className="pending-text">Calling Claude API…</span>}
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
                  {genStatus === "failed" && <span className="error-text">{errorMsg}</span>}
                </div>
              </div>

              {/* Build */}
              <div className="panel">
                <PanelHeader title="Build" status={buildStatus} />
                <div className="panel-body">
                  {buildStatus === "pending" && (
                    <span className="pending-text">Waiting for generate…</span>
                  )}
                  {(buildStatus === "running" || buildStatus === "done" || buildStatus === "failed") && (
                    <>
                      <div className="log-scroll" ref={logRef}>
                        <pre className="log-text">{buildLogs}</pre>
                      </div>
                      {buildStatus === "done" && buildDuration && (
                        <div className="log-duration">✓ Compiled in {buildDuration}</div>
                      )}
                      {buildStatus === "failed" && (
                        <div className="error-text" style={{ marginTop: 10 }}>{errorMsg}</div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Deploy */}
              <div className="panel">
                <PanelHeader title="Deploy" status={deployStatus} />
                <div className="panel-body">
                  {balanceWarning && (
                    <div className="balance-warning">
                      <span>⚠</span>
                      <span>
                        Low balance ({balanceWarning} SOL) —{" "}
                        <a
                          href="https://faucet.solana.com"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          faucet.solana.com
                        </a>{" "}
                        to top up devnet SOL
                      </span>
                    </div>
                  )}
                  {deployStatus === "pending" && <span className="pending-text">Waiting for build…</span>}
                  {deployStatus === "running" && <span className="deploy-waiting">Deploying to devnet…</span>}
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
                  {deployStatus === "failed" && <span className="error-text">{errorMsg}</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Deploy history */}
        {history.length > 0 && (
          <section className="history-section">
            <div className="history-header">
              <span className="history-title">Recent Deployments</span>
              <button className="clear-btn" onClick={clearHistory}>Clear</button>
            </div>
            <div className="history-list">
              {history.map((entry) => (
                <div key={`${entry.programId}-${entry.timestamp}`} className="history-entry">
                  <span className="history-name">{entry.programName}</span>
                  <span className="history-id">{truncatePubkey(entry.programId)}</span>
                  <a
                    className="history-link"
                    href={entry.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Explorer ↗
                  </a>
                  <span className="history-time">{formatAge(entry.timestamp)}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
