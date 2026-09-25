"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

type Idea = { id: string; title: string; note: string | null; created_at: string };
type Check = {
  summary: string;
  novelty_score: number;
  key_papers: { title: string; year: number; url: string }[];
  publication_score: number;
  publication_explanation: string;
};

export default function IdeasPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [checks, setChecks] = useState<Record<string, Check>>({});
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [runningId, setRunningId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/ideas").then((r) => r.json()).then(setIdeas);
    }
  }, [status]);

  if (status === "loading") return null;

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
    const checkData = await res.json();
    setChecks((c) => ({ ...c, [idea.id]: checkData }));
    setRunningId(null);
  }

  async function addToProjects(idea: Idea) {
    setAddingId(idea.id);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ideaId: idea.id, name: idea.title }),
    });
    const project = await res.json();
    router.push(`/projects/${project.id}`);
  }

  return (
    <main className="max-w-2xl mx-auto px-8 py-12">
      <h1 className="font-display font-medium text-[29px] mb-1" style={{ color: "var(--navy)" }}>
        Ideas
      </h1>
      <p className="font-ui text-[13px] mb-9" style={{ color: "var(--ink-soft)" }}>
        A running log, not a board — synced to your OneDrive.
      </p>

      <div className="card p-6 mb-10">
        <h2 className="font-display font-medium text-[19px] mb-3.5">What's the idea?</h2>
        <input
          className="w-full bg-transparent text-[16px] ruled pb-2 mb-3 outline-none"
          placeholder="A question, technique, or clinical problem…"
          style={{ color: "var(--ink)" }}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="w-full bg-transparent ruled pb-2 mb-4 outline-none resize-none text-[15px]"
          placeholder="Any rough notes — the messier the better"
          rows={2}
          style={{ color: "var(--ink)" }}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          onClick={capture}
          className="font-ui text-[12.5px] rounded-lg px-4 py-2"
          style={{ background: "var(--navy)", color: "var(--paper)" }}
        >
          Log it
        </button>
      </div>

      <ol className="space-y-8">
        {ideas.map((idea) => {
          const check = checks[idea.id];
          return (
            <li key={idea.id} className="card p-6">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-[18px]">{idea.title}</h2>
                <span className="font-ui text-[11px] shrink-0" style={{ color: "var(--ink-soft)" }}>
                  {new Date(idea.created_at).toLocaleDateString()}
                </span>
              </div>
              {idea.note && (
                <p className="mt-1 text-[14.5px]" style={{ color: "var(--ink-soft)" }}>
                  {idea.note}
                </p>
              )}

              {!check && (
                <button
                  onClick={() => runCheck(idea)}
                  disabled={runningId === idea.id}
                  className="font-ui text-[12px] mt-4 underline"
                  style={{ color: "var(--signal)" }}
                >
                  {runningId === idea.id ? "checking the literature…" : "check the literature"}
                </button>
              )}

              {check && (
                <div className="mt-5 pt-5" style={{ borderTop: "1px solid var(--paper-line)" }}>
                  <div className="flex items-center gap-4 mb-3">
                    <div
                      className="rounded-full flex items-center justify-center shrink-0"
                      style={{ width: 46, height: 46, background: "var(--signal-bg)" }}
                    >
                      <i className="ti ti-star text-[19px]" style={{ color: "var(--signal)" }} />
                    </div>
                    <div>
                      <div
                        className="font-display font-medium text-[24px] leading-none"
                        style={{ color: "var(--signal)" }}
                      >
                        {check.publication_score}
                        <span className="text-sm" style={{ color: "var(--ink-soft)" }}> / 10</span>
                      </div>
                      <div className="font-ui text-[11px]" style={{ color: "var(--gold)" }}>
                        Publication potential
                      </div>
                    </div>
                  </div>
                  <p className="text-[15px] mb-4">{check.publication_explanation}</p>

                  <div className="font-ui text-[12px] mb-2" style={{ color: "var(--ink-soft)" }}>
                    novelty {check.novelty_score}/5 — {check.summary}
                  </div>
                  {check.key_papers?.length > 0 && (
                    <ul className="font-ui text-[12px] space-y-1 mb-4" style={{ color: "var(--signal)" }}>
                      {check.key_papers.map((p, i) => (
                        <li key={i}>
                          <a href={p.url} target="_blank" className="hover:underline">
                            {p.title} ({p.year})
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}

                  <button
                    onClick={() => addToProjects(idea)}
                    disabled={addingId === idea.id}
                    className="font-ui text-xs rounded-lg px-4 py-2 border flex items-center gap-1.5"
                    style={{ borderColor: "var(--ink)" }}
                  >
                    {addingId === idea.id ? "adding…" : "Create systematic review"}
                    <i className="ti ti-arrow-right text-[13px]" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </main>
  );
}
