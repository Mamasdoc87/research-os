import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncIdeaToOneDrive } from "@/lib/graph";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { ideaId, title, note } = await req.json();

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

  const papersBlock = papers.length
    ? papers
        .map(
          (p, i) =>
            `${i + 1}. "${p.title}" (${p.publish_year}, ${p.journal_name ?? "unknown journal"}) — ${p.takeaway ?? "no summary"} [${p.url}]`
        )
        .join("\n")
    : "(no papers found by Consensus for this query)";

  const prompt = `A researcher has this idea:

Title: ${title}
Notes: ${note ?? "(none)"}

Here are the most relevant existing papers found by Consensus (a peer-reviewed
research search engine):

${papersBlock}

Based ONLY on these papers, do two things:

1. Judge whether this idea is worth pursuing as a novelty/gap check.
2. Separately, judge the idea's overall PUBLICATION POTENTIAL on a 0-10
   scale — how likely a solid piece of work on this topic is to be
   publishable, considering novelty, feasibility as a single-surgeon or
   small-team project, and whether the existing evidence leaves a clear,
   answerable gap. 10 = a clear, feasible, wide-open gap; 0 = thoroughly
   answered already or not really a researchable question. Write a full
   paragraph (4-6 sentences) explaining the score — what's already known,
   what specifically is missing, what kind of study would be needed, and
   any feasibility caveats (e.g. sample size, single-centre limitations).

Respond with ONLY a JSON object, no preamble, no markdown fences, matching
exactly this shape:

{
  "summary": "2-3 sentence plain-language verdict on whether this is worth pursuing and why",
  "novelty_score": <integer 1-5, 5 = wide open gap, 1 = thoroughly covered>,
  "key_papers": [{"title": "...", "year": 2023, "source": "Consensus", "url": "..."}],
  "publication_score": <integer 0-10>,
  "publication_explanation": "the full paragraph described above"
}`;

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 2500,
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

  let parsed: {
    summary: string;
    novelty_score: number;
    key_papers: unknown;
    publication_score: number;
    publication_explanation: string;
  };
  try {
    parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""));
  } catch {
    return NextResponse.json({ error: "Could not parse model output", raw }, { status: 502 });
  }

  const { rows } = await db().query(
    `insert into literature_checks
       (idea_id, summary, novelty_score, key_papers, raw_response, publication_score, publication_explanation)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning *`,
    [
      ideaId,
      parsed.summary,
      parsed.novelty_score,
      JSON.stringify(parsed.key_papers),
      JSON.stringify(data),
      parsed.publication_score,
      parsed.publication_explanation,
    ]
  );

  const accessToken = (session as any).accessToken;
  if (accessToken) {
    syncIdeaToOneDrive(accessToken, { id: ideaId, title, note }, parsed);
  }

  return NextResponse.json(rows[0]);
}
