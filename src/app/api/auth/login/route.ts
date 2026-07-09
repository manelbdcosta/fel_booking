import { NextResponse } from "next/server";

import { normalizeEmail, requireDatabase } from "@/lib/database";
import { cleanPassword, verifyPassword } from "@/lib/passwords";
import { createSessionCookie, sessionUserPayload } from "@/lib/session";

type MemberRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: "member" | "coach";
  status: "pending" | "active" | "archived";
  password_hash: string | null;
};

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const email = normalizeEmail(record.email);
  const password = cleanPassword(record.password);

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  const db = await requireDatabase();
  const member = await db
    .prepare(
      `
        select
          id,
          first_name,
          last_name,
          email,
          role,
          status,
          password_hash
        from members
        where email = ?1
      `,
    )
    .bind(email)
    .first<MemberRow>();

  if (!member || !(await verifyPassword(password, member.password_hash))) {
    return NextResponse.json(
      { error: "Email or password is incorrect." },
      { status: 401 },
    );
  }

  if (member.status !== "active") {
    return NextResponse.json(
      { error: "This account is waiting for coach approval." },
      { status: 403 },
    );
  }

  await createSessionCookie(db, member);

  return NextResponse.json({ user: sessionUserPayload(member) });
}
