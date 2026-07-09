"use client";

import { type FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Dumbbell,
  LogOut,
  Mail,
  Plus,
  ShieldCheck,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";

import { bookingRules } from "@/lib/booking-config";

type SlotState = "available" | "mine" | "full";
type DemoRole = "member" | "coach";
type AuthMode = "sign-in" | "register";

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

type RegularSlot = {
  id: string;
  day: string;
  time: string;
};

type RegularSlotChangeRequest = {
  id: string;
  memberName: string;
  requestedDay: string;
  requestedTime: string;
  effectiveWeek: string;
  note: string;
  status: "pending" | "approved" | "declined";
};

type RegularSlotChangeForm = {
  requestedDay: string;
  requestedTime: string;
  effectiveWeek: string;
  note: string;
};

type CoachRegularSlotForm = {
  memberName: string;
  day: string;
  time: string;
  effectiveWeek: string;
};

type RegistrationForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

const member = {
  firstName: "Amira",
  weeklyQuota: 2,
};

const coach = {
  firstName: "Fit East",
  lastName: "Coach",
};

const correspondenceEmail = "manu@intentionalsets.com";

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
const weekdayOptions = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const effectiveWeekOptions = [
  { label: "Mon 20 Jul", value: "2026-07-20" },
  { label: "Mon 27 Jul", value: "2026-07-27" },
  { label: "Mon 3 Aug", value: "2026-08-03" },
];

const initialRegularSlots: RegularSlot[] = [
  { id: "regular-1", day: "Monday", time: "06:30" },
  { id: "regular-2", day: "Thursday", time: "07:00" },
];

const initialRegularSlotRequests: RegularSlotChangeRequest[] = [
  {
    id: "regular-request-1",
    memberName: "Amira Khan",
    requestedDay: "Tuesday",
    requestedTime: "07:30",
    effectiveWeek: "2026-07-20",
    note: "Works better with school drop-off this month.",
    status: "pending",
  },
];

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

function effectiveWeekLabel(value: string) {
  return (
    effectiveWeekOptions.find((option) => option.value === value)?.label ?? value
  );
}

export default function Home() {
  const [currentRole, setCurrentRole] = useState<DemoRole | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [signInEmail, setSignInEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [registration, setRegistration] = useState<RegistrationForm>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [pendingRegistration, setPendingRegistration] =
    useState<RegistrationForm | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [weeks, setWeeks] = useState<Record<number, ScheduleDay[]>>({
    0: buildWeek(0),
  });
  const [credits, setCredits] = useState(initialCredits);
  const [upcoming, setUpcoming] = useState(initialUpcoming);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [regularSlots, setRegularSlots] = useState(initialRegularSlots);
  const [regularSlotRequests, setRegularSlotRequests] = useState(
    initialRegularSlotRequests,
  );
  const [regularSlotRequestOpen, setRegularSlotRequestOpen] = useState(false);
  const [coachRegularSlotOpen, setCoachRegularSlotOpen] = useState(false);
  const [regularSlotChangeForm, setRegularSlotChangeForm] =
    useState<RegularSlotChangeForm>({
      requestedDay: "Tuesday",
      requestedTime: "07:30",
      effectiveWeek: "2026-07-20",
      note: "",
    });
  const [coachRegularSlotForm, setCoachRegularSlotForm] =
    useState<CoachRegularSlotForm>({
      memberName: "Amira Khan",
      day: "Tuesday",
      time: "07:30",
      effectiveWeek: "2026-07-20",
    });
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);
  const [message, setMessage] = useState("Ready for bookings");
  const isCoach = currentRole === "coach";

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

  function submitSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthMessage(`Magic link queued to ${correspondenceEmail}.`);
  }

  function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingRegistration(registration);
  }

  function enterDemo(role: DemoRole) {
    setCurrentRole(role);
    setAuthMessage("");
    setPendingRegistration(null);
    setMessage(role === "coach" ? "Signed in as demo coach." : "Signed in as demo member.");
  }

  function signOut() {
    setCurrentRole(null);
    setSelectedSlot(null);
    setBookingOpen(false);
    setRegularSlotRequestOpen(false);
    setCoachRegularSlotOpen(false);
    setNotificationsOpen(false);
    setMessage("Ready for bookings");
  }

  function submitRegularSlotRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setRegularSlotRequests((requests) => [
      ...requests,
      {
        id: `regular-request-${Date.now()}`,
        memberName: "Amira Khan",
        requestedDay: regularSlotChangeForm.requestedDay,
        requestedTime: regularSlotChangeForm.requestedTime,
        effectiveWeek: regularSlotChangeForm.effectiveWeek,
        note: regularSlotChangeForm.note,
        status: "pending",
      },
    ]);
    setRegularSlotRequestOpen(false);
    setRegularSlotChangeForm((current) => ({ ...current, note: "" }));
    setMessage("Regular slot change request sent to the coaches.");
  }

  function assignRegularSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setRegularSlots((slots) => [
      ...slots,
      {
        id: `regular-${Date.now()}`,
        day: coachRegularSlotForm.day,
        time: coachRegularSlotForm.time,
      },
    ]);
    setCoachRegularSlotOpen(false);
    setMessage(
      `Coach assigned ${coachRegularSlotForm.day} ${coachRegularSlotForm.time} from ${effectiveWeekLabel(coachRegularSlotForm.effectiveWeek)}.`,
    );
  }

  function approveRegularSlotRequest(request: RegularSlotChangeRequest) {
    setRegularSlotRequests((requests) =>
      requests.map((currentRequest) =>
        currentRequest.id === request.id
          ? { ...currentRequest, status: "approved" }
          : currentRequest,
      ),
    );
    setRegularSlots((slots) => [
      ...slots,
      {
        id: `regular-${request.id}`,
        day: request.requestedDay,
        time: request.requestedTime,
      },
    ]);
    setMessage(
      `Approved ${request.memberName}'s regular slot request for ${request.requestedDay} ${request.requestedTime}.`,
    );
  }

  function declineRegularSlotRequest(request: RegularSlotChangeRequest) {
    setRegularSlotRequests((requests) =>
      requests.map((currentRequest) =>
        currentRequest.id === request.id
          ? { ...currentRequest, status: "declined" }
          : currentRequest,
      ),
    );
    setMessage(`Declined ${request.memberName}'s regular slot request.`);
  }

  function bookSlot(
    dayIndex: number,
    slotIndex: number,
    options: { coachOverride?: boolean } = {},
  ) {
    const day = week[dayIndex];
    const slot = day.slots[slotIndex];
    const state = slotState(slot);

    if (state === "mine") {
      setMessage(`${bookingLabel(day)} at ${slot.time} is already booked.`);
      return;
    }

    if (state === "full" && !options.coachOverride) {
      joinWaitlist(dayIndex, slotIndex);
      return;
    }

    const needsCredit =
      !options.coachOverride && activeBookingsThisWeek >= member.weeklyQuota;

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
    setMessage(
      options.coachOverride
        ? `Coach override booked ${bookingLabel(day)} at ${slot.time}.`
        : `${kind} booked for ${bookingLabel(day)} at ${slot.time}.`,
    );
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
      setBookingOpen(true);
      setMessage(
        `Cancelled ${bookingLabel(day)} at ${slot.time}. Credit issued. Pick a new slot now or decide later.`,
      );
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

  if (pendingRegistration) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-8 text-[var(--foreground)]">
        <section className="w-full max-w-md rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5 shadow-2xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg border border-[var(--mint)] bg-[rgba(0,255,184,0.12)]">
              <ShieldCheck aria-hidden="true" className="size-5 text-[var(--mint)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--muted)]">Fit East London</p>
              <h1 className="text-xl font-semibold">Waiting for approval</h1>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--line)] bg-black/20 p-4">
            <div className="font-medium">
              {pendingRegistration.firstName} {pendingRegistration.lastName}
            </div>
            <div className="mt-1 text-sm text-[var(--muted)]">
              {pendingRegistration.email}
            </div>
          </div>
          <p className="mt-4 rounded-lg border border-[var(--line)] bg-black/20 p-3 text-sm text-[var(--muted)]">
            Approval correspondence is routed to {correspondenceEmail}.
          </p>

          <button
            className="mt-5 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)] hover:border-[var(--mint)] hover:text-white"
            type="button"
            onClick={() => {
              setPendingRegistration(null);
              setAuthMode("sign-in");
            }}
          >
            Back to sign in
          </button>
        </section>
      </main>
    );
  }

  if (!currentRole) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-4 py-8 text-[var(--foreground)]">
        <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl items-center gap-6 lg:grid-cols-[1fr_26rem]">
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-lg border border-[var(--mint)] bg-[rgba(0,255,184,0.12)]">
                <Dumbbell aria-hidden="true" className="size-6 text-[var(--mint)]" />
              </div>
              <div>
                <p className="text-sm text-[var(--muted)]">Fit East London</p>
                <h1 className="text-3xl font-semibold">Booking</h1>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                className="rounded-lg border border-[var(--mint)] bg-[rgba(0,255,184,0.12)] p-4 text-left hover:bg-[rgba(0,255,184,0.18)]"
                type="button"
                onClick={() => enterDemo("member")}
              >
                <UsersRound aria-hidden="true" className="mb-4 size-5 text-[var(--mint)]" />
                <div className="font-semibold">Demo member</div>
                <div className="mt-1 text-sm text-[var(--muted)]">Amira Khan</div>
              </button>
              <button
                className="rounded-lg border border-[var(--orange)] bg-[rgba(255,138,31,0.1)] p-4 text-left hover:bg-[rgba(255,138,31,0.16)]"
                type="button"
                onClick={() => enterDemo("coach")}
              >
                <ShieldCheck
                  aria-hidden="true"
                  className="mb-4 size-5 text-[var(--orange)]"
                />
                <div className="font-semibold">Demo coach</div>
                <div className="mt-1 text-sm text-[var(--muted)]">
                  {coach.firstName} {coach.lastName}
                </div>
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 shadow-2xl">
            <div className="mb-4 grid grid-cols-2 gap-2">
              <button
                className={`rounded-md px-3 py-2 text-sm font-medium ${
                  authMode === "sign-in"
                    ? "bg-[var(--mint)] text-[#01161c]"
                    : "border border-[var(--line)] text-[var(--muted)] hover:text-white"
                }`}
                type="button"
                onClick={() => setAuthMode("sign-in")}
              >
                Sign in
              </button>
              <button
                className={`rounded-md px-3 py-2 text-sm font-medium ${
                  authMode === "register"
                    ? "bg-[var(--mint)] text-[#01161c]"
                    : "border border-[var(--line)] text-[var(--muted)] hover:text-white"
                }`}
                type="button"
                onClick={() => setAuthMode("register")}
              >
                Request access
              </button>
            </div>

            {authMode === "sign-in" ? (
              <form className="space-y-3" onSubmit={submitSignIn}>
                <label className="block text-sm font-medium" htmlFor="email">
                  Email
                </label>
                <div className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-black/20 px-3">
                  <Mail aria-hidden="true" className="size-4 text-[var(--muted)]" />
                  <input
                    className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
                    id="email"
                    type="email"
                    required
                    value={signInEmail}
                    placeholder={correspondenceEmail}
                    onChange={(event) => setSignInEmail(event.target.value)}
                  />
                </div>
                <button
                  className="w-full rounded-md bg-[var(--mint)] px-3 py-2 text-sm font-semibold text-[#01161c] hover:bg-white"
                  type="submit"
                >
                  Send magic link
                </button>
                {authMessage && (
                  <p className="rounded-lg border border-[var(--line)] bg-black/20 p-3 text-sm text-[var(--muted)]">
                    {authMessage}
                  </p>
                )}
              </form>
            ) : (
              <form className="space-y-3" onSubmit={submitRegistration}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium" htmlFor="firstName">
                    First name
                    <input
                      className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 text-sm outline-none focus:border-[var(--mint)]"
                      id="firstName"
                      required
                      value={registration.firstName}
                      onChange={(event) =>
                        setRegistration((current) => ({
                          ...current,
                          firstName: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="block text-sm font-medium" htmlFor="lastName">
                    Last name
                    <input
                      className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 text-sm outline-none focus:border-[var(--mint)]"
                      id="lastName"
                      required
                      value={registration.lastName}
                      onChange={(event) =>
                        setRegistration((current) => ({
                          ...current,
                          lastName: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <label className="block text-sm font-medium" htmlFor="registerEmail">
                  Email
                  <input
                    className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 text-sm outline-none focus:border-[var(--mint)]"
                    id="registerEmail"
                    type="email"
                    required
                    value={registration.email}
                    onChange={(event) =>
                      setRegistration((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="block text-sm font-medium" htmlFor="phone">
                  Phone
                  <input
                    className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 text-sm outline-none focus:border-[var(--mint)]"
                    id="phone"
                    value={registration.phone}
                    onChange={(event) =>
                      setRegistration((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                  />
                </label>
                <button
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--mint)] px-3 py-2 text-sm font-semibold text-[#01161c] hover:bg-white"
                  type="submit"
                >
                  <UserPlus aria-hidden="true" className="size-4" />
                  Submit request
                </button>
              </form>
            )}
          </section>
        </div>
      </main>
    );
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
            <div className="hidden rounded-md border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)] sm:block">
              {isCoach ? "Demo coach" : "Demo member"}
            </div>
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
              {isCoach ? "Add" : "Book"}
            </button>
            <button
              className="flex size-10 items-center justify-center rounded-md border border-[var(--line)] text-[var(--muted)] hover:border-[var(--pink)] hover:text-white"
              type="button"
              aria-label="Sign out"
              title="Sign out"
              onClick={signOut}
            >
              <LogOut aria-hidden="true" className="size-5" />
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
                <p className="text-sm text-[var(--muted)]">
                  {isCoach ? "Coach" : "Member"}
                </p>
                <h2 className="mt-1 text-2xl font-semibold">
                  {isCoach ? coach.firstName : member.firstName}
                </h2>
              </div>
              <div className="rounded-md border border-[var(--orange)] px-2 py-1 text-sm text-[var(--orange)]">
                {isCoach ? "Admin" : `${member.weeklyQuota}x weekly`}
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
              <div>
                <h2 className="text-base font-semibold">Regular slots</h2>
                <p className="text-xs text-[var(--muted)]">
                  {isCoach ? "Coach managed" : "Coach approval required"}
                </p>
              </div>
              <ShieldCheck aria-hidden="true" className="size-5 text-[var(--mint)]" />
            </div>

            <div className="space-y-2">
              {regularSlots.map((slot) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-black/20 p-3"
                  key={slot.id}
                >
                  <div className="font-medium">{slot.day}</div>
                  <div className="text-sm font-semibold text-[var(--mint)]">
                    {slot.time}
                  </div>
                </div>
              ))}
            </div>

            {isCoach ? (
              <button
                className="mt-3 w-full rounded-md bg-[var(--mint)] px-3 py-2 text-sm font-semibold text-[#01161c] hover:bg-white"
                type="button"
                onClick={() => setCoachRegularSlotOpen(true)}
              >
                Assign regular slot
              </button>
            ) : (
              <button
                className="mt-3 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)] hover:border-[var(--mint)] hover:text-white"
                type="button"
                onClick={() => setRegularSlotRequestOpen(true)}
              >
                Request change
              </button>
            )}

            <div className="mt-3 space-y-2">
              {regularSlotRequests
                .filter((request) => isCoach || request.memberName === "Amira Khan")
                .map((request) => (
                  <div
                    className="rounded-lg border border-[var(--line)] bg-black/20 p-3"
                    key={request.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        {isCoach && (
                          <div className="text-sm font-medium">{request.memberName}</div>
                        )}
                        <div className="text-sm text-[var(--muted)]">
                          {request.requestedDay} {request.requestedTime} from{" "}
                          {effectiveWeekLabel(request.effectiveWeek)}
                        </div>
                      </div>
                      <div className="rounded-md border border-[var(--line)] px-2 py-1 text-xs text-[var(--muted)]">
                        {request.status}
                      </div>
                    </div>
                    {isCoach && request.status === "pending" && (
                      <div className="mt-3 flex gap-2">
                        <button
                          className="flex-1 rounded-md bg-[var(--mint)] px-3 py-2 text-sm font-semibold text-[#01161c] hover:bg-white"
                          type="button"
                          onClick={() => approveRegularSlotRequest(request)}
                        >
                          Approve
                        </button>
                        <button
                          className="flex-1 rounded-md border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)] hover:border-[var(--pink)] hover:text-white"
                          type="button"
                          onClick={() => declineRegularSlotRequest(request)}
                        >
                          Decline
                        </button>
                      </div>
                    )}
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
                {isCoach ? "Coach schedule" : "Member schedule"}
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
                    {isCoach
                      ? selectedDetails.slot.names.length > 0
                        ? selectedDetails.slot.names.join(", ")
                        : "Open"
                      : slotState(selectedDetails.slot) === "mine"
                        ? "Your booking"
                        : `${bookingRules.slotCapacity - selectedDetails.slot.names.length} spots available`}
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
                      {isCoach ? "Add Amira" : "Book spot"}
                    </button>
                  )}
                  {slotState(selectedDetails.slot) === "full" && isCoach && (
                    <button
                      className="rounded-md bg-[var(--orange)] px-3 py-2 text-sm font-semibold text-[#01161c] hover:bg-white"
                      type="button"
                      onClick={() =>
                        bookSlot(selectedDetails.dayIndex, selectedDetails.slotIndex, {
                          coachOverride: true,
                        })
                      }
                    >
                      Override add
                    </button>
                  )}
                  {slotState(selectedDetails.slot) === "full" && !isCoach && (
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
                          {isCoach
                            ? slot.names.length > 0
                              ? slot.names.join(", ")
                              : "Open"
                            : state === "mine"
                              ? "Your booking"
                              : state === "full"
                                ? "Full"
                                : "Open"}
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

      {regularSlotRequestOpen && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/60 p-4 sm:items-center sm:justify-center">
          <form
            className="w-full max-w-xl rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 shadow-2xl"
            onSubmit={submitRegularSlotRequest}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Request regular slot change</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Coaches review and make all regular slot changes.
                </p>
              </div>
              <button
                className="flex size-10 items-center justify-center rounded-md text-[var(--muted)] hover:bg-white/10 hover:text-white"
                type="button"
                aria-label="Close regular slot request"
                title="Close"
                onClick={() => setRegularSlotRequestOpen(false)}
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium" htmlFor="requestedDay">
                Day
                <select
                  className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-[#09242c] px-3 text-sm outline-none focus:border-[var(--mint)]"
                  id="requestedDay"
                  value={regularSlotChangeForm.requestedDay}
                  onChange={(event) =>
                    setRegularSlotChangeForm((current) => ({
                      ...current,
                      requestedDay: event.target.value,
                    }))
                  }
                >
                  {weekdayOptions.map((day) => (
                    <option key={day}>{day}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium" htmlFor="requestedTime">
                Time
                <select
                  className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-[#09242c] px-3 text-sm outline-none focus:border-[var(--mint)]"
                  id="requestedTime"
                  value={regularSlotChangeForm.requestedTime}
                  onChange={(event) =>
                    setRegularSlotChangeForm((current) => ({
                      ...current,
                      requestedTime: event.target.value,
                    }))
                  }
                >
                  {bookingRules.slotTimes.map((time) => (
                    <option key={time}>{time}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-3 block text-sm font-medium" htmlFor="effectiveWeek">
              Effective week
              <select
                className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-[#09242c] px-3 text-sm outline-none focus:border-[var(--mint)]"
                id="effectiveWeek"
                value={regularSlotChangeForm.effectiveWeek}
                onChange={(event) =>
                  setRegularSlotChangeForm((current) => ({
                    ...current,
                    effectiveWeek: event.target.value,
                  }))
                }
              >
                {effectiveWeekOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 block text-sm font-medium" htmlFor="requestNote">
              Note
              <textarea
                className="mt-1 min-h-24 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 py-2 text-sm outline-none focus:border-[var(--mint)]"
                id="requestNote"
                value={regularSlotChangeForm.note}
                onChange={(event) =>
                  setRegularSlotChangeForm((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
              />
            </label>

            <button
              className="mt-4 w-full rounded-md bg-[var(--mint)] px-3 py-2 text-sm font-semibold text-[#01161c] hover:bg-white"
              type="submit"
            >
              Submit request
            </button>
          </form>
        </div>
      )}

      {coachRegularSlotOpen && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/60 p-4 sm:items-center sm:justify-center">
          <form
            className="w-full max-w-xl rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 shadow-2xl"
            onSubmit={assignRegularSlot}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Assign regular slot</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Only coaches can create or change regular slots.
                </p>
              </div>
              <button
                className="flex size-10 items-center justify-center rounded-md text-[var(--muted)] hover:bg-white/10 hover:text-white"
                type="button"
                aria-label="Close regular slot assignment"
                title="Close"
                onClick={() => setCoachRegularSlotOpen(false)}
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>

            <label className="block text-sm font-medium" htmlFor="coachMemberName">
              Member
              <input
                className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 text-sm outline-none focus:border-[var(--mint)]"
                id="coachMemberName"
                value={coachRegularSlotForm.memberName}
                onChange={(event) =>
                  setCoachRegularSlotForm((current) => ({
                    ...current,
                    memberName: event.target.value,
                  }))
                }
              />
            </label>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium" htmlFor="coachRegularDay">
                Day
                <select
                  className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-[#09242c] px-3 text-sm outline-none focus:border-[var(--mint)]"
                  id="coachRegularDay"
                  value={coachRegularSlotForm.day}
                  onChange={(event) =>
                    setCoachRegularSlotForm((current) => ({
                      ...current,
                      day: event.target.value,
                    }))
                  }
                >
                  {weekdayOptions.map((day) => (
                    <option key={day}>{day}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium" htmlFor="coachRegularTime">
                Time
                <select
                  className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-[#09242c] px-3 text-sm outline-none focus:border-[var(--mint)]"
                  id="coachRegularTime"
                  value={coachRegularSlotForm.time}
                  onChange={(event) =>
                    setCoachRegularSlotForm((current) => ({
                      ...current,
                      time: event.target.value,
                    }))
                  }
                >
                  {bookingRules.slotTimes.map((time) => (
                    <option key={time}>{time}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-3 block text-sm font-medium" htmlFor="coachEffectiveWeek">
              Effective week
              <select
                className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-[#09242c] px-3 text-sm outline-none focus:border-[var(--mint)]"
                id="coachEffectiveWeek"
                value={coachRegularSlotForm.effectiveWeek}
                onChange={(event) =>
                  setCoachRegularSlotForm((current) => ({
                    ...current,
                    effectiveWeek: event.target.value,
                  }))
                }
              >
                {effectiveWeekOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="mt-4 w-full rounded-md bg-[var(--mint)] px-3 py-2 text-sm font-semibold text-[#01161c] hover:bg-white"
              type="submit"
            >
              Assign slot
            </button>
          </form>
        </div>
      )}

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
