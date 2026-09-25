"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";

type Project = {
  id: string;
  name: string;
  stage: string;
  idea_note: string | null;
  created_at: string;
};

export default function ProjectsPage() {
  const { status } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/projects").then((r) => r.json()).then(setProjects);
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

  return (
    <main className="max-w-2xl mx-auto px-8 py-12">
      <h1 className="font-display font-medium text-[29px] mb-1" style={{ color: "var(--navy)" }}>
        Projects
      </h1>
      <p className="font-ui text-[13px] mb-9" style={{ color: "var(--ink-soft)" }}>
        Ideas that graduated into active work.
      </p>

      {projects.length === 0 && (
        <p className="text-[15px]" style={{ color: "var(--ink-soft)" }}>
          Nothing here yet — mark an idea's literature check as worth pursuing on the{" "}
          <Link href="/ideas" className="underline">
            Ideas
          </Link>{" "}
          page and create a systematic review.
        </p>
      )}

      {projects.length > 0 && (
        <div className="card px-6">
          {projects.map((p, i) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className={`flex justify-between items-center gap-4 py-4 ${
                i < projects.length - 1 ? "ruled" : ""
              }`}
            >
              <div className="flex gap-3 items-center min-w-0">
                <div
                  className="rounded-[9px] flex items-center justify-center shrink-0"
                  style={{ width: 34, height: 34, background: "var(--signal-bg)" }}
                >
                  <i className="ti ti-file-text text-[15px]" style={{ color: "var(--signal)" }} />
                </div>
                <div className="min-w-0">
                  <div className="text-[16px] truncate">{p.name}</div>
                  {p.idea_note && (
                    <div className="font-ui text-[11px] mt-0.5 truncate" style={{ color: "var(--ink-soft)" }}>
                      {p.idea_note}
                    </div>
                  )}
                </div>
              </div>
              <span className="font-ui text-[11px] shrink-0" style={{ color: "var(--ink-soft)" }}>
                {p.stage} · {new Date(p.created_at).toLocaleDateString()}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
