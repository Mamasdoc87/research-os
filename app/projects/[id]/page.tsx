"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { useParams } from "next/navigation";

type Project = {
  id: string;
  name: string;
  stage: string;
  idea_id: string;
  idea_title: string;
  idea_note: string | null;
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
  decision: "pending" | "include" | "exclude";
};

export default function ProjectDetailPage() {
  const { status } = useSession();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [strategyRunning, setStrategyRunning] = useState(false);
  const [pubmedRunning, setPubmedRunning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showResults, setShowResults] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/projects")
      .then((r) => r.json())
      .then((all: Project[]) => setProject(all.find((p) => p.id === projectId) ?? null));
  }, [status, projectId]);

  useEffect(() => {
    if (project) loadResults(project.idea_id);
  }, [project]);

  async function loadResults(ideaId: string) {
    const res = await fetch(`/api/ideas/results?ideaId=${ideaId}`);
    setResults(await res.json());
  }

  async function runStrategy() {
    if (!project) return;
    setStrategyRunning(true);
    const res = await fetch("/api/ideas/search-strategy", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ideaId: project.idea_id,
        title: project.idea_title,
        note: project.idea_note,
      }),
    });
    setStrategy(await res.json());
    setStrategyRunning(false);
  }

  async function runPubmed(query: string) {
    if (!project) return;
    setPubmedRunning(true);
    await fetch("/api/ideas/search-pubmed", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ideaId: project.idea_id, query }),
    });
    await loadResults(project.idea_id);
    setPubmedRunning(false);
  }

  async function importFile(source: "embase" | "cochrane", file: File) {
    if (!project) return;
    setImporting(true);
    const risText = await file.text();
    await fetch("/api/ideas/search-import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ideaId: project.idea_id, source, risText }),
    });
    await loadResults(project.idea_id);
    setImporting(false);
  }

  async function decide(resultId: string, decision: "include" | "exclude") {
    await fetch("/api/ideas/results", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resultId, decision }),
    });
    setResults((r) => r.map((x) => (x.id === resultId ? { ...x, decision } : x)));
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
  }

  if (status === "loading" || (status === "authenticated" && !project)) return null;

  if (status !== "authenticated") {
    return (
      <main className="max-w-md mx-auto px-6 py-24 text-center">
        <h1 className="font-display text-2xl mb-6">Research OS</h1>
        <button
          onClick={() => signIn("azure-ad")}
          className="font-ui px-4 py-2 rounded-lg border"
          style={{ borderColor: "var(--ink)" }}
        >
          Sign in with Microsoft
        </button>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="max-w-2xl mx-auto px-8 py-12">
        <p style={{ color: "var(--ink-soft)" }}>Project not found.</p>
      </main>
    );
  }

  const included = results.filter((r) => r.decision === "include").length;

  return (
    <main className="max-w-2xl mx-auto px-8 py-12">
      <h1 className="font-display font-medium text-[27px] mb-1" style={{ color: "var(--navy)" }}>
        {project.name}
      </h1>
      <p className="font-ui text-[13px] mb-9" style={{ color: "var(--ink-soft)" }}>
        {project.idea_note}
      </p>

      {!strategy && (
        <button
          onClick={runStrategy}
          disabled={strategyRunning}
          className="font-ui text-[12.5px] rounded-lg px-4 py-2 mb-8"
          style={{ background: "var(--navy)", color: "var(--paper)" }}
        >
          {strategyRunning ? "drafting search strategy…" : "Draft search strategy"}
        </button>
      )}

      {strategy && (
        <div className="card p-6 mb-8 space-y-5">
          {[
            ["PubMed / MEDLINE", strategy.pubmed_query, "pubmed"],
            ["Embase", strategy.embase_query, "embase"],
            ["Cochrane CENTRAL", strategy.cochrane_query, "cochrane"],
          ].map(([label, q, key]) => (
            <div key={label}>
              <div className="font-ui flex items-center justify-between text-[12px]">
                <span style={{ color: "var(--gold)" }}>{label}</span>
                <span className="flex gap-3">
                  <button onClick={() => copy(q)} className="underline" style={{ color: "var(--signal)" }}>
                    copy
                  </button>
                  {key === "pubmed" && (
                    <button
                      onClick={() => runPubmed(q)}
                      disabled={pubmedRunning}
                      className="underline"
                      style={{ color: "var(--signal)" }}
                    >
                      {pubmedRunning ? "searching…" : "search PubMed now"}
                    </button>
                  )}
                  {(key === "embase" || key === "cochrane") && (
                    <label className="underline cursor-pointer" style={{ color: "var(--signal)" }}>
                      {importing ? "importing…" : "import .ris export"}
                      <input
                        type="file"
                        accept=".ris,.txt"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) importFile(key as "embase" | "cochrane", file);
                        }}
                      />
                    </label>
                  )}
                </span>
              </div>
              <p
                className="font-ui text-[12px] p-2.5 mt-1.5 break-words rounded"
                style={{ background: "var(--paper)", color: "var(--ink)" }}
              >
                {q}
              </p>
            </div>
          ))}
          {strategy.notes && (
            <p className="font-ui text-[12px] italic" style={{ color: "var(--ink-soft)" }}>
              {strategy.notes}
            </p>
          )}
        </div>
      )}

      {results.length > 0 && (
        <div>
          <button
            onClick={() => setShowResults((s) => !s)}
            className="font-ui text-[12.5px] underline mb-3"
            style={{ color: "var(--signal)" }}
          >
            {results.length} papers pooled — {included} included {showResults ? "(hide)" : "(show)"}
          </button>

          {showResults && (
            <ul className="space-y-3">
              {results.map((r) => (
                <li key={r.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <a href={r.url ?? undefined} target="_blank" className="text-[14.5px] hover:underline">
                        {r.title}
                      </a>
                      <div className="font-ui text-[11px] mt-1" style={{ color: "var(--ink-soft)" }}>
                        {r.journal ?? ""} {r.year ?? ""} · {r.source}
                      </div>
                    </div>
                    <span className="flex gap-2 shrink-0">
                      <button
                        onClick={() => decide(r.id, "include")}
                        className="font-ui text-[11px] px-2.5 py-1 rounded"
                        style={
                          r.decision === "include"
                            ? { background: "var(--signal)", color: "var(--paper)" }
                            : { border: "1px solid var(--paper-line-strong)" }
                        }
                      >
                        include
                      </button>
                      <button
                        onClick={() => decide(r.id, "exclude")}
                        className="font-ui text-[11px] px-2.5 py-1 rounded"
                        style={
                          r.decision === "exclude"
                            ? { background: "var(--ink-soft)", color: "var(--paper)" }
                            : { border: "1px solid var(--paper-line-strong)" }
                        }
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
    </main>
  );
}
