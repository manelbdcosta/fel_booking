import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  createSessionId,
  hashToken,
  isoInDays,
  sessionCookieName,
} from "@/lib/auth-tokens";
import { normalizeEmail, requireDatabase } from "@/lib/database";

type AuthTokenRow = {
  id: string;
  member_id: string;
};

type MemberRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: "member" | "coach";
  status: "pending" | "active" | "archived";
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
  const token = typeof record.token === "string" ? record.token.trim() : "";

  if (!email || !token) {
    return NextResponse.json(
      { error: "Email and token are required." },
      { status: 400 },
    );
  }

  const db = await requireDatabase();
  const tokenHash = await hashToken(token);
  const authToken = await db
    .prepare(
      `
        select id, member_id
        from auth_tokens
        where
          email = ?1
          and token_hash = ?2
          and purpose = 'sign-in'
          and used_at is null
          and unixepoch(expires_at) > unixepoch('now')
      `,
    )
    .bind(email, tokenHash)
    .first<AuthTokenRow>();

  if (!authToken) {
    return NextResponse.json(
      { error: "This sign-in link is invalid or expired." },
      { status: 401 },
    );
  }

  const member = await db
    .prepare(
      `
        select id, first_name, last_name, email, role, status
        from members
        where id = ?1
      `,
    )
    .bind(authToken.member_id)
    .first<MemberRow>();

  if (!member || member.status !== "active") {
    return NextResponse.json(
      { error: "This account is not active." },
      { status: 403 },
    );
  }

  const sessionId = createSessionId();
  const expiresAt = isoInDays(30);

  await db
    .prepare("update auth_tokens set used_at = datetime('now') where id = ?1")
    .bind(authToken.id)
    .run();
  await db
    .prepare(
      "insert into sessions (id, member_id, expires_at) values (?1, ?2, ?3)",
    )
    .bind(sessionId, member.id, expiresAt)
    .run();

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, sessionId, {
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return NextResponse.json({
    user: {
      id: member.id,
      firstName: member.first_name,
      lastName: member.last_name,
      email: member.email,
      role: member.role,
    },
  });
}
