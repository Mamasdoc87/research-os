import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncIdeaToOneDrive } from "@/lib/graph";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { ideaId, title, note } = await req.json();

  // Step 1: search Consensus directly for real papers on this topic.
  const query = note ? `${title} ${note}` : title;
  const consensusRes = await fetch(
    `https://api.consensus.app/v1/search?${new URLSearchParams({ query })}`,
    { headers: { "x-api-key": process.env.CONSENSUS_API_KEY! } }
  );

  let papers: any[] = [];
  if (consensusRes.ok) {
    const consensusData = await consensusRes.json();
    papers = (consensusData.results ?? []).slice(0, 8);
  }
  // If Consensus fails for any reason, we still proceed — Claude just won't
  // have real papers to weigh, and the summary will say so.

  const papersBlock = papers.length
    ? papers
        .map(
          (p, i) =>
            `${i + 1}. "${p.title}" (${p.publish_year}, ${p.journal_name ?? "unknown journal"}) — ${p.takeaway ?? "no summary"} [${p.url}]`
        )
        .join("\n")
    : "(no papers found by Consensus for this query)";

  // Step 2: ask Claude to weigh these real papers and give a verdict.
  const prompt = `A researcher has this idea:

Title: ${title}
Notes: ${note ?? "(none)"}

Here are the most relevant existing papers found by Consensus (a peer-reviewed
research search engine):

${papersBlock}

Based ONLY on these papers, judge whether this idea is worth pursuing. Then
respond with ONLY a JSON object, no preamble, no markdown fences, matching
exactly this shape:

{
  "summary": "2-3 sentence plain-language verdict on whether this is worth pursuing and why",
  "novelty_score": <integer 1-5, 5 = wide open gap, 1 = thoroughly covered>,
  "key_papers": [{"title": "...", "year": 2023, "source": "Consensus", "url": "..."}]
}

For key_papers, pick up to 3 of the most relevant papers listed above, using
their exact title, year, and url.`;

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!claudeRes.ok) {
    const errText = await claudeRes.text();
    return NextResponse.json(
      { error: `Claude API error: ${claudeRes.status}`, detail: errText },
      { status: 502 }
    );
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

  const accessToken = (session as any).accessToken;
  if (accessToken) {
    syncIdeaToOneDrive(accessToken, { id: ideaId, title, note }, parsed);
  }

  return NextResponse.json(rows[0]);
}
