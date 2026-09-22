// Writes a plain-text copy of an idea + its literature check into the
// app's dedicated OneDrive folder (visible in OneDrive as
// "Apps/Research OS"). This is a backup/portability copy, not the source
// of truth — the database is — so if this call fails, we still saved the
// idea; we just log it and move on.
export async function syncIdeaToOneDrive(
  accessToken: string,
  idea: { id: string; title: string; note: string | null },
  check?: { summary: string; novelty_score: number; key_papers: unknown }
) {
  const body = [
    `# ${idea.title}`,
    "",
    idea.note ?? "",
    "",
    check ? `## Literature check (novelty ${check.novelty_score}/5)` : "",
    check ? check.summary : "",
    check?.key_papers ? "\n" + JSON.stringify(check.key_papers, null, 2) : "",
  ].join("\n");

  const fileName = `${idea.id}.md`;

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${fileName}:/content`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "text/markdown",
      },
      body,
    }
  );

  if (!res.ok) {
    console.error("OneDrive sync failed:", await res.text());
    return null;
  }
  const data = await res.json();
  return data.id as string;
}
