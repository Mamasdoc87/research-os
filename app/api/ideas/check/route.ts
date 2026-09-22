import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncIdeaToOneDrive } from "@/lib/graph";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { ideaId, title, note } = await req.json();

  const prompt = `A researcher has this idea:

Title: ${title}
Notes: ${note ?? "(none)"}

Using Consensus, find out whether this has already been well studied. Then
respond with ONLY a JSON object, no preamble, no markdown fences, matching
exactly this shape:

{
  "summary": "2-3 sentence plain-language verdict on whether this is worth pursuing and why",
  "novelty_score": <integer 1-5, 5 = wide open gap, 1 = thoroughly covered>,
  "key_papers": [{"title": "...", "year": 2023, "source": "Consensus", "url": "..."}]
}`;

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
      mcp_servers: [{ type: "url", url: "https://mcp.consensus.app/mcp", name: "consensus" }],
    }),
  });

  if (!claudeRes.ok) {
    return NextResponse.json({ error: `Claude API error: ${claudeRes.status}` }, { status: 502 });
  }

  const data = await claudeRes.json();
  const raw = (data.content ?? [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .trim();

  let parsed: { summary: string; novelty_score: number; key_papers: unknown };
  try {
    parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""));
  } catch {
    return NextResponse.json({ error: "Could not parse model output", raw }, { status: 502 });
  }

  const { rows } = await db().query(
    `insert into literature_checks (idea_id, summary, novelty_score, key_papers, raw_response)
     values ($1, $2, $3, $4, $5) returning *`,
    [ideaId, parsed.summary, parsed.novelty_score, JSON.stringify(parsed.key_papers), JSON.stringify(data)]
  );

  // Re-sync the OneDrive copy so it now includes the verdict.
  const accessToken = (session as any).accessToken;
  if (accessToken) {
    syncIdeaToOneDrive(accessToken, { id: ideaId, title, note }, parsed);
  }

  return NextResponse.json(rows[0]);
}
