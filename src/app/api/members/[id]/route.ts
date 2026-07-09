import { NextResponse } from "next/server";

import { cleanText, requireDatabase } from "@/lib/database";
import { forbiddenResponse, getSessionUser, unauthorizedResponse } from "@/lib/server-auth";

type MemberParams = {
  params: Promise<{ id: string }>;
};

type MemberStatus = "pending" | "active" | "archived";

function isMemberStatus(value: unknown): value is MemberStatus {
  return value === "pending" || value === "active" || value === "archived";
}

export async function PATCH(request: Request, { params }: MemberParams) {
  const { id } = await params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const status = record.status;
  const weeklyQuota = Number(record.weeklyQuota);

  if (!isMemberStatus(status)) {
    return NextResponse.json({ error: "Invalid member status." }, { status: 400 });
  }

  if (!Number.isFinite(weeklyQuota) || weeklyQuota < 1 || weeklyQuota > 5) {
    return NextResponse.json(
      { error: "Weekly quota must be between 1 and 5." },
      { status: 400 },
    );
  }

  const db = await requireDatabase();
  const user = await getSessionUser(db);

  if (!user) {
    return unauthorizedResponse();
  }

  if (user.role !== "coach") {
    return forbiddenResponse();
  }

  await db
    .prepare(
      `
        update members
        set
          status = ?1,
          weekly_quota = ?2,
          updated_at = datetime('now')
        where id = ?3 and role = 'member'
      `,
    )
    .bind(status, Math.round(weeklyQuota), cleanText(id, 120))
    .run();

  return NextResponse.json({ ok: true });
}
