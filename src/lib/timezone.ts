import { fromZonedTime } from "date-fns-tz";

import { bookingConfig } from "@/lib/booking-config";

export type IsoDate = `${number}-${number}-${number}`;

export function addIsoDays(date: IsoDate, days: number): IsoDate {
  const [year, month, day] = date.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day + days));

  return utcDate.toISOString().slice(0, 10) as IsoDate;
}

export function cutoffInstantForSession(sessionDate: IsoDate): Date {
  const cutoffDate = addIsoDays(sessionDate, -1);

  return fromZonedTime(
    `${cutoffDate}T${String(bookingConfig.cutoffHour).padStart(2, "0")}:00:00`,
    bookingConfig.timeZone,
  );
}

export function isBeforeMemberCutoff(sessionDate: IsoDate, now = new Date()) {
  return now <= cutoffInstantForSession(sessionDate);
}
