import { NextResponse } from "next/server";

import { requireDatabase } from "@/lib/database";
import { readBootstrapData } from "@/lib/member-data";
import { getSessionUser, unauthorizedResponse } from "@/lib/server-auth";

export async function GET() {
  try {
    const db = await requireDatabase();
    const user = await getSessionUser(db);

    if (!user) {
      return unauthorizedResponse();
    }

    const data = await readBootstrapData(db);

    if (user.role === "member") {
      const memberSafeData = {
        ...data,
        coachAccounts: undefined,
        pendingInvites: undefined,
      };
      const member = data.members.find((currentMember) => currentMember.id === user.id);
      const memberName = member
        ? `${member.firstName} ${member.lastName}`
        : `${user.firstName} ${user.lastName}`;

      return NextResponse.json({
        ...memberSafeData,
        members: member ? [member] : [],
        regularSlotRequests: data.regularSlotRequests.filter(
          (request) => request.memberName === memberName,
        ),
        regularSlotsByMember: {
          [user.id]: data.regularSlotsByMember[user.id] ?? [],
        },
        weeklyQuotasByMember: {
          [user.id]: data.weeklyQuotasByMember[user.id] ?? 1,
        },
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load booking data.",
      },
      { status: 503 },
    );
  }
}
