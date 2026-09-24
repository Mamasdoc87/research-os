import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const ideaId = req.nextUrl.searchParams.get("ideaId");
  const { rows } = await db().query(
    `select * from search_results where idea_id = $1 order by created_at desc`,
    [ideaId]
  );
  return NextResponse.json(rows);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { resultId, decision } = await req.json();
  if (!["pending", "include", "exclude"].includes(decision)) {
    return NextResponse.json({ error: "invalid decision" }, { status: 400 });
  }

  const { rows } = await db().query(
    `update search_results set decision = $1 where id = $2 returning *`,
    [decision, resultId]
  );
  return NextResponse.json(rows[0]);
}
