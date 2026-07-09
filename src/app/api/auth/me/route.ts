import { NextResponse } from "next/server";

import { requireDatabase } from "@/lib/database";
import { getSessionUser } from "@/lib/server-auth";

export async function GET() {
  const db = await requireDatabase();
  const user = await getSessionUser(db);

  if (!user) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({ user });
}
