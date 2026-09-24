import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncIdeaToOneDrive } from "@/lib/graph";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { rows } = await db().query(
    `select * from ideas where owner_id = $1 order by created_at desc`,
    [(session as any).userId]
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { title, note } = await req.json();
  const ownerId = (session as any).userId;

  const { rows } = await db().query(
    `insert into ideas (owner_id, title, note) values ($1, $2, $3) returning *`,
    [ownerId, title, note]
  );
  const idea = rows[0];

  const accessToken = (session as any).accessToken;
  if (accessToken) {
    syncIdeaToOneDrive(accessToken, idea).then((fileId) => {
      if (fileId) {
        db().query(`update ideas set onedrive_file_id = $1 where id = $2`, [fileId, idea.id]);
      }
    });
  }

  return NextResponse.json(idea);
}
