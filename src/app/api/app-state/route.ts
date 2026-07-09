import { NextResponse } from "next/server";

import { parsePersistedAppState } from "@/lib/app-state";
import { getCloudflareBindings } from "@/lib/cloudflare-env";
import { getSessionUser, unauthorizedResponse } from "@/lib/server-auth";

const stateKey = "production";
const maxStateBytes = 1_000_000;

type StateRow = {
  value: string;
  updated_at: string;
};

async function getDatabase() {
  const bindings = await getCloudflareBindings();

  return bindings.DB ?? null;
}

export async function GET() {
  const db = await getDatabase();

  if (!db) {
    return NextResponse.json(
      { error: "Cloudflare D1 binding DB is not configured." },
      { status: 503 },
    );
  }

  const user = await getSessionUser(db);

  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const row = await db
      .prepare("select value, updated_at from app_state where key = ?1")
      .bind(stateKey)
      .first<StateRow>();

    if (!row) {
      return NextResponse.json({ state: null, updatedAt: null });
    }

    return NextResponse.json({
      state: JSON.parse(row.value),
      updatedAt: row.updated_at,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to read persisted app state.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const db = await getDatabase();

  if (!db) {
    return NextResponse.json(
      { error: "Cloudflare D1 binding DB is not configured." },
      { status: 503 },
    );
  }

  const user = await getSessionUser(db);

  if (!user) {
    return unauthorizedResponse();
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const state = parsePersistedAppState(
    body && typeof body === "object" && "state" in body
      ? (body as { state?: unknown }).state
      : body,
  );

  if (!state) {
    return NextResponse.json({ error: "Invalid app state." }, { status: 400 });
  }

  const serialized = JSON.stringify(state);

  if (new TextEncoder().encode(serialized).length > maxStateBytes) {
    return NextResponse.json(
      { error: "Persisted app state is too large." },
      { status: 413 },
    );
  }

  try {
    await db
      .prepare(
        `
          insert into app_state (key, value, updated_at)
          values (?1, ?2, datetime('now'))
          on conflict(key) do update set
            value = excluded.value,
            updated_at = excluded.updated_at
        `,
      )
      .bind(stateKey, serialized)
      .run();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to persist app state.",
      },
      { status: 500 },
    );
  }
}
