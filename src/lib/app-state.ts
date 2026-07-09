import type { ScheduleDayState } from "@/lib/booking-state";

export type PersistedAppState = {
  credits: Array<{
    id: string;
    label: string;
    expiry: string;
  }>;
  regularSlotRequests: Array<{
    id: string;
    memberName: string;
    requestedDay: string;
    requestedTime: string;
    effectiveWeek: string;
    note: string;
    status: "pending" | "approved" | "declined";
  }>;
  regularSlotsByMember: Record<
    string,
    Array<{
      id: string;
      day: string;
      time: string;
    }>
  >;
  upcoming: Array<{
    id: string;
    isoDate: string;
    date: string;
    time: string;
    kind: "Regular" | "Makeup" | "Coach override";
  }>;
  waitlist: Array<{
    id: string;
    isoDate: string;
    date: string;
    time: string;
  }>;
  weeklyQuotasByMember: Record<string, number>;
  weeks: Record<string, ScheduleDayState[]>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown) {
  return isObject(value);
}

export function parsePersistedAppState(value: unknown) {
  if (!isObject(value)) {
    return null;
  }

  if (
    !Array.isArray(value.credits) ||
    !Array.isArray(value.regularSlotRequests) ||
    !isStringRecord(value.regularSlotsByMember) ||
    !Array.isArray(value.upcoming) ||
    !Array.isArray(value.waitlist) ||
    !isStringRecord(value.weeklyQuotasByMember) ||
    !isStringRecord(value.weeks)
  ) {
    return null;
  }

  return value as PersistedAppState;
}
