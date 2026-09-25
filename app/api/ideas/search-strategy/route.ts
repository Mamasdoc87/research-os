import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { ideaId, title, note } = await req.json();

  const prompt = `A researcher wants to run a systematic search for this topic:

Title: ${title}
Notes: ${note ?? "(none)"}

Write proper advance search strings for three databases: PubMed/MEDLINE,
Embase, and Cochrane CENTRAL. Use correct field tags and boolean syntax for
each database (e.g. PubMed uses [MeSH Terms], [tiab]; Embase uses /exp,
:ti,ab; Cochrane uses MeSH descriptor, :ti,ab,kw). Include relevant
synonyms, spelling variants, and MeSH/Emtree terms where appropriate,
combined with AND/OR exactly as that database's engine expects.

Favor sensitivity (broad recall) over precision, as is standard practice
for systematic review searches — it's far worse to miss a true match than
to retrieve some irrelevant results a human will screen out. The one
exception: if any search term is also a common, unrelated anatomical
structure or concept (e.g. "biceps" alone would also match "biceps
femoris," an unrelated hamstring tendon), use the more specific compound
term (e.g. "distal biceps brachii" / "biceps brachii tendon") rather than
the bare ambiguous word, so the search doesn't fill with results about a
completely different body part. Do not otherwise narrow the search.

Respond with ONLY a JSON object, no preamble, no markdown fences:

{
  "pubmed_query": "the full PubMed search string",
  "embase_query": "the full Embase search string",
  "cochrane_query": "the full Cochrane CENTRAL search string",
  "notes": "1-2 sentences on any scoping decisions or caveats a reviewer should know"
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
      max_tokens: 4000,
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
    pubmed_query: string;
    embase_query: string;
    cochrane_query: string;
    notes: string;
  };
  try {
    parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""));
  } catch {
    return NextResponse.json({ error: "Could not parse model output", raw }, { status: 502 });
  }

  const { rows } = await db().query(
    `insert into search_strategies (idea_id, pubmed_query, embase_query, cochrane_query, notes, raw_response)
     values ($1, $2, $3, $4, $5, $6) returning *`,
    [
      ideaId,
      parsed.pubmed_query,
      parsed.embase_query,
      parsed.cochrane_query,
      parsed.notes,
      JSON.stringify(data),
    ]
  );

  return NextResponse.json(rows[0]);
}
