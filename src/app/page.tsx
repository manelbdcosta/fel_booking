"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
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
import {
  parsePersistedAppState,
  type PersistedAppState,
} from "@/lib/app-state";
import { publicAppPath } from "@/lib/public-url";

type SlotState = "available" | "mine" | "full";
type DemoRole = "member" | "coach";
type AuthMode = "sign-in" | "register" | "forgot-password" | "reset-password";

type ScheduleSlot = {
  memberIds?: string[];
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
  kind: "Regular" | "Makeup" | "Coach override";
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
  abandonedDay?: string;
  abandonedTime?: string;
  requestedDay: string;
  requestedTime: string;
  effectiveWeek: string;
  note: string;
  status: "pending" | "approved" | "declined";
};

type RegularSlotChangeForm = {
  abandonedDay: string;
  abandonedTime: string;
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
  password: string;
  passwordConfirm: string;
};

type PendingRegistration = Pick<
  RegistrationForm,
  "firstName" | "lastName" | "email" | "phone"
>;

type ResetPasswordForm = {
  email: string;
  token: string;
  password: string;
  passwordConfirm: string;
};

type DemoMember = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  weeklyQuota: number;
  status: "active" | "pending";
  attended?: number;
  missed?: number;
};

type AuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: DemoRole;
};

type BootstrapData = {
  coaches?: string[];
  members?: DemoMember[];
  regularSlotsByMember?: Record<string, RegularSlot[]>;
  regularSlotRequests?: RegularSlotChangeRequest[];
  weeklyQuotasByMember?: Record<string, number>;
};

type ScheduleData = {
  credits: Credit[];
  upcoming: UpcomingBooking[];
  waitlist: WaitlistEntry[];
  week: ScheduleDay[];
  weekStart: string;
};

const member: DemoMember = {
  id: "maddie",
  firstName: "Maddie",
  lastName: "Cannon",
  weeklyQuota: 2,
  status: "active",
};

const demoMembers: DemoMember[] = [
  member,
  {
    id: "emma",
    firstName: "Emma",
    lastName: "Richierich",
    weeklyQuota: 2,
    status: "active",
  },
  {
    id: "gemma",
    firstName: "Gemma",
    lastName: "Partridge",
    weeklyQuota: 3,
    status: "active",
  },
];

const initialWeeklyQuotas = Object.fromEntries(
  demoMembers.map((demoMember) => [demoMember.id, demoMember.weeklyQuota]),
) as Record<string, number>;

const demoCoaches = ["Ben", "Manu", "Ennor", "Mel"];
const previewAccessEnabled =
  process.env.NEXT_PUBLIC_ENABLE_PREVIEW_ACCESS === "true" ||
  process.env.NODE_ENV === "test";

const correspondenceEmail = "manu@intentionalsets.com";

function queueCorrespondence(event: Record<string, string | undefined>) {
  if (typeof window === "undefined") {
    return;
  }

  void fetch(publicAppPath("/api/correspondence"), {
    body: JSON.stringify(event),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  }).catch(() => undefined);
}

const initialCredits: Credit[] = [
  { id: "credit-1", label: "Thu 16 Jul", expiry: "13 Aug" },
  { id: "credit-2", label: "Mon 20 Jul", expiry: "17 Aug" },
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

const initialRegularSlotsByMember: Record<string, RegularSlot[]> = {
  maddie: initialRegularSlots,
  emma: [
    { id: "regular-emma-1", day: "Tuesday", time: "08:00" },
    { id: "regular-emma-2", day: "Friday", time: "07:00" },
  ],
  gemma: [
    { id: "regular-gemma-1", day: "Monday", time: "07:30" },
    { id: "regular-gemma-2", day: "Wednesday", time: "06:30" },
    { id: "regular-gemma-3", day: "Friday", time: "08:00" },
  ],
};

const initialRegularSlotRequests: RegularSlotChangeRequest[] = [
  {
    id: "regular-request-1",
    memberName: "Maddie Cannon",
    abandonedDay: "Monday",
    abandonedTime: "06:30",
    requestedDay: "Tuesday",
    requestedTime: "07:30",
    effectiveWeek: "2026-07-20",
    note: "Works better with school drop-off this month.",
    status: "pending",
  },
];

const slotTemplates: Array<Array<Omit<ScheduleSlot, "time">>> = [
  [
    { names: ["Maddie", "Gemma"] },
    { names: ["Emma", "Gemma", "Reserved", "Drop-in"] },
    { names: ["Gemma"] },
    { names: ["Emma"] },
    { names: [] },
  ],
  [
    { names: ["Emma"] },
    { names: ["Gemma"] },
    { names: [] },
    { names: ["Emma"] },
    { names: [] },
  ],
  [
    { names: ["Gemma"] },
    { names: [] },
    { names: ["Maddie", "Emma"] },
    { names: ["Reserved", "Drop-in"] },
    { names: ["Gemma"] },
  ],
  [
    { names: ["Emma"] },
    { names: ["Maddie", "Gemma"] },
    { names: ["Reserved"] },
    { names: ["Emma"] },
    { names: [] },
  ],
  [
    { names: ["Gemma"] },
    { names: ["Emma"] },
    { names: [] },
    { names: ["Gemma"] },
    { names: ["Maddie", "Emma"] },
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

function todayIsoDate() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone: bookingRules.timeZone,
    year: "numeric",
  }).formatToParts(new Date());
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";

  return `${year}-${month}-${day}`;
}

function dayIndexFromIso(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utcDay = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();

  return utcDay === 0 ? 6 : utcDay - 1;
}

function sessionDayIndexFromIso(isoDate: string) {
  return Math.min(4, Math.max(0, dayIndexFromIso(isoDate)));
}

function weekStartFromIso(isoDate: string) {
  return addDays(isoDate, -dayIndexFromIso(isoDate));
}

