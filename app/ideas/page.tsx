"use client";

import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

type Idea = { id: string; title: string; note: string | null; created_at: string };
type Check = {
  summary: string;
  novelty_score: number;
  key_papers: { title: string; year: number; url: string }[];
};
type Strategy = {
  pubmed_query: string;
  embase_query: string;
  cochrane_query: string;
  notes: string;
};
type Result = {
  id: string;
  source: string;
  title: string;
  authors: string | null;
  journal: string | null;
  year: number | null;
  url: string | null;
  abstract: string | null;
  decision: "pending" | "include" | "exclude";
};

export default function IdeasPage() {
  const { data: session, status } = useSession();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [checks, setChecks] = useState<Record<string, Check>>({});
  const [strategies, setStrategies] = useState<Record<string, Strategy>>({});
  const [results, setResults] = useState<Record<string, Result[]>>({});
  const [openResults, setOpenResults] = useState<Record<string, boolean>>({});
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [runningId, setRunningId] = useState<string | null>(null);
  const [strategyRunningId, setStrategyRunningId] = useState<string | null>(null);
  const [pubmedRunningId, setPubmedRunningId] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/ideas").then((r) => r.json()).then(setIdeas);
    }
  }, [status]);

  if (status === "loading") return null;

  if (status !== "authenticated") {
    return (
      <main className="max-w-md mx-auto px-6 py-24 text-center">
        <h1 className="text-2xl mb-6">Research OS</h1>
        <button
          onClick={() => signIn("azure-ad")}
          className="meta px-4 py-2 border border-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--paper)] transition-colors"
        >
          Sign in with Microsoft
        </button>
      </main>
    );
  }

  async function capture() {
    if (!title.trim()) return;
    const res = await fetch("/api/ideas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, note }),
    });
    const idea = await res.json();
    setIdeas([idea, ...ideas]);
    setTitle("");
    setNote("");
  }

  async function runCheck(idea: Idea) {
    setRunningId(idea.id);
    const res = await fetch("/api/ideas/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ideaId: idea.id, title: idea.title, note: idea.note }),
    });
    setChecks((c) => ({ ...c, [idea.id]: await res.json() }));
    setRunningId(null);
  }

  async function runStrategy(idea: Idea) {
    setStrategyRunningId(idea.id);
    const res = await fetch("/api/ideas/search-strategy", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ideaId: idea.id, title: idea.title, note: idea.note }),
    });
    setStrategies((s) => ({ ...s, [idea.id]: await res.json() }));
    setStrategyRunningId(null);
  }

  async function loadResults(ideaId: string) {
    const res = await fetch(`/api/ideas/results?ideaId=${ideaId}`);
    setResults((r) => ({ ...r, [ideaId]: await res.json() }));
  }

  async function runPubmed(idea: Idea, query: string) {
    setPubmedRunningId(idea.id);
    await fetch("/api/ideas/search-pubmed", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ideaId: idea.id, query }),
    });
    await loadResults(idea.id);
    setOpenResults((o) => ({ ...o, [idea.id]: true }));
    setPubmedRunningId(null);
  }

  async function importFile(idea: Idea, source: "embase" | "cochrane", file: File) {
    setImportingId(idea.id);
    const risText = await file.text();
    await fetch("/api/ideas/search-import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ideaId: idea.id, source, risText }),
    });
    await loadResults(idea.id);
    setOpenResults((o) => ({ ...o, [idea.id]: true }));
    setImportingId(null);
  }

  async function decide(idea: Idea, resultId: string, decision: "include" | "exclude") {
    await fetch("/api/ideas/results", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resultId, decision }),
    });
    setResults((r) => ({
      ...r,
      [idea.id]: r[idea.id].map((x) => (x.id === resultId ? { ...x, decision } : x)),
    }));
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="text-3xl">Ideas</h1>
        <button onClick={() => signOut()} className="meta hover:underline">
          {session?.user?.email} — sign out
        </button>
      </div>
      <p className="meta mb-10">a running log, not a board — synced to your OneDrive</p>

      <div className="mb-14">
        <input
          className="w-full bg-transparent text-xl ruled pb-2 mb-3 outline-none placeholder:text-[var(--ink-soft)]"
          placeholder="What's the idea?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="w-full bg-transparent ruled pb-2 mb-3 outline-none resize-none placeholder:text-[var(--ink-soft)]"
          placeholder="Any rough notes — the messier the better"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          onClick={capture}
          className="meta px-4 py-2 border border-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--paper)] transition-colors"
        >
          Log it
        </button>
      </div>

      <ol className="space-y-10">
        {ideas.map((idea) => {
          const check = checks[idea.id];
          const strategy = strategies[idea.id];
          const ideaResults = results[idea.id] ?? [];
          const included = ideaResults.filter((r) => r.decision === "include").length;

          return (
            <li key={idea.id} className="ruled pb-8">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-xl">{idea.title}</h2>
                <span className="meta shrink-0">
                  {new Date(idea.created_at).toLocaleDateString()}
                </span>
              </div>
              {idea.note && <p className="text-[var(--ink-soft)] mt-1">{idea.note}</p>}

              {!check && (
                <button
                  onClick={() => runCheck(idea)}
                  disabled={runningId === idea.id}
                  className="meta mt-3 underline decoration-[var(--paper-line)] underline-offset-4 hover:decoration-[var(--ink)]"
                >
                  {runningId === idea.id ? "checking the literature…" : "check the literature"}
                </button>
              )}

              {check && (
                <div className="mt-4 pl-4 border-l-2" style={{ borderColor: "var(--signal)" }}>
                  <div className="meta mb-1">novelty {check.novelty_score}/5</div>
                  <p>{check.summary}</p>
                  {check.key_papers?.length > 0 && (
                    <ul className="meta mt-2 space-y-1">
                      {check.key_papers.map((p, i) => (
                        <li key={i}>
                          <a href={p.url} target="_blank" className="hover:underline">
                            {p.title} ({p.year})
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}

                  {!strategy && (
                    <button
                      onClick={() => runStrategy(idea)}
                      disabled={strategyRunningId === idea.id}
                      className="meta mt-3 underline decoration-[var(--paper-line)] underline-offset-4 hover:decoration-[var(--ink)]"
                    >
                      {strategyRunningId === idea.id
                        ? "drafting search strategy…"
                        : "draft search strategy"}
                    </button>
                  )}

                  {strategy && (
                    <div className="mt-4 space-y-3">
                      {[
                        ["PubMed / MEDLINE", strategy.pubmed_query, "pubmed"],
                        ["Embase", strategy.embase_query, "embase"],
                        ["Cochrane CENTRAL", strategy.cochrane_query, "cochrane"],
                      ].map(([label, q, key]) => (
                        <div key={label}>
                          <div className="meta flex items-center justify-between">
                            <span>{label}</span>
                            <span className="flex gap-3">
                              <button
                                onClick={() => copy(q)}
                                className="underline decoration-[var(--paper-line)] hover:decoration-[var(--ink)]"
                              >
                                copy
                              </button>
                              {key === "pubmed" && (
                                <button
                                  onClick={() => runPubmed(idea, q)}
                                  disabled={pubmedRunningId === idea.id}
                                  className="underline decoration-[var(--paper-line)] hover:decoration-[var(--ink)]"
                                >
                                  {pubmedRunningId === idea.id ? "searching…" : "search PubMed now"}
                                </button>
                              )}
                              {(key === "embase" || key === "cochrane") && (
                                <label className="underline decoration-[var(--paper-line)] hover:decoration-[var(--ink)] cursor-pointer">
                                  {importingId === idea.id ? "importing…" : "import .ris export"}
                                  <input
                                    type="file"
                                    accept=".ris,.txt"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) importFile(idea, key as "embase" | "cochrane", file);
                                    }}
                                  />
                                </label>
                              )}
                            </span>
                          </div>
                          <p className="meta text-[var(--ink)] bg-white/40 p-2 mt-1 break-words">
                            {q}
                          </p>
                        </div>
                      ))}
                      {strategy.notes && (
                        <p className="meta text-[var(--ink-soft)] italic">{strategy.notes}</p>
                      )}
                    </div>
                  )}

                  {ideaResults.length > 0 && (
                    <div className="mt-5">
                      <button
                        onClick={() => setOpenResults((o) => ({ ...o, [idea.id]: !o[idea.id] }))}
                        className="meta underline decoration-[var(--paper-line)] hover:decoration-[var(--ink)]"
                      >
                        {ideaResults.length} papers pooled — {included} included{" "}
                        {openResults[idea.id] ? "(hide)" : "(show)"}
                      </button>

                      {openResults[idea.id] && (
                        <ul className="mt-3 space-y-3">
                          {ideaResults.map((r) => (
                            <li key={r.id} className="ruled pb-2">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <a
                                    href={r.url ?? undefined}
                                    target="_blank"
                                    className="hover:underline"
                                  >
                                    {r.title}
                                  </a>
                                  <div className="meta">
                                    {r.journal ?? ""} {r.year ?? ""} · {r.source}
                                  </div>
                                </div>
                                <span className="flex gap-2 shrink-0">
                                  <button
                                    onClick={() => decide(idea, r.id, "include")}
                                    className={`meta px-2 py-0.5 border ${
                                      r.decision === "include"
                                        ? "bg-[var(--signal)] text-white border-[var(--signal)]"
                                        : "border-[var(--paper-line)]"
                                    }`}
                                  >
                                    include
                                  </button>
                                  <button
                                    onClick={() => decide(idea, r.id, "exclude")}
                                    className={`meta px-2 py-0.5 border ${
                                      r.decision === "exclude"
                                        ? "bg-[var(--ink-soft)] text-white border-[var(--ink-soft)]"
                                        : "border-[var(--paper-line)]"
                                    }`}
                                  >
                                    exclude
                                  </button>
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </main>
  );
}
