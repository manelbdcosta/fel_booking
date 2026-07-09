"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Dumbbell,
  Plus,
  UsersRound,
  X,
} from "lucide-react";

import { bookingRules } from "@/lib/booking-config";

type SlotState = "available" | "mine" | "full";

type ScheduleSlot = {
  time: string;
  names: string[];
};

type ScheduleDay = {
  day: string;
  date: string;
  isoDate: string;
  slots: ScheduleSlot[];
};

type SelectedSlot = {
  weekOffset: number;
  dayIndex: number;
  slotIndex: number;
};

type Credit = {
  id: string;
  label: string;
  expiry: string;
};

type UpcomingBooking = {
  id: string;
  isoDate: string;
  date: string;
  time: string;
  kind: "Regular" | "Makeup";
};

type WaitlistEntry = {
  id: string;
  isoDate: string;
  date: string;
  time: string;
};

const member = {
  firstName: "Amira",
  weeklyQuota: 2,
};

const metricsBase = [
  { label: "Attended", value: "42", icon: CheckCircle2 },
  { label: "Missed", value: "1", icon: AlertTriangle },
];

const initialCredits: Credit[] = [
  { id: "credit-1", label: "Thu 16 Jul", expiry: "13 Aug" },
  { id: "credit-2", label: "Mon 20 Jul", expiry: "17 Aug" },
];

const initialUpcoming: UpcomingBooking[] = [
  {
    id: "booking-1",
    isoDate: "2026-07-13",
    date: "Mon 13 Jul",
    time: "06:30",
    kind: "Regular",
  },
  {
    id: "booking-2",
    isoDate: "2026-07-16",
    date: "Thu 16 Jul",
    time: "07:00",
    kind: "Regular",
  },
  {
    id: "booking-3",
    isoDate: "2026-07-17",
    date: "Fri 17 Jul",
    time: "08:30",
    kind: "Makeup",
  },
];

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const slotTemplates: Array<Array<Omit<ScheduleSlot, "time">>> = [
  [
    { names: ["Amira", "Finn"] },
    { names: ["Maya", "Tom", "Liv", "Noah"] },
    { names: ["Cara"] },
    { names: ["Finn", "Dev"] },
    { names: ["Iris"] },
  ],
  [
    { names: ["Gia"] },
    { names: ["Dev"] },
    { names: [] },
    { names: ["Ben"] },
    { names: [] },
  ],
  [
    { names: ["Finn"] },
    { names: [] },
    { names: ["Cara", "Maya", "Sam"] },
    { names: ["Liv", "Noah", "Oli", "Rae"] },
    { names: ["Gia"] },
  ],
  [
    { names: ["Iris"] },
    { names: ["Amira", "Dev"] },
    { names: ["Oli"] },
    { names: ["Dev"] },
    { names: [] },
  ],
  [
    { names: ["Ella"] },
    { names: ["Gia"] },
    { names: [] },
    { names: ["Jonah"] },
    { names: ["Amira", "Cara"] },
  ],
];

function addDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));

  return date.toISOString().slice(0, 10);
}

function shortDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: bookingRules.timeZone,
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function weekStartForOffset(offset: number) {
  return addDays("2026-07-13", offset * 7);
}

function weekRangeLabel(offset: number) {
  const start = weekStartForOffset(offset);

  return `${shortDate(start)} - ${shortDate(addDays(start, 4))}`;
}

function buildWeek(offset: number): ScheduleDay[] {
  const start = weekStartForOffset(offset);

  return dayNames.map((day, dayIndex) => {
    const isoDate = addDays(start, dayIndex);

    return {
      day,
      date: shortDate(isoDate),
      isoDate,
      slots: bookingRules.slotTimes.map((time, slotIndex) => ({
        time,
        names: [...slotTemplates[dayIndex][slotIndex].names],
      })),
    };
  });
}

function cloneWeek(week: ScheduleDay[]) {
  return week.map((day) => ({
    ...day,
    slots: day.slots.map((slot) => ({ ...slot, names: [...slot.names] })),
  }));
}

function slotState(slot: ScheduleSlot): SlotState {
  if (slot.names.includes(member.firstName)) {
    return "mine";
  }

  if (slot.names.length >= bookingRules.slotCapacity) {
    return "full";
  }

  return "available";
}

