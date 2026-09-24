import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// Parses RIS format — the standard export format every database (Embase,
// Cochrane, Scopus, Web of Science, etc.) offers. Records are separated by
// a line starting "ER  -"; each line before that is "TAG  - value".
function parseRis(text: string) {
  const records: Record<string, string>[] = [];
  let current: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9])\s*-\s*(.*)$/);
    if (!match) continue;
    const [, tag, value] = match;
    if (tag === "ER") {
      records.push(current);
      current = {};
      continue;
    }
    if (tag === "AU") {
      current.AU = current.AU ? `${current.AU}, ${value}` : value;
    } else if (tag === "TI" || tag === "T1") {
      current.TI = value;
    } else if (tag === "AB" || tag === "N2") {
      current.AB = value;
    } else if (tag === "PY" || tag === "Y1") {
      current.PY = value;
    } else if (tag === "DO") {
      current.DO = value;
    } else if (tag === "UR" || tag === "L1" || tag === "L2") {
      current.UR = current.UR ?? value;
    } else if (tag === "JO" || tag === "JF" || tag === "T2") {
      current.JO = current.JO ?? value;
    }
  }
  return records;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { ideaId, source, risText } = await req.json();
  if (!["embase", "cochrane"].includes(source)) {
    return NextResponse.json({ error: "source must be embase or cochrane" }, { status: 400 });
  }

  const records = parseRis(risText);
  const inserted = [];

  for (const r of records) {
    if (!r.TI) continue;
    const year = r.PY ? parseInt(r.PY.slice(0, 4)) : null;

    const { rows } = await db().query(
      `insert into search_results (idea_id, source, title, authors, journal, year, doi, url, abstract)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (idea_id, doi) where doi is not null do nothing
       returning *`,
      [ideaId, source, r.TI, r.AU ?? null, r.JO ?? null, year, r.DO ?? null, r.UR ?? null, r.AB ?? null]
    );
    if (rows[0]) inserted.push(rows[0]);
  }

  return NextResponse.json({ count: inserted.length, results: inserted });
}
