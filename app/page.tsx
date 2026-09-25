"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Idea = {
  id: string;
  title: string;
  note: string | null;
  publication_score: number | null;
  publication_explanation: string | null;
  check_summary: string | null;
  has_project: boolean;
};
type Project = {
  id: string;
  name: string;
  stage: string;
  idea_id: string;
  created_at: string;
};

const STAGE_ORDER = ["planning", "search", "screening", "extraction", "writing", "submitted"];
const STEPS = [
  { key: "planning", label: "Protocol", icon: "ti-clipboard-list" },
  { key: "search", label: "Search", icon: "ti-search" },
  { key: "screening", label: "Screen", icon: "ti-folder" },
  { key: "extraction", label: "Extract", icon: "ti-database" },
  { key: "writing", label: "Write", icon: "ti-pencil" },
];

export default function CommandCentre() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [resultCounts, setResultCounts] = useState<Record<string, number>>({});
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/ideas").then((r) => r.json()).then(setIdeas);
    fetch("/api/projects").then((r) => r.json()).then(setProjects);
  }, [status]);

  useEffect(() => {
    projects.forEach((p) => {
      if (resultCounts[p.idea_id] !== undefined) return;
      fetch(`/api/ideas/results?ideaId=${p.idea_id}`)
        .then((r) => r.json())
        .then((rows) => setResultCounts((c) => ({ ...c, [p.idea_id]: rows.length })));
    });
  }, [projects]);

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

  const needingCheck = ideas.filter((i) => i.publication_score === null).length;
  const planningProjects = projects.filter((p) => p.stage === "planning").length;
  const topIdea = ideas
    .filter((i) => !i.has_project && i.publication_score !== null)
    .sort((a, b) => (b.publication_score ?? 0) - (a.publication_score ?? 0))[0];
  const totalPooled = Object.values(resultCounts).reduce((a, b) => a + b, 0);
  const stageIndices = projects
    .map((p) => STAGE_ORDER.indexOf(p.stage))
    .filter((i) => i >= 0);
  const currentStageIndex = stageIndices.length ? Math.max(...stageIndices) : -1;

  return (
    <main className="px-10 py-9">
      <div className="flex justify-between items-center mb-1">
        <h1 className="font-display font-medium text-[29px]" style={{ color: "var(--navy)" }}>
          Research Command Centre
        </h1>
        <div className="flex items-center gap-3 font-ui">
          <Link
            href="/ideas"
            className="text-[12.5px] rounded-lg flex items-center gap-1.5 px-4 py-2"
            style={{ background: "var(--navy)", color: "var(--paper)" }}
          >
            <i className="ti ti-plus text-[14px]" />
            New idea
          </Link>
          <div className="flex items-center gap-1.5">
            <div
              className="rounded-full flex items-center justify-center font-display text-[12.5px]"
              style={{ width: 32, height: 32, border: "1.5px solid var(--gold)" }}
            >
              {(session?.user?.name ?? session?.user?.email ?? "?").slice(0, 2).toUpperCase()}
            </div>
          </div>
        </div>
      </div>
      <p className="text-[14.5px] mb-6" style={{ color: "var(--ink-soft)" }}>
        A clear view of what matters next.
      </p>

      <div className="flex gap-7">
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-medium text-[19px] mb-3.5">Ideas requiring review</h2>
          {!topIdea && (
            <p className="text-sm mb-7" style={{ color: "var(--ink-soft)" }}>
              Nothing waiting right now —{" "}
              <Link href="/ideas" className="underline">
                log a new idea
              </Link>{" "}
              to get started.
            </p>
          )}
          {topIdea && (
            <div className="card p-6 mb-7">
              <div className="flex justify-between items-center gap-5">
                <div className="flex gap-4 items-center min-w-0">
                  <div
                    className="rounded-full flex items-center justify-center shrink-0"
                    style={{ width: 44, height: 44, background: "var(--signal-bg)" }}
                  >
                    <i className="ti ti-star text-[18px]" style={{ color: "var(--signal)" }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[17px] mb-1 truncate">{topIdea.title}</div>
                    <div className="font-ui text-xs" style={{ color: "var(--ink-soft)" }}>
                      {topIdea.check_summary ?? topIdea.note}
                    </div>
                  </div>
                </div>
                <div className="text-center shrink-0">
                  <div
                    className="font-display font-medium text-[26px] leading-none"
                    style={{ color: "var(--signal)" }}
                  >
                    {topIdea.publication_score}
                    <span className="text-sm" style={{ color: "var(--ink-soft)" }}> / 10</span>
                  </div>
                  <div className="font-ui text-[11px]" style={{ color: "var(--gold)" }}>
                    Publication potential
                  </div>
                </div>
                <button
                  onClick={() => addToProjects(topIdea)}
                  disabled={addingId === topIdea.id}
                  className="font-ui text-xs rounded-lg px-4 py-2 flex items-center gap-1.5 shrink-0 border"
                  style={{ borderColor: "var(--ink)" }}
                >
                  {addingId === topIdea.id ? "adding…" : "Create systematic review"}
                  <i className="ti ti-arrow-right text-[13px]" />
                </button>
              </div>
            </div>
          )}

          <h2 className="font-display font-medium text-[19px] mb-3.5">Active projects</h2>
          {projects.length === 0 && (
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              No projects yet.
            </p>
          )}
          {projects.length > 0 && (
            <div className="card px-6">
              {projects.map((p, i) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className={`flex justify-between items-center gap-4 py-3.5 ${
                    i < projects.length - 1 ? "ruled" : ""
                  }`}
                >
                  <div className="flex gap-3 items-center min-w-0">
                    <div
                      className="rounded-[9px] flex items-center justify-center shrink-0"
                      style={{ width: 34, height: 34, background: "var(--signal-bg)" }}
                    >
                      <i
                        className="ti ti-file-text text-[15px]"
                        style={{ color: "var(--signal)" }}
                      />
                    </div>
                    <div className="text-[14.5px] truncate">{p.name}</div>
                  </div>
                  <span
                    className="font-ui text-[11px] shrink-0"
                    style={{ color: "var(--ink-soft)" }}
                  >
                    {p.stage}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="w-[220px] shrink-0">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-display font-medium text-[17px]">Attention queue</h2>
            <i className="ti ti-bell text-[16px]" style={{ color: "var(--gold)" }} />
          </div>
          {needingCheck === 0 && planningProjects === 0 && (
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              All caught up.
            </p>
          )}
          {needingCheck > 0 && (
            <div className="flex gap-2.5 items-center py-3 ruled">
              <div
                className="rounded-full flex items-center justify-center shrink-0"
                style={{ width: 32, height: 32, background: "var(--paper-line)" }}
              >
                <i className="ti ti-flask text-[14px]" style={{ color: "var(--ink-soft)" }} />
              </div>
              <div className="text-[13.5px] flex-1">
                {needingCheck} idea{needingCheck > 1 ? "s" : ""} awaiting literature check
              </div>
            </div>
          )}
          {planningProjects > 0 && (
            <div className="flex gap-2.5 items-center py-3 ruled">
              <div
                className="rounded-full flex items-center justify-center shrink-0"
                style={{ width: 32, height: 32, background: "var(--paper-line)" }}
              >
                <i className="ti ti-folder text-[14px]" style={{ color: "var(--ink-soft)" }} />
              </div>
              <div className="text-[13.5px] flex-1">
                {planningProjects} project{planningProjects > 1 ? "s" : ""} not yet started
              </div>
            </div>
          )}

          <div className="mt-6 pt-5" style={{ borderTop: "1px solid var(--paper-line)" }}>
            <div className="flex justify-between items-baseline mb-1.5">
              <h2 className="font-display font-medium text-[17px]">Research intelligence</h2>
              <i className="ti ti-chart-line text-[15px]" style={{ color: "var(--gold)" }} />
            </div>
            <div className="font-display font-medium text-[34px] mt-2">{totalPooled}</div>
            <div className="font-ui text-xs" style={{ color: "var(--ink-soft)" }}>
              papers pooled across projects
            </div>
          </div>
        </div>
      </div>

      {currentStageIndex >= 0 && (
        <div className="card px-8 py-4.5 mt-6 flex items-center justify-center gap-3.5 font-ui text-[13px]">
          {STEPS.map((s, i) => (
            <span key={s.key} className="flex items-center gap-3.5">
              {i > 0 && <span style={{ color: "var(--paper-line-strong)" }}>·</span>}
              <span className="flex items-center gap-1.5">
                {i === currentStageIndex ? (
                  <span
                    className="rounded-full flex items-center justify-center"
                    style={{ width: 24, height: 24, background: "var(--signal)" }}
                  >
                    <i className={`ti ${s.icon} text-[13px]`} style={{ color: "var(--paper)" }} />
                  </span>
                ) : (
                  <i
                    className={`ti ${s.icon} text-[16px]`}
                    style={{
                      color: i < currentStageIndex ? "var(--signal)" : "var(--ink-soft)",
                    }}
                  />
                )}
                {s.label}
              </span>
            </span>
          ))}
        </div>
      )}
    </main>
  );
}
