import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// NCBI's E-utilities are free and need no API key for light use (we're
// well under their rate limit for a single-user tool like this). Two
// calls: esearch to get matching PMIDs, then esummary to get the actual
// titles/authors/journal/year for those PMIDs.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { ideaId, query } = await req.json();

  const searchUrl =
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?` +
    `db=pubmed&retmode=json&retmax=10000&term=${encodeURIComponent(query)}`;
  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) {
    return NextResponse.json({ error: `PubMed search failed: ${searchRes.status}` }, { status: 502 });
  }
  const searchData = await searchRes.json();
  const pmids: string[] = searchData.esearchresult?.idlist ?? [];

  if (pmids.length === 0) {
    return NextResponse.json({ count: 0, results: [] });
  }

  // esummary can choke on very long URLs, so fetch in batches of 200 — and
  // run the batches in parallel (a few hundred at a time) rather than one
  // after another, so a large result set doesn't time out.
  const batches: string[][] = [];
  for (let i = 0; i < pmids.length; i += 200) batches.push(pmids.slice(i, i + 200));

  const summaryItems: Record<string, any> = {};
  const CONCURRENCY = 5;
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const group = batches.slice(i, i + CONCURRENCY);
    const responses = await Promise.all(
      group.map((batch) =>
        fetch(
          `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?` +
            `db=pubmed&retmode=json&id=${batch.join(",")}`
        )
      )
    );
    for (const res of responses) {
      if (!res.ok) continue; // skip a failed batch rather than aborting the whole search
      const data = await res.json();
      Object.assign(summaryItems, data.result ?? {});
    }
  }

  const validPmids = pmids.filter((pmid) => summaryItems[pmid]);
  const inserted: any[] = [];
  const INSERT_CONCURRENCY = 20;

  async function insertOne(pmid: string) {
    const item = summaryItems[pmid];
    const authors = (item.authors ?? []).map((a: any) => a.name).join(", ");
    const year = item.pubdate ? parseInt(item.pubdate.slice(0, 4)) : null;
    const doi = item.elocationid?.startsWith("doi:")
      ? item.elocationid.replace("doi: ", "").trim()
      : null;

    const { rows } = await db().query(
      `insert into search_results (idea_id, source, external_id, title, authors, journal, year, doi, url)
       values ($1, 'pubmed', $2, $3, $4, $5, $6, $7, $8)
       on conflict (idea_id, doi) where doi is not null do nothing
       returning *`,
      [
        ideaId,
        pmid,
        item.title,
        authors,
        item.fulljournalname ?? item.source,
        year,
        doi,
        `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      ]
    );
    if (rows[0]) inserted.push(rows[0]);
  }

  for (let i = 0; i < validPmids.length; i += INSERT_CONCURRENCY) {
    const group = validPmids.slice(i, i + INSERT_CONCURRENCY);
    await Promise.all(group.map(insertOne));
  }

  return NextResponse.json({ count: inserted.length, results: inserted });
}
