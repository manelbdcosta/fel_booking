import { NextResponse } from "next/server";

import { requireDatabase } from "@/lib/database";
import { readScheduleData } from "@/lib/schedule-data";
import { getSessionUser, unauthorizedResponse } from "@/lib/server-auth";

export async function GET(request: Request) {
  const db = await requireDatabase();
  const user = await getSessionUser(db);

  if (!user) {
    return unauthorizedResponse();
  }

  const url = new URL(request.url);

  try {
    const schedule = await readScheduleData(db, user, {
      memberId: url.searchParams.get("memberId") ?? undefined,
      weekStart: url.searchParams.get("weekStart") ?? undefined,
    });

    return NextResponse.json(schedule);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load schedule.",
      },
      { status: 400 },
    );
  }
}