function slotClasses(state: SlotState) {
  const base =
    "min-h-24 rounded-lg border p-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--mint)]";

  if (state === "mine") {
    return `${base} border-[var(--mint)] bg-[rgba(0,255,184,0.14)] text-white`;
  }

  if (state === "full") {
    return `${base} border-[rgba(255,78,184,0.55)] bg-[rgba(255,78,184,0.08)] text-white`;
  }

  return `${base} border-[var(--line)] bg-[var(--panel)] text-white hover:border-[var(--orange)]`;
}

function bookingLabel(day: ScheduleDay) {
  return `${day.day} ${day.date}`;
}

export default function Home() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [weeks, setWeeks] = useState<Record<number, ScheduleDay[]>>({
    0: buildWeek(0),
  });
  const [credits, setCredits] = useState(initialCredits);
  const [upcoming, setUpcoming] = useState(initialUpcoming);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);
  const [message, setMessage] = useState("Ready for bookings");

  const week = weeks[weekOffset] ?? buildWeek(weekOffset);

  const availableSlots = useMemo(
    () =>
      week.flatMap((day, dayIndex) =>
        day.slots
          .map((slot, slotIndex) => ({ day, dayIndex, slot, slotIndex }))
          .filter(({ slot }) => slotState(slot) === "available"),
      ),
    [week],
  );

  const selectedDetails =
    selectedSlot?.weekOffset === weekOffset
      ? {
          day: week[selectedSlot.dayIndex],
          slot: week[selectedSlot.dayIndex].slots[selectedSlot.slotIndex],
          dayIndex: selectedSlot.dayIndex,
          slotIndex: selectedSlot.slotIndex,
        }
      : null;

  const activeBookingsThisWeek = week.reduce(
    (count, day) =>
      count +
      day.slots.filter((slot) => slot.names.includes(member.firstName)).length,
    0,
  );

  const metrics = [
    ...metricsBase,
    { label: "Credits", value: String(credits.length), icon: Clock3 },
  ];

  function updateSlot(
    dayIndex: number,
    slotIndex: number,
    updater: (slot: ScheduleSlot) => ScheduleSlot,
  ) {
    setWeeks((previous) => {
      const current = cloneWeek(previous[weekOffset] ?? buildWeek(weekOffset));
      current[dayIndex].slots[slotIndex] = updater(current[dayIndex].slots[slotIndex]);

      return { ...previous, [weekOffset]: current };
    });
  }

  function bookSlot(dayIndex: number, slotIndex: number) {
    const day = week[dayIndex];
    const slot = day.slots[slotIndex];
    const state = slotState(slot);

    if (state === "mine") {
      setMessage(`${bookingLabel(day)} at ${slot.time} is already booked.`);
      return;
    }

    if (state === "full") {
      joinWaitlist(dayIndex, slotIndex);
      return;
    }

    const needsCredit = activeBookingsThisWeek >= member.weeklyQuota;

    if (needsCredit && credits.length === 0) {
      setMessage("Weekly quota reached. A coach override would be needed.");
      return;
    }

    updateSlot(dayIndex, slotIndex, (currentSlot) => ({
      ...currentSlot,
      names: [...currentSlot.names, member.firstName],
    }));

    const kind = needsCredit ? "Makeup" : "Regular";

    if (needsCredit) {
      setCredits((currentCredits) => currentCredits.slice(1));
    }

    setUpcoming((currentUpcoming) => [
      ...currentUpcoming,
      {
        id: `booking-${day.isoDate}-${slot.time}`,
        isoDate: day.isoDate,
        date: bookingLabel(day),
        time: slot.time,
        kind,
      },
    ]);
    setWaitlist((entries) =>
      entries.filter(
        (entry) => !(entry.isoDate === day.isoDate && entry.time === slot.time),
      ),
    );
    setSelectedSlot({ weekOffset, dayIndex, slotIndex });
    setBookingOpen(false);
    setMessage(`${kind} booked for ${bookingLabel(day)} at ${slot.time}.`);
  }

  function cancelSlot(dayIndex: number, slotIndex: number) {
    const day = week[dayIndex];
    const slot = day.slots[slotIndex];
    const matchingBooking = upcoming.find(
      (booking) => booking.isoDate === day.isoDate && booking.time === slot.time,
    );

    updateSlot(dayIndex, slotIndex, (currentSlot) => ({
      ...currentSlot,
      names: currentSlot.names.filter((name) => name !== member.firstName),
    }));

    setUpcoming((currentUpcoming) =>
      currentUpcoming.filter(
        (booking) => !(booking.isoDate === day.isoDate && booking.time === slot.time),
      ),
    );

    if (matchingBooking?.kind !== "Makeup") {
      setCredits((currentCredits) => [
        ...currentCredits,
        {
          id: `credit-${day.isoDate}-${slot.time}`,
          label: bookingLabel(day),
          expiry: shortDate(addDays(day.isoDate, bookingRules.creditExpiryDays)),
        },
      ]);
      setMessage(`Cancelled ${bookingLabel(day)} at ${slot.time}. Credit issued.`);
    } else {
      setMessage(`Cancelled makeup booking for ${bookingLabel(day)} at ${slot.time}.`);
    }
  }

  function joinWaitlist(dayIndex: number, slotIndex: number) {
    const day = week[dayIndex];
    const slot = day.slots[slotIndex];
    const alreadyJoined = waitlist.some(
      (entry) => entry.isoDate === day.isoDate && entry.time === slot.time,
    );

    if (alreadyJoined) {
      setWaitlist((entries) =>
        entries.filter(
          (entry) => !(entry.isoDate === day.isoDate && entry.time === slot.time),
        ),
      );
      setMessage(`Left waitlist for ${bookingLabel(day)} at ${slot.time}.`);
      return;
    }

    if (activeBookingsThisWeek >= member.weeklyQuota && credits.length === 0) {
      setMessage("Weekly quota reached. A coach override would be needed.");
      return;
    }

    setWaitlist((entries) => [
      ...entries,
      {
        id: `waitlist-${day.isoDate}-${slot.time}`,
        isoDate: day.isoDate,
        date: bookingLabel(day),
        time: slot.time,
      },
    ]);
    setMessage(`Joined waitlist for ${bookingLabel(day)} at ${slot.time}.`);
  }

  function moveWeek(direction: -1 | 1) {
    setSelectedSlot(null);
    setWeekOffset((currentOffset) => Math.min(3, Math.max(0, currentOffset + direction)));
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="relative border-b border-[var(--line)] bg-black/20">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--mint)] bg-[rgba(0,255,184,0.12)]">
              <Dumbbell aria-hidden="true" className="size-5 text-[var(--mint)]" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm text-[var(--muted)]">Fit East London</p>
              <h1 className="truncate text-xl font-semibold">Booking</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="relative flex size-10 items-center justify-center rounded-md border border-[var(--line)] text-[var(--muted)] hover:border-[var(--mint)] hover:text-white"
              type="button"
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
              title="Notifications"
              onClick={() => setNotificationsOpen((open) => !open)}
            >
              <Bell aria-hidden="true" className="size-5" />
              {!notificationsRead && (
                <span className="absolute right-2 top-2 size-2 rounded-full bg-[var(--pink)]" />
              )}
            </button>
            <button
              className="flex items-center gap-2 rounded-md bg-[var(--mint)] px-3 py-2 text-sm font-semibold text-[#01161c] hover:bg-white"
              type="button"
              onClick={() => setBookingOpen(true)}
            >
              <Plus aria-hidden="true" className="size-4" />
              Book
            </button>
          </div>
        </div>

        {notificationsOpen && (
          <div className="absolute right-4 top-[68px] z-20 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3 shadow-2xl sm:right-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Notifications</h2>
              <button
                className="flex size-8 items-center justify-center rounded-md text-[var(--muted)] hover:bg-white/10 hover:text-white"
                type="button"
                aria-label="Close notifications"
                title="Close"
                onClick={() => setNotificationsOpen(false)}
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="rounded-lg border border-[var(--line)] bg-black/20 p-3">
                Credit from Thu 16 Jul expires on 13 Aug.
              </div>
              <div className="rounded-lg border border-[var(--line)] bg-black/20 p-3">
                Fri 08:30 has 2 spots available.
              </div>
            </div>
            <button
              className="mt-3 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)] hover:border-[var(--mint)] hover:text-white"
              type="button"
              onClick={() => {
                setNotificationsRead(true);
                setNotificationsOpen(false);
                setMessage("Notifications marked read.");
              }}
            >
              Mark read
            </button>
          </div>
        )}
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-5">
          <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-[var(--muted)]">Member</p>
                <h2 className="mt-1 text-2xl font-semibold">{member.firstName}</h2>
              </div>
              <div className="rounded-md border border-[var(--orange)] px-2 py-1 text-sm text-[var(--orange)]">
                {member.weeklyQuota}x weekly
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {metrics.map((metric) => (
                <div
                  className="rounded-lg border border-[var(--line)] bg-black/20 p-3"
                  key={metric.label}
                >
                  <metric.icon aria-hidden="true" className="size-4 text-[var(--mint)]" />
                  <div className="mt-3 text-2xl font-semibold">{metric.value}</div>
                  <div className="text-xs text-[var(--muted)]">{metric.label}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Upcoming</h2>
              <CalendarDays aria-hidden="true" className="size-5 text-[var(--orange)]" />
            </div>
            <div className="space-y-2">
              {upcoming.length > 0 ? (
                upcoming.map((booking) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-black/20 p-3"
                    key={booking.id}
                  >
                    <div>
                      <div className="font-medium">{booking.date}</div>
                      <div className="text-sm text-[var(--muted)]">{booking.kind}</div>
                    </div>
                    <div className="text-sm font-semibold text-[var(--mint)]">
                      {booking.time}
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-[var(--line)] bg-black/20 p-3 text-sm text-[var(--muted)]">
                  No upcoming bookings.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Credits</h2>
              <Clock3 aria-hidden="true" className="size-5 text-[var(--pink)]" />
            </div>
            <div className="space-y-2">
              {credits.length > 0 ? (
                credits.map((credit) => (
                  <div
                    className="rounded-lg border border-[rgba(255,78,184,0.4)] bg-[rgba(255,78,184,0.08)] p-3"
                    key={credit.id}
                  >
                    <div className="font-medium">{credit.label}</div>
                    <div className="text-sm text-[var(--muted)]">
                      Expires {credit.expiry}
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-[var(--line)] bg-black/20 p-3 text-sm text-[var(--muted)]">
                  No available credits.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Waitlist</h2>
              <UsersRound aria-hidden="true" className="size-5 text-[var(--olive)]" />
            </div>
            <div className="space-y-2">
              {waitlist.length > 0 ? (
                waitlist.map((entry) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-black/20 p-3"
                    key={entry.id}
                  >
                    <div>
                      <div className="font-medium">{entry.date}</div>
                      <div className="text-sm text-[var(--muted)]">Waitlisted</div>
                    </div>
                    <div className="text-sm font-semibold text-[var(--olive)]">
                      {entry.time}
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-[var(--line)] bg-black/20 p-3 text-sm text-[var(--muted)]">
                  No waitlist entries.
                </p>
              )}
            </div>
          </section>
        </aside>

        <section className="min-w-0 rounded-lg border border-[var(--line)] bg-[rgba(9,36,44,0.82)]">
          <div className="flex flex-col gap-4 border-b border-[var(--line)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <UsersRound aria-hidden="true" className="size-4" />
                Coach view
              </div>
              <h2 className="mt-1 text-2xl font-semibold">Week schedule</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{message}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="flex size-10 items-center justify-center rounded-md border border-[var(--line)] text-[var(--muted)] enabled:hover:border-[var(--mint)] enabled:hover:text-white disabled:opacity-40"
                type="button"
                aria-label="Previous week"
                title="Previous week"
                disabled={weekOffset === 0}
                onClick={() => moveWeek(-1)}
              >
                <ArrowLeft aria-hidden="true" className="size-5" />
              </button>
              <div className="rounded-md border border-[var(--line)] px-3 py-2 text-sm text-white">
                {weekRangeLabel(weekOffset)}
              </div>
              <button
                className="flex size-10 items-center justify-center rounded-md border border-[var(--line)] text-[var(--muted)] enabled:hover:border-[var(--mint)] enabled:hover:text-white disabled:opacity-40"
                type="button"
                aria-label="Next week"
                title="Next week"
                disabled={weekOffset === 3}
                onClick={() => moveWeek(1)}
              >
                <ArrowRight aria-hidden="true" className="size-5" />
              </button>
            </div>
          </div>

          {selectedDetails && (
            <div className="border-b border-[var(--line)] bg-black/20 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold">
                    {bookingLabel(selectedDetails.day)} at {selectedDetails.slot.time}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {selectedDetails.slot.names.length > 0
                      ? selectedDetails.slot.names.join(", ")
                      : "Open"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {slotState(selectedDetails.slot) === "mine" && (
                    <button
                      className="rounded-md border border-[rgba(255,78,184,0.55)] px-3 py-2 text-sm text-[var(--pink)] hover:bg-[rgba(255,78,184,0.1)]"
                      type="button"
                      onClick={() =>
                        cancelSlot(selectedDetails.dayIndex, selectedDetails.slotIndex)
                      }
                    >
                      Cancel
                    </button>
                  )}
                  {slotState(selectedDetails.slot) === "available" && (
                    <button
                      className="rounded-md bg-[var(--mint)] px-3 py-2 text-sm font-semibold text-[#01161c] hover:bg-white"
                      type="button"
                      onClick={() =>
                        bookSlot(selectedDetails.dayIndex, selectedDetails.slotIndex)
                      }
                    >
                      Book spot
                    </button>
                  )}
                  {slotState(selectedDetails.slot) === "full" && (
                    <button
                      className="rounded-md border border-[var(--olive)] px-3 py-2 text-sm text-[var(--olive)] hover:bg-white/10"
                      type="button"
                      onClick={() =>
                        joinWaitlist(selectedDetails.dayIndex, selectedDetails.slotIndex)
                      }
                    >
                      {waitlist.some(
                        (entry) =>
                          entry.isoDate === selectedDetails.day.isoDate &&
                          entry.time === selectedDetails.slot.time,
                      )
                        ? "Leave waitlist"
                        : "Join waitlist"}
                    </button>
                  )}
                  <button
                    className="flex size-10 items-center justify-center rounded-md text-[var(--muted)] hover:bg-white/10 hover:text-white"
                    type="button"
                    aria-label="Close slot details"
                    title="Close"
                    onClick={() => setSelectedSlot(null)}
                  >
                    <X aria-hidden="true" className="size-5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-3 p-4 lg:grid-cols-5">
            {week.map((day, dayIndex) => (
              <div className="min-w-0" key={day.day}>
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <h3 className="text-lg font-semibold">{day.day}</h3>
                  <span className="text-sm text-[var(--muted)]">{day.date}</span>
                </div>
                <div className="grid gap-2">
                  {day.slots.map((slot, slotIndex) => {
                    const state = slotState(slot);
                    const spotsLeft = bookingRules.slotCapacity - slot.names.length;

                    return (
                      <button
                        className={slotClasses(state)}
                        key={`${day.day}-${slot.time}`}
                        type="button"
                        onClick={() =>
                          setSelectedSlot({ weekOffset, dayIndex, slotIndex })
                        }
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-base font-semibold">{slot.time}</span>
                          <span className="text-xs text-[var(--muted)]">
                            {state === "full" ? "Waitlist" : `${spotsLeft} spots`}
                          </span>
                        </div>
                        <div className="mt-3 min-h-10 text-sm text-[var(--muted)]">
                          {slot.names.length > 0 ? slot.names.join(", ") : "Open"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {bookingOpen && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/60 p-4 sm:items-center sm:justify-center">
          <div className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Book a session</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {weekRangeLabel(weekOffset)}
                </p>
              </div>
              <button
                className="flex size-10 items-center justify-center rounded-md text-[var(--muted)] hover:bg-white/10 hover:text-white"
                type="button"
                aria-label="Close booking"
                title="Close"
                onClick={() => setBookingOpen(false)}
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>

            <div className="grid gap-2">
              {availableSlots.length > 0 ? (
                availableSlots.slice(0, 8).map(({ day, dayIndex, slot, slotIndex }) => (
                  <button
                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-black/20 p-3 text-left hover:border-[var(--mint)]"
                    key={`${day.isoDate}-${slot.time}`}
                    type="button"
                    onClick={() => bookSlot(dayIndex, slotIndex)}
                  >
                    <div>
                      <div className="font-medium">
                        {bookingLabel(day)} at {slot.time}
                      </div>
                      <div className="text-sm text-[var(--muted)]">
                        {bookingRules.slotCapacity - slot.names.length} spots left
                      </div>
                    </div>
                    <Plus aria-hidden="true" className="size-5 text-[var(--mint)]" />
                  </button>
                ))
              ) : (
                <p className="rounded-lg border border-[var(--line)] bg-black/20 p-3 text-sm text-[var(--muted)]">
                  No open slots this week.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
