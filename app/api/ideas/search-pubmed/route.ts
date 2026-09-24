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
    `db=pubmed&retmode=json&retmax=100&term=${encodeURIComponent(query)}`;
  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) {
    return NextResponse.json({ error: `PubMed search failed: ${searchRes.status}` }, { status: 502 });
  }
  const searchData = await searchRes.json();
  const pmids: string[] = searchData.esearchresult?.idlist ?? [];

  if (pmids.length === 0) {
    return NextResponse.json({ count: 0, results: [] });
  }

  const summaryUrl =
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?` +
    `db=pubmed&retmode=json&id=${pmids.join(",")}`;
  const summaryRes = await fetch(summaryUrl);
  if (!summaryRes.ok) {
    return NextResponse.json({ error: `PubMed summary failed: ${summaryRes.status}` }, { status: 502 });
  }
  const summaryData = await summaryRes.json();

  const inserted = [];
  for (const pmid of pmids) {
    const item = summaryData.result?.[pmid];
    if (!item) continue;

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

  return NextResponse.json({ count: inserted.length, results: inserted });
}
