"use client";

import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

type Idea = {
  id: string;
  title: string;
  note: string | null;
  created_at: string;
};

type Check = {
  summary: string;
  novelty_score: number;
  key_papers: { title: string; year: number; url: string }[];
};

export default function IdeasPage() {
  const { data: session, status } = useSession();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [checks, setChecks] = useState<Record<string, Check>>({});
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [runningId, setRunningId] = useState<string | null>(null);

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
    const check = await res.json();
    setChecks((c) => ({ ...c, [idea.id]: check }));
    setRunningId(null);
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
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </main>
  );
}
