import { NextResponse } from "next/server";

import {
  markCoachNotificationsRead,
  readCoachNotifications,
} from "@/lib/coach-notifications";
import { requireDatabase } from "@/lib/database";
import {
  forbiddenResponse,
  getSessionUser,
  unauthorizedResponse,
} from "@/lib/server-auth";

export async function GET() {
  const db = await requireDatabase();
  const user = await getSessionUser(db);

  if (!user) {
    return unauthorizedResponse();
  }

  if (user.role !== "coach") {
    return forbiddenResponse();
  }

  return NextResponse.json({
    notifications: await readCoachNotifications(db),
  });
}

export async function POST() {
  const db = await requireDatabase();
  const user = await getSessionUser(db);

  if (!user) {
    return unauthorizedResponse();
  }

  if (user.role !== "coach") {
    return forbiddenResponse();
  }

  await markCoachNotificationsRead(db);

  return NextResponse.json({ ok: true });
}
