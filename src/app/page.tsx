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
} from "lucide-react";

import { bookingConfig } from "@/lib/booking-config";

type SlotState = "available" | "mine" | "full" | "closed";

type ScheduleSlot = {
  time: string;
  names: string[];
  state: SlotState;
};

const member = {
  firstName: "Amira",
  weeklyQuota: 2,
  credits: [
    { label: "Thu 16 Jul", expiry: "13 Aug" },
    { label: "Mon 20 Jul", expiry: "17 Aug" },
  ],
};

const metrics = [
  { label: "Attended", value: "42", icon: CheckCircle2 },
  { label: "Missed", value: "1", icon: AlertTriangle },
  { label: "Credits", value: "2", icon: Clock3 },
];

const upcoming = [
  { date: "Mon 13 Jul", time: "06:30", kind: "Regular" },
  { date: "Thu 16 Jul", time: "07:00", kind: "Regular" },
  { date: "Fri 17 Jul", time: "08:30", kind: "Makeup" },
];

const schedule: Array<{ day: string; date: string; slots: ScheduleSlot[] }> = [
  {
    day: "Mon",
    date: "13 Jul",
    slots: [
      { time: "06:30", names: ["Amira", "Finn"], state: "mine" },
      { time: "07:00", names: ["Maya", "Tom", "Liv", "Noah"], state: "full" },
      { time: "07:30", names: ["Cara"], state: "available" },
      { time: "08:00", names: ["Finn", "Dev"], state: "available" },
      { time: "08:30", names: ["Iris"], state: "available" },
    ],
  },
  {
    day: "Tue",
    date: "14 Jul",
    slots: [
      { time: "06:30", names: ["Gia"], state: "available" },
      { time: "07:00", names: ["Dev"], state: "available" },
      { time: "07:30", names: [], state: "available" },
      { time: "08:00", names: ["Ben"], state: "available" },
      { time: "08:30", names: [], state: "available" },
    ],
  },
  {
    day: "Wed",
    date: "15 Jul",
    slots: [
      { time: "06:30", names: ["Finn"], state: "available" },
      { time: "07:00", names: [], state: "available" },
      { time: "07:30", names: ["Cara", "Maya", "Sam"], state: "available" },
      { time: "08:00", names: ["Liv", "Noah", "Oli", "Rae"], state: "full" },
      { time: "08:30", names: ["Gia"], state: "available" },
    ],
  },
  {
    day: "Thu",
    date: "16 Jul",
    slots: [
      { time: "06:30", names: ["Iris"], state: "available" },
      { time: "07:00", names: ["Amira", "Dev"], state: "mine" },
      { time: "07:30", names: ["Oli"], state: "available" },
      { time: "08:00", names: ["Dev"], state: "available" },
      { time: "08:30", names: [], state: "available" },
    ],
  },
  {
    day: "Fri",
    date: "17 Jul",
    slots: [
      { time: "06:30", names: ["Ella"], state: "available" },
      { time: "07:00", names: ["Gia"], state: "available" },
      { time: "07:30", names: [], state: "available" },
      { time: "08:00", names: ["Jonah"], state: "available" },
      { time: "08:30", names: ["Amira", "Cara"], state: "mine" },
    ],
  },
];

function slotClasses(state: SlotState) {
  const base =
    "min-h-24 rounded-lg border p-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--mint)]";

  if (state === "mine") {
    return `${base} border-[var(--mint)] bg-[rgba(0,255,184,0.14)] text-white`;
  }

  if (state === "full") {
    return `${base} border-[rgba(255,78,184,0.55)] bg-[rgba(255,78,184,0.08)] text-white`;
  }

  if (state === "closed") {
    return `${base} border-[var(--line)] bg-black/20 text-[var(--muted)]`;
  }

  return `${base} border-[var(--line)] bg-[var(--panel)] text-white hover:border-[var(--orange)]`;
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--line)] bg-black/20">
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
              className="flex size-10 items-center justify-center rounded-md border border-[var(--line)] text-[var(--muted)] hover:border-[var(--mint)] hover:text-white"
              type="button"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell aria-hidden="true" className="size-5" />
            </button>
            <button
              className="flex items-center gap-2 rounded-md bg-[var(--mint)] px-3 py-2 text-sm font-semibold text-[#01161c] hover:bg-white"
              type="button"
            >
              <Plus aria-hidden="true" className="size-4" />
              Book
            </button>
          </div>
        </div>
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
              {upcoming.map((booking) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-black/20 p-3"
                  key={`${booking.date}-${booking.time}`}
                >
                  <div>
                    <div className="font-medium">{booking.date}</div>
                    <div className="text-sm text-[var(--muted)]">{booking.kind}</div>
                  </div>
                  <div className="text-sm font-semibold text-[var(--mint)]">
                    {booking.time}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Credits</h2>
              <Clock3 aria-hidden="true" className="size-5 text-[var(--pink)]" />
            </div>
            <div className="space-y-2">
              {member.credits.map((credit) => (
                <div
                  className="rounded-lg border border-[rgba(255,78,184,0.4)] bg-[rgba(255,78,184,0.08)] p-3"
                  key={credit.label}
                >
                  <div className="font-medium">{credit.label}</div>
                  <div className="text-sm text-[var(--muted)]">Expires {credit.expiry}</div>
                </div>
              ))}
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
            </div>
            <div className="flex items-center gap-2">
              <button
                className="flex size-10 items-center justify-center rounded-md border border-[var(--line)] text-[var(--muted)] hover:border-[var(--mint)] hover:text-white"
                type="button"
                aria-label="Previous week"
                title="Previous week"
              >
                <ArrowLeft aria-hidden="true" className="size-5" />
              </button>
              <div className="rounded-md border border-[var(--line)] px-3 py-2 text-sm text-white">
                13-17 Jul
              </div>
              <button
                className="flex size-10 items-center justify-center rounded-md border border-[var(--line)] text-[var(--muted)] hover:border-[var(--mint)] hover:text-white"
                type="button"
                aria-label="Next week"
                title="Next week"
              >
                <ArrowRight aria-hidden="true" className="size-5" />
              </button>
            </div>
          </div>

          <div className="grid gap-3 p-4 lg:grid-cols-5">
            {schedule.map((day) => (
              <div className="min-w-0" key={day.day}>
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <h3 className="text-lg font-semibold">{day.day}</h3>
                  <span className="text-sm text-[var(--muted)]">{day.date}</span>
                </div>
                <div className="grid gap-2">
                  {day.slots.map((slot) => {
                    const spotsLeft = bookingConfig.slotCapacity - slot.names.length;

                    return (
                      <button
                        className={slotClasses(slot.state)}
                        key={`${day.day}-${slot.time}`}
                        type="button"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-base font-semibold">{slot.time}</span>
                          <span className="text-xs text-[var(--muted)]">
                            {slot.state === "full" ? "Waitlist" : `${spotsLeft} spots`}
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
    </main>
  );
}
