import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { sessionCookieName } from "@/lib/auth-tokens";
import { getDatabase } from "@/lib/database";

export async function POST() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(sessionCookieName)?.value;
  const db = await getDatabase();

  if (db && sessionId) {
    await db.prepare("delete from sessions where id = ?1").bind(sessionId).run();
  }

  cookieStore.delete(sessionCookieName);

  return NextResponse.json({ ok: true });
}
