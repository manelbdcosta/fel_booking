export const bookingRules = {
  timeZone: "Europe/London",
  slotTimes: ["06:30", "07:00", "07:30", "08:00", "08:30"] as const,
  sessionWeekdays: [1, 2, 3, 4, 5] as const,
  slotCapacity: 4,
  bookingHorizonWeeks: 4,
  cutoffHour: 20,
  creditExpiryDays: 28,
  noShowWindowDays: 7,
};

export const bookingConfig = {
  ...bookingRules,
  creditOnNoShow: process.env.CREDIT_ON_NO_SHOW !== "false",
};

export type SlotTime = (typeof bookingRules.slotTimes)[number];
export type SessionWeekday = (typeof bookingRules.sessionWeekdays)[number];