function weekStartForOffset(offset: number) {
  return addDays(weekStartFromIso(todayIsoDate()), offset * 7);
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

function dateLabel(isoDate: string) {
  const dayIndex = dayIndexFromIso(isoDate);
  const dayName = dayNames[dayIndex] ?? "Mon";

  return `${dayName} ${shortDate(isoDate)}`;
}

function buildInitialUpcoming(): UpcomingBooking[] {
  const start = weekStartForOffset(0);
  const monday = start;
  const thursday = addDays(start, 3);
  const friday = addDays(start, 4);

  return [
    {
      id: "booking-1",
      isoDate: monday,
      date: dateLabel(monday),
      time: "06:30",
      kind: "Regular",
    },
    {
      id: "booking-2",
      isoDate: thursday,
      date: dateLabel(thursday),
      time: "07:00",
      kind: "Regular",
    },
    {
      id: "booking-3",
      isoDate: friday,
      date: dateLabel(friday),
      time: "08:30",
      kind: "Makeup",
    },
  ];
}

function cloneWeek(week: ScheduleDay[]): ScheduleDay[] {
  return week.map((day) => ({
    ...day,
    slots: day.slots.map((slot) => ({
      ...slot,
      ...(slot.memberIds ? { memberIds: [...slot.memberIds] } : {}),
      names: [...slot.names],
    })),
  }));
}

function fullName(person: Pick<DemoMember, "firstName" | "lastName">) {
  return `${person.firstName} ${person.lastName}`;
}

function slotState(slot: ScheduleSlot, activeMember: DemoMember): SlotState {
  if (
    slot.memberIds?.includes(activeMember.id) ||
    (!slot.memberIds && slot.names.includes(activeMember.firstName))
  ) {
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

function sameRegularSlot(
  left: Pick<RegularSlot, "day" | "time">,
  right: Pick<RegularSlot, "day" | "time">,
) {
  return left.day === right.day && left.time === right.time;
}

function regularSlotSignature(slots: RegularSlot[]) {
  return slots.map((slot) => `${slot.id}:${slot.day}:${slot.time}`).join("|");
}

function pendingReviewMemberId() {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const reviewMemberId = params.get("reviewMember");

  try {
    if (reviewMemberId) {
      window.localStorage.setItem("fel_review_member", reviewMemberId);
      return reviewMemberId;
    }

    return window.localStorage.getItem("fel_review_member");
  } catch {
    return reviewMemberId;
  }
}

function clearPendingReviewMemberId(memberId: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (window.localStorage.getItem("fel_review_member") === memberId) {
      window.localStorage.removeItem("fel_review_member");
    }
  } catch {
    // Local storage can be unavailable in restrictive browser modes.
  }
}

export default function Home() {
  const appStateSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentRole, setCurrentRole] = useState<DemoRole | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [registration, setRegistration] = useState<RegistrationForm>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    passwordConfirm: "",
  });
  const [pendingRegistration, setPendingRegistration] =
    useState<PendingRegistration | null>(null);
  const [resetPasswordForm, setResetPasswordForm] = useState<ResetPasswordForm>({
    email: "",
    token: "",
    password: "",
    passwordConfirm: "",
  });
  const [members, setMembers] = useState<DemoMember[]>(demoMembers);
  const [coaches, setCoaches] = useState(demoCoaches);
  const [weekOffset, setWeekOffset] = useState(0);
  const [weeks, setWeeks] = useState<Record<number, ScheduleDay[]>>({
    0: buildWeek(0),
  });
  const [credits, setCredits] = useState(initialCredits);
  const [upcoming, setUpcoming] = useState(buildInitialUpcoming);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState(member.id);
  const [coachDayIndex, setCoachDayIndex] = useState(() =>
    sessionDayIndexFromIso(todayIsoDate()),
  );
  const [regularSlotsByMember, setRegularSlotsByMember] = useState(
    initialRegularSlotsByMember,
  );
  const [weeklyQuotasByMember, setWeeklyQuotasByMember] =
    useState(initialWeeklyQuotas);
  const [regularSlotRequests, setRegularSlotRequests] = useState(
    initialRegularSlotRequests,
  );
  const [regularSlotRequestOpen, setRegularSlotRequestOpen] = useState(false);
  const [coachRegularSlotOpen, setCoachRegularSlotOpen] = useState(false);
  const [regularSlotDrafts, setRegularSlotDrafts] = useState<RegularSlot[]>([]);
  const [weeklyQuotaDraft, setWeeklyQuotaDraft] = useState(member.weeklyQuota);
  const [regularSlotDraftNotice, setRegularSlotDraftNotice] = useState("");
  const [regularSlotChangeForm, setRegularSlotChangeForm] =
    useState<RegularSlotChangeForm>({
      abandonedDay: "Monday",
      abandonedTime: "06:30",
      requestedDay: "Tuesday",
      requestedTime: "07:30",
      effectiveWeek: "2026-07-20",
      note: "",
    });
  const [coachRegularSlotForm, setCoachRegularSlotForm] =
    useState<CoachRegularSlotForm>({
      memberName: "Maddie Cannon",
      day: "Tuesday",
      time: "07:30",
      effectiveWeek: "2026-07-20",
    });
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);
  const [appStateLoaded, setAppStateLoaded] = useState(false);
  const [message, setMessage] = useState("Ready for bookings");
  const isCoach = currentRole === "coach";
  const coachNames = coaches.join(", ");
  const activeMember =
    members.find((demoMember) => demoMember.id === selectedMemberId) ?? members[0] ?? member;
  const activeMemberFullName = fullName(activeMember);
  const regularSlots = regularSlotsByMember[activeMember.id] ?? [];
  const activeWeeklyQuota =
    weeklyQuotasByMember[activeMember.id] ?? activeMember.weeklyQuota;
  const regularSlotDraftChanged =
    weeklyQuotaDraft !== activeWeeklyQuota ||
    regularSlotSignature(regularSlotDrafts) !== regularSlotSignature(regularSlots);

  const week = weeks[weekOffset] ?? buildWeek(weekOffset);
  const coachDay = week[coachDayIndex] ?? week[0];
  const coachDayBookingCount = coachDay.slots.reduce(
    (count, slot) => count + slot.names.length,
    0,
  );
  const coachDayCapacity = coachDay.slots.length * bookingRules.slotCapacity;
  const coachDayIsToday = coachDay.isoDate === todayIsoDate();

  const availableSlots = week.flatMap((day, dayIndex) =>
    day.slots
      .map((slot, slotIndex) => ({ day, dayIndex, slot, slotIndex }))
      .filter(({ slot }) => slotState(slot, activeMember) === "available"),
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
      day.slots.filter((slot) => slot.names.includes(activeMember.firstName)).length,
    0,
  );

  const metrics = [
    { label: "Attended", value: String(activeMember.attended ?? 42), icon: CheckCircle2 },
    { label: "Missed", value: String(activeMember.missed ?? 1), icon: AlertTriangle },
    { label: "Credits", value: String(credits.length), icon: Clock3 },
  ];

  const applyBootstrapData = useCallback((data: BootstrapData) => {
    if (data.members?.length) {
      setMembers(data.members);
      setSelectedMemberId((currentId) => {
        if (data.members?.some((loadedMember) => loadedMember.id === currentId)) {
          return currentId;
        }

        return data.members?.[0]?.id ?? currentId;
      });
    }

    if (data.coaches?.length) {
      setCoaches(data.coaches);
    }

    if (data.regularSlotsByMember) {
      setRegularSlotsByMember(data.regularSlotsByMember);
    }

    if (data.weeklyQuotasByMember) {
      setWeeklyQuotasByMember(data.weeklyQuotasByMember);
    }

    if (data.regularSlotRequests) {
      setRegularSlotRequests(data.regularSlotRequests);
    }
  }, []);

  const applyScheduleData = useCallback(
    (data: ScheduleData, offset: number) => {
      setCredits(data.credits);
      setUpcoming(data.upcoming);
      setWaitlist(data.waitlist);
      setWeeks((storedWeeks) => ({
        ...storedWeeks,
        [offset]: cloneWeek(data.week),
      }));
      setMessage("Loaded saved bookings.");
    },
    [],
  );

  const loadScheduleData = useCallback(
    async (memberId: string, offset: number) => {
      const params = new URLSearchParams({
        memberId,
        weekStart: weekStartForOffset(offset),
      });
      const response = await fetch(publicAppPath(`/api/schedule?${params}`), {
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json().catch(() => ({}))) as
        | ScheduleData
        | { error?: string };

      if (!response.ok || !("week" in payload)) {
        const error = "error" in payload ? payload.error : undefined;

        setMessage(error ?? "Could not load saved schedule.");
        return;
      }

      applyScheduleData(payload, offset);
    },
    [applyScheduleData],
  );

  const finishAuthenticatedSession = useCallback(
    async (user: AuthUser, messagePrefix = "Signed in as") => {
      setCurrentUser(user);
      setCurrentRole(user.role);

      if (user.role === "member") {
        setSelectedMemberId(user.id);
      }

      const bootstrapResponse = await fetch(publicAppPath("/api/bootstrap"), {
        headers: { Accept: "application/json" },
      });
      let bootstrapData: BootstrapData | null = null;

      if (bootstrapResponse.ok) {
        bootstrapData = (await bootstrapResponse.json()) as BootstrapData;
        applyBootstrapData(bootstrapData);
      }

      const reviewMemberId = pendingReviewMemberId();
      const reviewMember =
        user.role === "coach" && reviewMemberId
          ? bootstrapData?.members?.find(
              (loadedMember) => loadedMember.id === reviewMemberId,
            )
          : null;
      const scheduleMemberId =
        reviewMember?.id ??
        (user.role === "member" ? user.id : bootstrapData?.members?.[0]?.id);

      if (scheduleMemberId) {
        if (reviewMember) {
          setSelectedMemberId(reviewMember.id);
          clearPendingReviewMemberId(reviewMember.id);
        }

        void loadScheduleData(scheduleMemberId, 0);
      }

      setMessage(
        reviewMember
          ? `Reviewing ${fullName(reviewMember)}.`
          : `${messagePrefix} ${user.firstName}.`,
      );
    },
    [applyBootstrapData, loadScheduleData],
  );

  useEffect(() => {
    let active = true;

    async function loadServerState() {
      try {
        const [sessionResponse, bootstrapResponse, appStateResponse] =
          await Promise.all([
            fetch(publicAppPath("/api/auth/me"), {
              headers: { Accept: "application/json" },
            }),
            fetch(publicAppPath("/api/bootstrap"), {
              headers: { Accept: "application/json" },
            }),
            fetch(publicAppPath("/api/app-state"), {
              headers: { Accept: "application/json" },
            }),
          ]);

        if (!active) {
          return;
        }

        let signedInUser: AuthUser | null = null;
        let bootstrapData: BootstrapData | null = null;

        if (sessionResponse.ok) {
          const payload = (await sessionResponse.json()) as { user?: AuthUser | null };

          if (payload.user) {
            signedInUser = payload.user;
            setCurrentUser(payload.user);
            setCurrentRole(payload.user.role);

            if (payload.user.role === "member") {
              setSelectedMemberId(payload.user.id);
            }
          }
        }

        if (!signedInUser && appStateResponse.ok) {
          const payload = (await appStateResponse.json()) as { state?: unknown };
          const persistedState = parsePersistedAppState(payload.state);

          if (persistedState) {
            setCredits(persistedState.credits);
            setUpcoming(persistedState.upcoming);
            setWaitlist(persistedState.waitlist);
            setWeeks(
              Object.fromEntries(
                Object.entries(persistedState.weeks).map(
                  ([offset, persistedWeek]) => [Number(offset), persistedWeek],
                ),
              ) as Record<number, ScheduleDay[]>,
            );
            setMessage("Loaded saved bookings.");
          }
        }

        if (bootstrapResponse.ok) {
          bootstrapData = (await bootstrapResponse.json()) as BootstrapData;
          applyBootstrapData(bootstrapData);
        }

        if (signedInUser) {
          const reviewMemberId = pendingReviewMemberId();
          const reviewMember =
            signedInUser.role === "coach" && reviewMemberId
              ? bootstrapData?.members?.find(
                  (loadedMember) => loadedMember.id === reviewMemberId,
                )
              : null;
          const scheduleMemberId =
            reviewMember?.id ??
            (signedInUser.role === "member"
              ? signedInUser.id
              : bootstrapData?.members?.[0]?.id);

          if (scheduleMemberId) {
            if (reviewMember) {
              setSelectedMemberId(reviewMember.id);
              clearPendingReviewMemberId(reviewMember.id);
              setMessage(`Reviewing ${fullName(reviewMember)}.`);
            }

            void loadScheduleData(scheduleMemberId, 0);
          }
        }
      } catch {
        // The static GitHub Pages demo and local dev without D1 keep using browser state.
      } finally {
        if (active) {
          setAppStateLoaded(true);
        }
      }
    }

    void loadServerState();

    return () => {
      active = false;

      if (appStateSaveTimer.current) {
        clearTimeout(appStateSaveTimer.current);
      }
    };
  }, [applyBootstrapData, loadScheduleData]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const resetToken = params.get("resetToken");
    const email = params.get("email");

    pendingReviewMemberId();

    if (resetToken && email) {
      async function preparePasswordReset() {
        setResetPasswordForm((current) => ({
          ...current,
          email: email ?? "",
          token: resetToken ?? "",
        }));
        setAuthMode("reset-password");
        setAuthMessage("");
      }

      void preparePasswordReset();
      return;
    }

    if (!token || !email) {
      return;
    }

    async function showPasswordSignInMessage() {
      setAuthMode("sign-in");
      setSignInEmail(email ?? "");
      setAuthMessage(
        "Password sign-in is now required. Use Forgot password if you need to set one.",
      );
      window.history.replaceState({}, "", window.location.pathname);
    }

    void showPasswordSignInMessage();
  }, []);

  useEffect(() => {
    if (!appStateLoaded || currentUser) {
      return;
    }

    if (appStateSaveTimer.current) {
      clearTimeout(appStateSaveTimer.current);
    }

    const state: PersistedAppState = {
      credits,
      upcoming,
      waitlist,
      regularSlotsByMember,
      weeklyQuotasByMember,
      regularSlotRequests,
      weeks: Object.fromEntries(
        Object.entries(weeks).map(([offset, storedWeek]) => [
          offset,
          cloneWeek(storedWeek),
        ]),
      ),
    };

    appStateSaveTimer.current = setTimeout(() => {
      void fetch(publicAppPath("/api/app-state"), {
        body: JSON.stringify({ state }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }).catch(() => undefined);
    }, 600);
  }, [
    appStateLoaded,
    credits,
    currentUser,
    regularSlotRequests,
    regularSlotsByMember,
    upcoming,
    waitlist,
    weeklyQuotasByMember,
    weeks,
  ]);

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

  async function submitSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthMessage("");

    try {
      const response = await fetch(publicAppPath("/api/auth/login"), {
        body: JSON.stringify({ email: signInEmail, password: signInPassword }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        user?: AuthUser;
      };

      if (!response.ok || !payload.user) {
        setAuthMessage(
          payload.error ??
            "We could not sign you in. Please check your email and password.",
        );
        return;
      }

      await finishAuthenticatedSession(payload.user);
    } finally {
      setAuthBusy(false);
    }
  }

  async function submitForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthMessage("");

    try {
      const response = await fetch(publicAppPath("/api/auth/request-password-reset"), {
        body: JSON.stringify({ email: resetPasswordForm.email }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        setAuthMessage(
          payload.error ?? "We could not send a password reset email yet.",
        );
        return;
      }

      setAuthMessage(
        `Password reset email sent to ${resetPasswordForm.email}.`,
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function submitResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthMessage("");

    if (resetPasswordForm.password !== resetPasswordForm.passwordConfirm) {
      setAuthMessage("Passwords do not match.");
      setAuthBusy(false);
      return;
    }

    try {
      const response = await fetch(publicAppPath("/api/auth/reset-password"), {
        body: JSON.stringify({
          email: resetPasswordForm.email,
          password: resetPasswordForm.password,
          token: resetPasswordForm.token,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        user?: AuthUser | null;
      };

      if (!response.ok) {
        setAuthMessage(payload.error ?? "Could not reset this password.");
        return;
      }

      if (payload.user) {
        window.history.replaceState({}, "", window.location.pathname);
        await finishAuthenticatedSession(payload.user, "Password updated for");
        return;
      }

      setAuthMode("sign-in");
      setAuthMessage(
        "Password updated. This account is still waiting for coach approval.",
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthMessage("");

    if (registration.password !== registration.passwordConfirm) {
      setAuthMessage("Passwords do not match.");
      setAuthBusy(false);
      return;
    }

    try {
      const response = await fetch(publicAppPath("/api/signups"), {
        body: JSON.stringify(registration),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        member?: DemoMember;
        notificationSent?: boolean;
      };

      if (!response.ok) {
        setAuthMessage(payload.error ?? "Could not submit this request.");
        return;
      }

      const savedMember = payload.member;

      if (savedMember) {
        setMembers((currentMembers) => {
          const alreadyExists = currentMembers.some(
            (currentMember) => currentMember.id === savedMember.id,
          );

          return alreadyExists
            ? currentMembers.map((currentMember) =>
                currentMember.id === savedMember.id
                  ? { ...currentMember, ...savedMember }
                  : currentMember,
              )
            : [...currentMembers, savedMember];
        });
      }

      setPendingRegistration({
        email: registration.email,
        firstName: registration.firstName,
        lastName: registration.lastName,
        phone: registration.phone,
      });
      setAuthMessage(
        payload.notificationSent
          ? ""
          : "Your request was saved. Coach notification email is still being configured.",
      );
    } finally {
      setAuthBusy(false);
    }
  }

  function enterDemo(role: DemoRole) {
    setCurrentRole(role);
    setCurrentUser(null);
    setWeekOffset(0);
    setCoachDayIndex(sessionDayIndexFromIso(todayIsoDate()));
    setSelectedSlot(null);
    setAuthMessage("");
    setPendingRegistration(null);
    setMessage(
      role === "coach"
        ? "Signed in with preview coach access."
        : "Signed in with preview member access.",
    );
  }

  async function signOut() {
    void fetch(publicAppPath("/api/auth/sign-out"), { method: "POST" }).catch(
      () => undefined,
    );
    setCurrentRole(null);
    setCurrentUser(null);
    setSelectedSlot(null);
    setBookingOpen(false);
    setRegularSlotRequestOpen(false);
    setCoachRegularSlotOpen(false);
    setNotificationsOpen(false);
    setMessage("Ready for bookings");
  }

  async function approveMemberAccess(memberToApprove: DemoMember) {
    const quota = weeklyQuotasByMember[memberToApprove.id] ?? memberToApprove.weeklyQuota;

    const response = await fetch(
      publicAppPath(`/api/members/${encodeURIComponent(memberToApprove.id)}`),
      {
        body: JSON.stringify({ status: "active", weeklyQuota: quota }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      },
    );

    if (!response.ok) {
      setMessage(`Could not approve ${fullName(memberToApprove)} yet.`);
      return;
    }

    setMembers((currentMembers) =>
      currentMembers.map((currentMember) =>
        currentMember.id === memberToApprove.id
          ? { ...currentMember, status: "active" }
          : currentMember,
      ),
    );
    setMessage(`Approved ${fullName(memberToApprove)} for member access.`);
  }

  function openRegularSlotRequest() {
    const abandonedSlot =
      regularSlots.find(
        (slot) =>
          slot.day === regularSlotChangeForm.abandonedDay &&
          slot.time === regularSlotChangeForm.abandonedTime,
      ) ?? regularSlots[0];

    if (!abandonedSlot) {
      setMessage("A regular slot must be assigned before requesting a change.");
      return;
    }

    setRegularSlotChangeForm((current) => ({
      ...current,
      abandonedDay: abandonedSlot.day,
      abandonedTime: abandonedSlot.time,
    }));
    setRegularSlotRequestOpen(true);
  }

  async function submitRegularSlotRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (regularSlots.length === 0) {
      setMessage("A regular slot must be assigned before requesting a change.");
      return;
    }

    if (
      regularSlotChangeForm.abandonedDay === regularSlotChangeForm.requestedDay &&
      regularSlotChangeForm.abandonedTime === regularSlotChangeForm.requestedTime
    ) {
      setMessage("Choose a different new slot before submitting the request.");
      return;
    }

    const response = await fetch(publicAppPath("/api/regular-slot-requests"), {
      body: JSON.stringify({
        abandonedDay: regularSlotChangeForm.abandonedDay,
        abandonedTime: regularSlotChangeForm.abandonedTime,
        effectiveWeek: regularSlotChangeForm.effectiveWeek,
        memberId: activeMember.id,
        note: regularSlotChangeForm.note,
        requestedDay: regularSlotChangeForm.requestedDay,
        requestedTime: regularSlotChangeForm.requestedTime,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      id?: string;
    };

    if (!response.ok) {
      setMessage(payload.error ?? "Could not send regular slot change request.");
      return;
    }

    setRegularSlotRequests((requests) => [
      ...requests,
      {
        id: payload.id ?? `regular-request-${Date.now()}`,
        memberName: activeMemberFullName,
        abandonedDay: regularSlotChangeForm.abandonedDay,
        abandonedTime: regularSlotChangeForm.abandonedTime,
        requestedDay: regularSlotChangeForm.requestedDay,
        requestedTime: regularSlotChangeForm.requestedTime,
        effectiveWeek: regularSlotChangeForm.effectiveWeek,
        note: regularSlotChangeForm.note,
        status: "pending",
      },
    ]);
    queueCorrespondence({
      kind: "regular-slot-change-requested",
      memberName: activeMemberFullName,
      abandonedDay: regularSlotChangeForm.abandonedDay,
      abandonedTime: regularSlotChangeForm.abandonedTime,
      requestedDay: regularSlotChangeForm.requestedDay,
      requestedTime: regularSlotChangeForm.requestedTime,
      effectiveWeek: effectiveWeekLabel(regularSlotChangeForm.effectiveWeek),
      note: regularSlotChangeForm.note,
    });
    setRegularSlotRequestOpen(false);
    setRegularSlotChangeForm((current) => ({ ...current, note: "" }));
    setMessage("Regular slot change request sent to the coaches.");
  }

  function openRegularSlotManager() {
    setRegularSlotDrafts(regularSlots.map((slot) => ({ ...slot })));
    setWeeklyQuotaDraft(activeWeeklyQuota);
    setRegularSlotDraftNotice("");
    setCoachRegularSlotOpen(true);
  }

  function markRegularSlotDraftChanged() {
    setRegularSlotDraftNotice("Unsaved changes. Press Save changes to keep them.");
  }

  function updateWeeklyQuotaDraft(nextQuota: number) {
    if (!Number.isFinite(nextQuota)) {
      return;
    }

    const quota = Math.min(5, Math.max(1, Math.round(nextQuota)));

    if (quota < regularSlotDrafts.length) {
      setRegularSlotDraftNotice(
        `Remove regular slots before reducing ${activeMemberFullName} below ${regularSlotDrafts.length} sessions per week.`,
      );
      return;
    }

    setWeeklyQuotaDraft(quota);
    markRegularSlotDraftChanged();
  }

  function updateRegularSlotDraft(
    slotId: string,
    updatedSlot: Pick<RegularSlot, "day" | "time">,
  ) {
    const duplicate = regularSlotDrafts.some(
      (slot) => slot.id !== slotId && sameRegularSlot(slot, updatedSlot),
    );

    if (duplicate) {
      setRegularSlotDraftNotice(
        `${activeMemberFullName} already has ${updatedSlot.day} ${updatedSlot.time}.`,
      );
      return;
    }

    setRegularSlotDrafts((drafts) =>
      drafts.map((slot) =>
        slot.id === slotId ? { ...slot, ...updatedSlot } : slot,
      ),
    );
    markRegularSlotDraftChanged();
  }

  function removeRegularSlotDraft(slotId: string) {
    setRegularSlotDrafts((drafts) =>
      drafts.filter((currentSlot) => currentSlot.id !== slotId),
    );
    markRegularSlotDraftChanged();
  }

  function addRegularSlotDraft() {
    if (regularSlotDrafts.length >= weeklyQuotaDraft) {
      setRegularSlotDraftNotice(
        `${activeMemberFullName} already has ${regularSlotDrafts.length}/${weeklyQuotaDraft} regular slots in this draft. Increase weekly sessions first.`,
      );
      return;
    }

    if (regularSlotDrafts.some((slot) => sameRegularSlot(slot, coachRegularSlotForm))) {
      setRegularSlotDraftNotice(
        `${activeMemberFullName} already has ${coachRegularSlotForm.day} ${coachRegularSlotForm.time}.`,
      );
      return;
    }

    setRegularSlotDrafts((drafts) => [
      ...drafts,
      {
        id: `regular-draft-${Date.now()}`,
        day: coachRegularSlotForm.day,
        time: coachRegularSlotForm.time,
      },
    ]);
    markRegularSlotDraftChanged();
  }

  async function saveRegularSlotChanges() {
    if (regularSlotDrafts.length > weeklyQuotaDraft) {
      setRegularSlotDraftNotice(
        `Remove regular slots before saving more than ${weeklyQuotaDraft} sessions per week.`,
      );
      return;
    }

    setRegularSlotDraftNotice("Saving changes...");

    const response = await fetch(
      publicAppPath(`/api/members/${encodeURIComponent(activeMember.id)}/regular-slots`),
      {
        body: JSON.stringify({
          effectiveFrom: coachRegularSlotForm.effectiveWeek,
          slots: regularSlotDrafts,
          weeklyQuota: weeklyQuotaDraft,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      },
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      setRegularSlotDraftNotice(
        payload.error ?? "Could not save regular slot changes yet.",
      );
      return;
    }

    if (weeklyQuotaDraft !== activeWeeklyQuota) {
      queueCorrespondence({
        kind: "weekly-quota-updated",
        memberName: activeMemberFullName,
        weeklyQuota: String(weeklyQuotaDraft),
      });
    }

    const previousSlotsById = new Map(regularSlots.map((slot) => [slot.id, slot]));
    const draftSlotsById = new Map(regularSlotDrafts.map((slot) => [slot.id, slot]));

    regularSlots.forEach((slot) => {
      if (!draftSlotsById.has(slot.id)) {
        queueCorrespondence({
          kind: "regular-slot-removed",
          memberName: activeMemberFullName,
          day: slot.day,
          time: slot.time,
        });
      }
    });

    regularSlotDrafts.forEach((slot) => {
      const previousSlot = previousSlotsById.get(slot.id);

      if (!previousSlot) {
        queueCorrespondence({
          kind: "regular-slot-assigned",
          memberName: activeMemberFullName,
          day: slot.day,
          time: slot.time,
          effectiveWeek: effectiveWeekLabel(coachRegularSlotForm.effectiveWeek),
        });
        return;
      }

      if (!sameRegularSlot(previousSlot, slot)) {
        queueCorrespondence({
          kind: "regular-slot-updated",
          memberName: activeMemberFullName,
          day: slot.day,
          time: slot.time,
        });
      }
    });

    setWeeklyQuotasByMember((quotasByMember) => ({
      ...quotasByMember,
      [activeMember.id]: weeklyQuotaDraft,
    }));
    setRegularSlotsByMember((slotsByMember) => ({
      ...slotsByMember,
      [activeMember.id]: regularSlotDrafts.map((slot) => ({ ...slot })),
    }));
    if (currentUser) {
      void loadScheduleData(activeMember.id, weekOffset);
    }
    setRegularSlotDraftNotice("");
    setCoachRegularSlotOpen(false);
    setMessage(`Saved regular slot changes for ${activeMemberFullName}.`);
  }

  async function approveRegularSlotRequest(request: RegularSlotChangeRequest) {
    const response = await fetch(
      publicAppPath(
        `/api/regular-slot-requests/${encodeURIComponent(request.id)}/review`,
      ),
      {
        body: JSON.stringify({ status: "approved" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );

    if (!response.ok) {
      setMessage(`Could not approve ${request.memberName}'s request yet.`);
      return;
    }

    setRegularSlotRequests((requests) =>
      requests.map((currentRequest) =>
        currentRequest.id === request.id
          ? { ...currentRequest, status: "approved" }
          : currentRequest,
      ),
    );
    const requestMember = members.find(
      (demoMember) => fullName(demoMember) === request.memberName,
    );

    if (requestMember) {
      setRegularSlotsByMember((slotsByMember) => ({
        ...slotsByMember,
        [requestMember.id]: (() => {
          const currentSlots = slotsByMember[requestMember.id] ?? [];
          const nextSlot = {
            id: `regular-${request.id}`,
            day: request.requestedDay,
            time: request.requestedTime,
          };
          const keptSlots =
            request.abandonedDay && request.abandonedTime
              ? currentSlots.filter(
                  (slot) =>
                    slot.day !== request.abandonedDay ||
                    slot.time !== request.abandonedTime,
                )
              : currentSlots.slice(0, -1);

          if (keptSlots.some((slot) => sameRegularSlot(slot, nextSlot))) {
            return currentSlots;
          }

          return [...keptSlots, nextSlot];
        })(),
      }));

      if (currentUser && requestMember.id === activeMember.id) {
        void loadScheduleData(requestMember.id, weekOffset);
      }
    }
    queueCorrespondence({
      kind: "regular-slot-request-approved",
      memberName: request.memberName,
      abandonedDay: request.abandonedDay,
      abandonedTime: request.abandonedTime,
      requestedDay: request.requestedDay,
      requestedTime: request.requestedTime,
      effectiveWeek: effectiveWeekLabel(request.effectiveWeek),
    });
    setMessage(
      request.abandonedDay && request.abandonedTime
        ? `Approved ${request.memberName}'s regular slot change from ${request.abandonedDay} ${request.abandonedTime} to ${request.requestedDay} ${request.requestedTime}.`
        : `Approved ${request.memberName}'s regular slot request for ${request.requestedDay} ${request.requestedTime}.`,
    );
  }

  async function declineRegularSlotRequest(request: RegularSlotChangeRequest) {
    const response = await fetch(
      publicAppPath(
        `/api/regular-slot-requests/${encodeURIComponent(request.id)}/review`,
      ),
      {
        body: JSON.stringify({ status: "declined" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );

    if (!response.ok) {
      setMessage(`Could not decline ${request.memberName}'s request yet.`);
      return;
    }

    setRegularSlotRequests((requests) =>
      requests.map((currentRequest) =>
        currentRequest.id === request.id
          ? { ...currentRequest, status: "declined" }
          : currentRequest,
      ),
    );
    queueCorrespondence({
      kind: "regular-slot-request-declined",
      memberName: request.memberName,
      abandonedDay: request.abandonedDay,
      abandonedTime: request.abandonedTime,
      requestedDay: request.requestedDay,
      requestedTime: request.requestedTime,
      effectiveWeek: effectiveWeekLabel(request.effectiveWeek),
    });
    setMessage(`Declined ${request.memberName}'s regular slot request.`);
  }

  async function bookSlot(
    dayIndex: number,
    slotIndex: number,
    options: { coachOverride?: boolean } = {},
  ) {
    const day = week[dayIndex];
    const slot = day.slots[slotIndex];
    const state = slotState(slot, activeMember);

    if (state === "mine") {
      setMessage(`${activeMemberFullName} is already booked for ${bookingLabel(day)} at ${slot.time}.`);
      return;
    }

    if (state === "full" && !options.coachOverride) {
      void joinWaitlist(dayIndex, slotIndex);
      return;
    }

    if (currentUser) {
      const response = await fetch(publicAppPath("/api/bookings"), {
        body: JSON.stringify({
          coachOverride: options.coachOverride === true,
          memberId: activeMember.id,
          sessionDate: day.isoDate,
          startTime: slot.time,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        bookingKind?: UpcomingBooking["kind"];
        error?: string;
        schedule?: ScheduleData;
      };

      if (!response.ok || !payload.schedule) {
        setMessage(payload.error ?? "Could not create this booking.");
        return;
      }

      applyScheduleData(payload.schedule, weekOffset);

      const kind =
        payload.bookingKind ??
        (options.coachOverride ? "Coach override" : "Regular");

      queueCorrespondence({
        kind: "booking-created",
        memberName: activeMemberFullName,
        bookingDate: bookingLabel(day),
        time: slot.time,
        bookingKind: kind,
      });
      setSelectedSlot({ weekOffset, dayIndex, slotIndex });
      setBookingOpen(false);
      setMessage(
        options.coachOverride
          ? `Coach override booked ${activeMemberFullName} for ${bookingLabel(day)} at ${slot.time}.`
          : `${kind} booked for ${activeMemberFullName} on ${bookingLabel(day)} at ${slot.time}.`,
      );
      return;
    }

    const needsCredit =
      !options.coachOverride && activeBookingsThisWeek >= activeWeeklyQuota;

    if (needsCredit && credits.length === 0) {
      setMessage("Weekly quota reached. A coach override would be needed.");
      return;
    }

    updateSlot(dayIndex, slotIndex, (currentSlot) => ({
      ...currentSlot,
      names: [...currentSlot.names, activeMember.firstName],
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
    queueCorrespondence({
      kind: "booking-created",
      memberName: activeMemberFullName,
      bookingDate: bookingLabel(day),
      time: slot.time,
      bookingKind: options.coachOverride ? "Coach override" : kind,
    });
    setSelectedSlot({ weekOffset, dayIndex, slotIndex });
    setBookingOpen(false);
    setMessage(
      options.coachOverride
        ? `Coach override booked ${activeMemberFullName} for ${bookingLabel(day)} at ${slot.time}.`
        : `${kind} booked for ${activeMemberFullName} on ${bookingLabel(day)} at ${slot.time}.`,
    );
  }

  async function cancelSlot(dayIndex: number, slotIndex: number) {
    const day = week[dayIndex];
    const slot = day.slots[slotIndex];
    const matchingBooking = upcoming.find(
      (booking) => booking.isoDate === day.isoDate && booking.time === slot.time,
    );

    if (currentUser) {
      const response = await fetch(publicAppPath("/api/bookings/cancel"), {
        body: JSON.stringify({
          memberId: activeMember.id,
          sessionDate: day.isoDate,
          startTime: slot.time,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        bookingKind?: UpcomingBooking["kind"];
        creditIssued?: boolean;
        error?: string;
        schedule?: ScheduleData;
      };

      if (!response.ok || !payload.schedule) {
        setMessage(payload.error ?? "Could not cancel this booking.");
        return;
      }

      applyScheduleData(payload.schedule, weekOffset);
      queueCorrespondence({
        kind: "booking-cancelled",
        memberName: activeMemberFullName,
        bookingDate: bookingLabel(day),
        time: slot.time,
        bookingKind: payload.bookingKind ?? matchingBooking?.kind ?? "Regular",
      });

      if (payload.creditIssued) {
        setBookingOpen(true);
        setMessage(
          `Cancelled ${bookingLabel(day)} at ${slot.time}. Credit issued. Pick a new slot now or decide later.`,
        );
      } else {
        setMessage(
          `Cancelled ${payload.bookingKind ?? "Makeup"} booking for ${bookingLabel(day)} at ${slot.time}.`,
        );
      }

      return;
    }

    updateSlot(dayIndex, slotIndex, (currentSlot) => ({
      ...currentSlot,
      names: currentSlot.names.filter((name) => name !== activeMember.firstName),
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
      queueCorrespondence({
        kind: "booking-cancelled",
        memberName: activeMemberFullName,
        bookingDate: bookingLabel(day),
        time: slot.time,
        bookingKind: matchingBooking?.kind ?? "Regular",
      });
      setMessage(
        `Cancelled ${bookingLabel(day)} at ${slot.time}. Credit issued. Pick a new slot now or decide later.`,
      );
    } else {
      queueCorrespondence({
        kind: "booking-cancelled",
        memberName: activeMemberFullName,
        bookingDate: bookingLabel(day),
        time: slot.time,
        bookingKind: "Makeup",
      });
      setMessage(`Cancelled makeup booking for ${bookingLabel(day)} at ${slot.time}.`);
    }
  }

  async function joinWaitlist(dayIndex: number, slotIndex: number) {
    const day = week[dayIndex];
    const slot = day.slots[slotIndex];
    const alreadyJoined = waitlist.some(
      (entry) => entry.isoDate === day.isoDate && entry.time === slot.time,
    );

    if (currentUser) {
      const response = await fetch(publicAppPath("/api/waitlist"), {
        body: JSON.stringify({
          memberId: activeMember.id,
          sessionDate: day.isoDate,
          startTime: slot.time,
        }),
        headers: { "Content-Type": "application/json" },
        method: alreadyJoined ? "DELETE" : "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        schedule?: ScheduleData;
      };

      if (!response.ok || !payload.schedule) {
        setMessage(payload.error ?? "Could not update the waitlist.");
        return;
      }

      applyScheduleData(payload.schedule, weekOffset);
      queueCorrespondence({
        kind: alreadyJoined ? "waitlist-left" : "waitlist-joined",
        memberName: activeMemberFullName,
        bookingDate: bookingLabel(day),
        time: slot.time,
      });
      setMessage(
        alreadyJoined
          ? `Left waitlist for ${bookingLabel(day)} at ${slot.time}.`
          : `Joined waitlist for ${activeMemberFullName} on ${bookingLabel(day)} at ${slot.time}.`,
      );
      return;
    }

    if (alreadyJoined) {
      setWaitlist((entries) =>
        entries.filter(
          (entry) => !(entry.isoDate === day.isoDate && entry.time === slot.time),
        ),
      );
      queueCorrespondence({
        kind: "waitlist-left",
        memberName: activeMemberFullName,
        bookingDate: bookingLabel(day),
        time: slot.time,
      });
      setMessage(`Left waitlist for ${bookingLabel(day)} at ${slot.time}.`);
      return;
    }

    if (activeBookingsThisWeek >= activeWeeklyQuota && credits.length === 0) {
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
    queueCorrespondence({
      kind: "waitlist-joined",
      memberName: activeMemberFullName,
      bookingDate: bookingLabel(day),
      time: slot.time,
    });
    setMessage(
      `Joined waitlist for ${activeMemberFullName} on ${bookingLabel(day)} at ${slot.time}.`,
    );
  }

  function moveWeek(direction: -1 | 1) {
    const nextOffset = Math.min(3, Math.max(0, weekOffset + direction));

    setSelectedSlot(null);
    setWeekOffset(nextOffset);

    if (currentUser) {
      void loadScheduleData(activeMember.id, nextOffset);
    }
  }

  function showToday() {
    setWeekOffset(0);
    setCoachDayIndex(sessionDayIndexFromIso(todayIsoDate()));
    setSelectedSlot(null);

    if (currentUser) {
      void loadScheduleData(activeMember.id, 0);
    }
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
          {authMessage && (
            <p className="mt-4 rounded-lg border border-[var(--line)] bg-black/20 p-3 text-sm text-[var(--muted)]">
              {authMessage}
            </p>
          )}

          <button
            className="mt-5 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)] hover:border-[var(--mint)] hover:text-white"
            type="button"
            onClick={() => {
              setPendingRegistration(null);
              setAuthMode("sign-in");
            }}
          >
            Back to log in
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

            {previewAccessEnabled && (
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  className="rounded-lg border border-[var(--mint)] bg-[rgba(0,255,184,0.12)] p-4 text-left hover:bg-[rgba(0,255,184,0.18)]"
                  type="button"
                  onClick={() => enterDemo("member")}
                >
                  <UsersRound
                    aria-hidden="true"
                    className="mb-4 size-5 text-[var(--mint)]"
                  />
                  <div className="font-semibold">Preview member</div>
                  <div className="mt-1 text-sm text-[var(--muted)]">Maddie Cannon</div>
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
                  <div className="font-semibold">Preview coach</div>
                  <div className="mt-1 text-sm text-[var(--muted)]">{coachNames}</div>
                </button>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 shadow-2xl">
            {authMode !== "reset-password" && (
              <div className="mb-4 grid grid-cols-2 gap-2">
                <button
                  className={`rounded-md px-3 py-2 text-sm font-medium ${
                    authMode === "sign-in" || authMode === "forgot-password"
                      ? "bg-[var(--mint)] text-[#01161c]"
                      : "border border-[var(--line)] text-[var(--muted)] hover:text-white"
                  }`}
                  type="button"
                  onClick={() => {
                    setAuthMode("sign-in");
                    setAuthMessage("");
                  }}
                >
                  Log in
                </button>
                <button
                  className={`rounded-md px-3 py-2 text-sm font-medium ${
                    authMode === "register"
                      ? "bg-[var(--mint)] text-[#01161c]"
                      : "border border-[var(--line)] text-[var(--muted)] hover:text-white"
                  }`}
                  type="button"
                  onClick={() => {
                    setAuthMode("register");
                    setAuthMessage("");
                  }}
                >
                  Create account
                </button>
              </div>
            )}

            {authMode === "sign-in" && (
              <form className="space-y-3" onSubmit={submitSignIn}>
                <label className="block text-sm font-medium" htmlFor="email">
                  Email
                  <div className="mt-1 flex items-center gap-2 rounded-md border border-[var(--line)] bg-black/20 px-3">
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
                </label>
                <label className="block text-sm font-medium" htmlFor="password">
                  Password
                  <input
                    className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 text-sm outline-none focus:border-[var(--mint)]"
                    id="password"
                    type="password"
                    required
                    value={signInPassword}
                    onChange={(event) => setSignInPassword(event.target.value)}
                  />
                </label>
                <button
                  className="w-full rounded-md bg-[var(--mint)] px-3 py-2 text-sm font-semibold text-[#01161c] hover:bg-white"
                  type="submit"
                  disabled={authBusy}
                >
                  Log in
                </button>
                <button
                  className="w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)] hover:border-[var(--mint)] hover:text-white"
                  type="button"
                  onClick={() => {
                    setResetPasswordForm((current) => ({
                      ...current,
                      email: signInEmail,
                    }));
                    setAuthMode("forgot-password");
                    setAuthMessage("");
                  }}
                >
                  Forgot password?
                </button>
                {authMessage && (
                  <p className="rounded-lg border border-[var(--line)] bg-black/20 p-3 text-sm text-[var(--muted)]">
                    {authMessage}
                  </p>
                )}
              </form>
            )}

            {authMode === "forgot-password" && (
              <form className="space-y-3" onSubmit={submitForgotPassword}>
                <label className="block text-sm font-medium" htmlFor="resetEmail">
                  Email
                  <input
                    className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 text-sm outline-none focus:border-[var(--mint)]"
                    id="resetEmail"
                    type="email"
                    required
                    value={resetPasswordForm.email}
                    onChange={(event) =>
                      setResetPasswordForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                </label>
                <button
                  className="w-full rounded-md bg-[var(--mint)] px-3 py-2 text-sm font-semibold text-[#01161c] hover:bg-white"
                  type="submit"
                  disabled={authBusy}
                >
                  Send reset link
                </button>
                <button
                  className="w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)] hover:border-[var(--mint)] hover:text-white"
                  type="button"
                  onClick={() => {
                    setAuthMode("sign-in");
                    setAuthMessage("");
                  }}
                >
                  Back to log in
                </button>
                {authMessage && (
                  <p className="rounded-lg border border-[var(--line)] bg-black/20 p-3 text-sm text-[var(--muted)]">
                    {authMessage}
                  </p>
                )}
              </form>
            )}

            {authMode === "reset-password" && (
              <form className="space-y-3" onSubmit={submitResetPassword}>
                <div>
                  <p className="text-sm text-[var(--muted)]">Fit East London</p>
                  <h2 className="text-xl font-semibold">Create new password</h2>
                </div>
                <label className="block text-sm font-medium" htmlFor="resetLinkEmail">
                  Email
                  <input
                    className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 text-sm text-[var(--muted)] outline-none"
                    id="resetLinkEmail"
                    readOnly
                    value={resetPasswordForm.email}
                  />
                </label>
                <label className="block text-sm font-medium" htmlFor="newPassword">
                  New password
                  <input
                    className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 text-sm outline-none focus:border-[var(--mint)]"
                    id="newPassword"
                    type="password"
                    required
                    minLength={8}
                    value={resetPasswordForm.password}
                    onChange={(event) =>
                      setResetPasswordForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                  />
                </label>
                <label
                  className="block text-sm font-medium"
                  htmlFor="newPasswordConfirm"
                >
                  Confirm password
                  <input
                    className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 text-sm outline-none focus:border-[var(--mint)]"
                    id="newPasswordConfirm"
                    type="password"
                    required
                    minLength={8}
                    value={resetPasswordForm.passwordConfirm}
                    onChange={(event) =>
                      setResetPasswordForm((current) => ({
                        ...current,
                        passwordConfirm: event.target.value,
                      }))
                    }
                  />
                </label>
                <button
                  className="w-full rounded-md bg-[var(--mint)] px-3 py-2 text-sm font-semibold text-[#01161c] hover:bg-white"
                  type="submit"
                  disabled={authBusy}
                >
                  Set new password
                </button>
                {authMessage && (
                  <p className="rounded-lg border border-[var(--line)] bg-black/20 p-3 text-sm text-[var(--muted)]">
                    {authMessage}
                  </p>
                )}
              </form>
            )}

            {authMode === "register" && (
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium" htmlFor="registerPassword">
                    Password
                    <input
                      className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 text-sm outline-none focus:border-[var(--mint)]"
                      id="registerPassword"
                      type="password"
                      required
                      minLength={8}
                      value={registration.password}
                      onChange={(event) =>
                        setRegistration((current) => ({
                          ...current,
                          password: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label
                    className="block text-sm font-medium"
                    htmlFor="registerPasswordConfirm"
                  >
                    Confirm password
                    <input
                      className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 text-sm outline-none focus:border-[var(--mint)]"
                      id="registerPasswordConfirm"
                      type="password"
                      required
                      minLength={8}
                      value={registration.passwordConfirm}
                      onChange={(event) =>
                        setRegistration((current) => ({
                          ...current,
                          passwordConfirm: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <button
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--mint)] px-3 py-2 text-sm font-semibold text-[#01161c] hover:bg-white"
                  type="submit"
                  disabled={authBusy}
                >
                  <UserPlus aria-hidden="true" className="size-4" />
                  Submit request
                </button>
                {authMessage && (
                  <p className="rounded-lg border border-[var(--line)] bg-black/20 p-3 text-sm text-[var(--muted)]">
                    {authMessage}
                  </p>
                )}
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
              {currentUser
                ? `${currentUser.firstName} · ${currentUser.role}`
                : isCoach
                  ? "Preview coach"
                  : "Preview member"}
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
            {isCoach ? (
              <>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-[var(--muted)]">Coach dashboard</p>
                    <h2 className="mt-1 text-2xl font-semibold">Members</h2>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Coaches: {coachNames}
                    </p>
                  </div>
                  <div className="rounded-md border border-[var(--orange)] px-2 py-1 text-sm text-[var(--orange)]">
                    {members.length} total
                  </div>
                </div>

                <div className="grid max-h-96 gap-2 overflow-y-auto pr-1">
                  {members.map((demoMember) => {
                    const isSelected = demoMember.id === activeMember.id;

                    return (
                      <button
                        className={`rounded-lg border p-3 text-left ${
                          isSelected
                            ? "border-[var(--mint)] bg-[rgba(0,255,184,0.12)]"
                            : "border-[var(--line)] bg-black/20 hover:border-[var(--orange)]"
                        }`}
                        key={demoMember.id}
                        type="button"
                        onClick={() => {
                          setSelectedMemberId(demoMember.id);
                          setSelectedSlot(null);
                          setCoachRegularSlotForm((current) => ({
                            ...current,
                            memberName: fullName(demoMember),
                          }));
                          setMessage("Ready for bookings");

                          if (currentUser) {
                            void loadScheduleData(demoMember.id, weekOffset);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{fullName(demoMember)}</span>
                          <span className="text-sm text-[var(--mint)]">
                            {weeklyQuotasByMember[demoMember.id] ?? demoMember.weeklyQuota}x
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-[var(--muted)]">
                          {demoMember.status}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-[var(--muted)]">Member</p>
                    <h2 className="mt-1 text-2xl font-semibold">
                      {activeMember.firstName}
                    </h2>
                  </div>
                  <div className="rounded-md border border-[var(--orange)] px-2 py-1 text-sm text-[var(--orange)]">
                    {activeWeeklyQuota}x weekly
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  {metrics.map((metric) => (
                    <div
                      className="rounded-lg border border-[var(--line)] bg-black/20 p-3"
                      key={metric.label}
                    >
                      <metric.icon
                        aria-hidden="true"
                        className="size-4 text-[var(--mint)]"
                      />
                      <div className="mt-3 text-2xl font-semibold">{metric.value}</div>
                      <div className="text-xs text-[var(--muted)]">{metric.label}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Regular slots</h2>
                <p className="text-xs text-[var(--muted)]">
                  {isCoach
                    ? `Coach managed for ${activeMemberFullName} · ${regularSlots.length}/${activeWeeklyQuota} assigned`
                    : "Coach approval required"}
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
              {regularSlots.length === 0 && (
                <p className="rounded-lg border border-[var(--line)] bg-black/20 p-3 text-sm text-[var(--muted)]">
                  No regular slots assigned.
                </p>
              )}
            </div>

            {isCoach ? (
              <button
                className="mt-3 w-full rounded-md bg-[var(--mint)] px-3 py-2 text-sm font-semibold text-[#01161c] hover:bg-white"
                type="button"
                onClick={openRegularSlotManager}
              >
                Manage regular slots
              </button>
            ) : (
              <button
                className="mt-3 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)] hover:border-[var(--mint)] hover:text-white"
                type="button"
                disabled={regularSlots.length === 0}
                onClick={openRegularSlotRequest}
              >
                Request change
              </button>
            )}

            <div className="mt-3 space-y-2">
              {isCoach && activeMember.status === "pending" && (
                <button
                  className="w-full rounded-md bg-[var(--orange)] px-3 py-2 text-sm font-semibold text-[#01161c] hover:bg-white"
                  type="button"
                  onClick={() => approveMemberAccess(activeMember)}
                >
                  Approve access
                </button>
              )}
              {regularSlotRequests
                .filter((request) => request.memberName === activeMemberFullName)
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
                        {request.abandonedDay && request.abandonedTime ? (
                          <div className="text-sm text-[var(--muted)]">
                            From {request.abandonedDay} {request.abandonedTime} to{" "}
                            {request.requestedDay} {request.requestedTime}
                            <span className="block">
                              Effective {effectiveWeekLabel(request.effectiveWeek)}
                            </span>
                          </div>
                        ) : (
                          <div className="text-sm text-[var(--muted)]">
                            To {request.requestedDay} {request.requestedTime}
                            <span className="block">
                              Effective {effectiveWeekLabel(request.effectiveWeek)}
                            </span>
                          </div>
                        )}
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

          {!isCoach && (
            <>
              <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">Upcoming</h2>
                  <CalendarDays
                    aria-hidden="true"
                    className="size-5 text-[var(--orange)]"
                  />
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
                          <div className="text-sm text-[var(--muted)]">
                            {booking.kind}
                          </div>
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
                  <UsersRound
                    aria-hidden="true"
                    className="size-5 text-[var(--olive)]"
                  />
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
            </>
          )}
        </aside>

        <section className="min-w-0 rounded-lg border border-[var(--line)] bg-[rgba(9,36,44,0.82)]">
          <div className="flex flex-col gap-4 border-b border-[var(--line)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <UsersRound aria-hidden="true" className="size-4" />
                {isCoach ? "Coach schedule" : "Member schedule"}
              </div>
              <h2 className="mt-1 text-2xl font-semibold">
                {isCoach
                  ? coachDayIsToday
                    ? "Today's sessions"
                    : "Day sessions"
                  : "Week schedule"}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {isCoach
                  ? `${bookingLabel(coachDay)} · ${coachDayBookingCount}/${coachDayCapacity} booked · Managing ${activeMemberFullName}. ${message}`
                  : message}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isCoach && (
                <button
                  className="rounded-md border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)] hover:border-[var(--mint)] hover:text-white"
                  type="button"
                  onClick={showToday}
                >
                  Today
                </button>
              )}
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

          {isCoach && (
            <div className="grid grid-cols-5 gap-2 border-b border-[var(--line)] p-4">
              {week.map((day, dayIndex) => {
                const isSelected = dayIndex === coachDayIndex;
                const bookedCount = day.slots.reduce(
                  (count, slot) => count + slot.names.length,
                  0,
                );

                return (
                  <button
                    className={`min-h-16 rounded-lg border px-2 py-2 text-left transition-colors ${
                      isSelected
                        ? "border-[var(--mint)] bg-[rgba(0,255,184,0.14)] text-white"
                        : "border-[var(--line)] bg-black/20 text-[var(--muted)] hover:border-[var(--orange)] hover:text-white"
                    }`}
                    key={day.isoDate}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setCoachDayIndex(dayIndex);
                      setSelectedSlot(null);
                    }}
                  >
                    <div className="text-sm font-semibold">{day.day}</div>
                    <div className="mt-1 text-xs">{day.date}</div>
                    <div className="mt-2 text-xs">{bookedCount} booked</div>
                  </button>
                );
              })}
            </div>
          )}

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
                      : slotState(selectedDetails.slot, activeMember) === "mine"
                        ? "Your booking"
                        : `${bookingRules.slotCapacity - selectedDetails.slot.names.length} spots available`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {slotState(selectedDetails.slot, activeMember) === "mine" && (
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
                  {slotState(selectedDetails.slot, activeMember) ===
                    "available" && (
                    <button
                      className="rounded-md bg-[var(--mint)] px-3 py-2 text-sm font-semibold text-[#01161c] hover:bg-white"
                      type="button"
                      onClick={() =>
                        bookSlot(selectedDetails.dayIndex, selectedDetails.slotIndex)
                      }
                    >
                      {isCoach ? `Add ${activeMember.firstName}` : "Book spot"}
                    </button>
                  )}
                  {slotState(selectedDetails.slot, activeMember) === "full" &&
                    isCoach && (
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
                  {slotState(selectedDetails.slot, activeMember) === "full" &&
                    !isCoach && (
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

          {isCoach ? (
            <div className="grid gap-3 p-4">
              {coachDay.slots.map((slot, slotIndex) => {
                const state = slotState(slot, activeMember);
                const spotsLeft = Math.max(
                  0,
                  bookingRules.slotCapacity - slot.names.length,
                );
                const isSelected =
                  selectedSlot?.weekOffset === weekOffset &&
                  selectedSlot.dayIndex === coachDayIndex &&
                  selectedSlot.slotIndex === slotIndex;

                return (
                  <button
                    className={`rounded-lg border p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--mint)] ${
                      isSelected
                        ? "border-[var(--mint)] bg-[rgba(0,255,184,0.12)]"
                        : state === "full"
                          ? "border-[rgba(255,78,184,0.55)] bg-[rgba(255,78,184,0.08)] hover:border-[var(--pink)]"
                          : "border-[var(--line)] bg-[var(--panel)] hover:border-[var(--orange)]"
                    }`}
                    key={`${coachDay.day}-${slot.time}`}
                    type="button"
                    onClick={() =>
                      setSelectedSlot({
                        weekOffset,
                        dayIndex: coachDayIndex,
                        slotIndex,
                      })
                    }
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xl font-semibold">{slot.time}</span>
                          <span
                            className={`rounded-md border px-2 py-1 text-xs ${
                              state === "full"
                                ? "border-[rgba(255,78,184,0.55)] text-[var(--pink)]"
                                : "border-[var(--line)] text-[var(--muted)]"
                            }`}
                          >
                            {state === "full" ? "Full" : `${spotsLeft} open`}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-[var(--muted)]">
                          {slot.names.length} of {bookingRules.slotCapacity} booked
                        </div>
                      </div>
                      <div className="rounded-md border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--mint)]">
                        {slot.names.length}/{bookingRules.slotCapacity}
                      </div>
                    </div>

                    <div className="mt-4 flex min-h-8 flex-wrap gap-2">
                      {slot.names.length > 0 ? (
                        slot.names.map((name) => (
                          <span
                            className={`rounded-md border px-2 py-1 text-sm ${
                              name === activeMember.firstName
                                ? "border-[var(--mint)] bg-[rgba(0,255,184,0.12)] text-white"
                                : "border-[var(--line)] bg-black/20 text-[var(--muted)]"
                            }`}
                            key={`${slot.time}-${name}`}
                          >
                            {name}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-md border border-[var(--line)] bg-black/20 px-2 py-1 text-sm text-[var(--muted)]">
                          Open
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-3 p-4 lg:grid-cols-5">
              {week.map((day, dayIndex) => (
                <div className="min-w-0" key={day.day}>
                  <div className="mb-3 flex items-baseline justify-between gap-2">
                    <h3 className="text-lg font-semibold">{day.day}</h3>
                    <span className="text-sm text-[var(--muted)]">{day.date}</span>
                  </div>
                  <div className="grid gap-2">
                    {day.slots.map((slot, slotIndex) => {
                      const state = slotState(slot, activeMember);
                      const spotsLeft =
                        bookingRules.slotCapacity - slot.names.length;

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
                            {state === "mine"
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
          )}
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

            <label className="block text-sm font-medium" htmlFor="abandonedSlot">
              Current regular slot
              <select
                className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-[#09242c] px-3 text-sm outline-none focus:border-[var(--mint)]"
                id="abandonedSlot"
                value={`${regularSlotChangeForm.abandonedDay}|${regularSlotChangeForm.abandonedTime}`}
                onChange={(event) => {
                  const [day, time] = event.target.value.split("|");

                  setRegularSlotChangeForm((current) => ({
                    ...current,
                    abandonedDay: day ?? "",
                    abandonedTime: time ?? "",
                  }));
                }}
              >
                {regularSlots.map((slot) => (
                  <option key={slot.id} value={`${slot.day}|${slot.time}`}>
                    {slot.day} {slot.time}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium" htmlFor="requestedDay">
                New day
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
                New time
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
          <div
            className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Manage regular slots</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {regularSlotDrafts.length}/{weeklyQuotaDraft} assigned for{" "}
                  {activeMemberFullName}.
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
                className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 text-sm text-[var(--muted)] outline-none"
                id="coachMemberName"
                readOnly
                value={activeMemberFullName}
              />
            </label>

            <label className="mt-3 block text-sm font-medium" htmlFor="coachWeeklyQuota">
              Sessions per week
              <select
                className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-[#09242c] px-3 text-sm outline-none focus:border-[var(--mint)]"
                id="coachWeeklyQuota"
                value={String(weeklyQuotaDraft)}
                onChange={(event) => updateWeeklyQuotaDraft(Number(event.target.value))}
              >
                {[1, 2, 3, 4, 5].map((quota) => (
                  <option key={quota} value={String(quota)}>
                    {quota}
                  </option>
                ))}
              </select>
            </label>

            {regularSlotDraftNotice && (
              <p className="mt-3 rounded-lg border border-[var(--line)] bg-black/20 p-3 text-sm text-[var(--muted)]">
                {regularSlotDraftNotice}
              </p>
            )}

            <div className="mt-4 space-y-2">
              {regularSlotDrafts.map((slot) => (
                <div
                  className="rounded-lg border border-[var(--line)] bg-black/20 p-3"
                  key={slot.id}
                >
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <label
                      className="block text-sm font-medium"
                      htmlFor={`regular-${slot.id}-day`}
                    >
                      Day
                      <select
                        aria-label={`${slot.day} ${slot.time} day`}
                        className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-[#09242c] px-3 text-sm outline-none focus:border-[var(--mint)]"
                        id={`regular-${slot.id}-day`}
                        value={slot.day}
                        onChange={(event) =>
                          updateRegularSlotDraft(slot.id, {
                            day: event.target.value,
                            time: slot.time,
                          })
                        }
                      >
                        {weekdayOptions.map((day) => (
                          <option key={day}>{day}</option>
                        ))}
                      </select>
                    </label>

                    <label
                      className="block text-sm font-medium"
                      htmlFor={`regular-${slot.id}-time`}
                    >
                      Time
                      <select
                        aria-label={`${slot.day} ${slot.time} time`}
                        className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-[#09242c] px-3 text-sm outline-none focus:border-[var(--mint)]"
                        id={`regular-${slot.id}-time`}
                        value={slot.time}
                        onChange={(event) =>
                          updateRegularSlotDraft(slot.id, {
                            day: slot.day,
                            time: event.target.value,
                          })
                        }
                      >
                        {bookingRules.slotTimes.map((time) => (
                          <option key={time}>{time}</option>
                        ))}
                      </select>
                    </label>

                    <button
                      className="min-h-11 rounded-md border border-[rgba(255,78,184,0.55)] px-3 py-2 text-sm text-[var(--pink)] hover:bg-[rgba(255,78,184,0.1)]"
                      type="button"
                      onClick={() => removeRegularSlotDraft(slot.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              {regularSlotDrafts.length === 0 && (
                <p className="rounded-lg border border-[var(--line)] bg-black/20 p-3 text-sm text-[var(--muted)]">
                  No regular slots assigned.
                </p>
              )}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium" htmlFor="coachRegularDay">
                New day
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
                New time
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
              className="mt-3 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)] enabled:hover:border-[var(--mint)] enabled:hover:text-white disabled:opacity-45"
              type="button"
              disabled={regularSlotDrafts.length >= weeklyQuotaDraft}
              onClick={addRegularSlotDraft}
            >
              Add session
            </button>

            <button
              className="mt-4 w-full rounded-md bg-[var(--mint)] px-3 py-2 text-sm font-semibold text-[#01161c] enabled:hover:bg-white disabled:opacity-45"
              type="button"
              disabled={!regularSlotDraftChanged}
              onClick={saveRegularSlotChanges}
            >
              Save changes
            </button>
          </div>
        </div>
      )}

      {bookingOpen && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/60 p-4 sm:items-center sm:justify-center">
          <div className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {isCoach ? `Add ${activeMember.firstName} to a session` : "Book a session"}
                </h2>
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
