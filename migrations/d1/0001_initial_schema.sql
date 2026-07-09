create table if not exists members (
  id text primary key,
  auth_user_id text unique,
  first_name text not null,
  last_name text not null,
  phone text,
  email text not null unique,
  weekly_quota integer not null check (weekly_quota >= 1),
  role text not null default 'member' check (role in ('member', 'coach')),
  status text not null default 'pending' check (status in ('pending', 'active', 'archived')),
  attended_count integer not null default 0 check (attended_count >= 0),
  missed_count integer not null default 0 check (missed_count >= 0),
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table if not exists recurring_slots (
  id text primary key,
  member_id text not null references members(id) on delete cascade,
  weekday integer not null check (weekday between 1 and 5),
  start_time text not null check (
    start_time in ('06:30', '07:00', '07:30', '08:00', '08:30')
  ),
  effective_from text not null,
  effective_until text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  check (effective_until is null or effective_until >= effective_from)
);

create index if not exists recurring_slots_member_lookup
  on recurring_slots (member_id, effective_from, effective_until);

create table if not exists bookings (
  id text primary key,
  member_id text not null references members(id) on delete restrict,
  session_date text not null,
  start_time text not null check (
    start_time in ('06:30', '07:00', '07:30', '08:00', '08:30')
  ),
  status text not null default 'booked' check (status in ('booked', 'no_show', 'cancelled')),
  kind text not null default 'regular' check (kind in ('regular', 'makeup', 'coach_override')),
  redeemed_credit_id text,
  cancelled_at text,
  cancelled_by text references members(id) on delete set null,
  coach_override integer not null default 0 check (coach_override in (0, 1)),
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  check (
    (status = 'cancelled' and cancelled_at is not null)
    or (status <> 'cancelled' and cancelled_at is null)
  )
);

create unique index if not exists bookings_one_active_per_member_slot
  on bookings (member_id, session_date, start_time)
  where status <> 'cancelled';

create index if not exists bookings_slot_lookup
  on bookings (session_date, start_time)
  where status <> 'cancelled';

create table if not exists credits (
  id text primary key,
  member_id text not null references members(id) on delete restrict,
  origin_booking_id text not null references bookings(id) on delete restrict,
  origin text not null check (origin in ('cancellation', 'no_show', 'closure')),
  expires_on text not null,
  status text not null default 'available' check (status in ('available', 'redeemed', 'expired')),
  redeemed_by_booking_id text references bookings(id) on delete set null,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create unique index if not exists credits_one_credit_per_origin
  on credits (origin_booking_id, origin);

create table if not exists waitlist_entries (
  id text primary key,
  member_id text not null references members(id) on delete cascade,
  session_date text not null,
  start_time text not null check (
    start_time in ('06:30', '07:00', '07:30', '08:00', '08:30')
  ),
  created_at text not null default (datetime('now')),
  unique (member_id, session_date, start_time)
);

create index if not exists waitlist_slot_lookup
  on waitlist_entries (session_date, start_time, created_at);

create table if not exists closures (
  id text primary key,
  date text not null unique,
  reason text,
  created_by text references members(id) on delete set null,
  created_at text not null default (datetime('now'))
);

create table if not exists regular_slot_change_requests (
  id text primary key,
  member_id text not null references members(id) on delete cascade,
  requested_weekday integer not null check (requested_weekday between 1 and 5),
  requested_start_time text not null check (
    requested_start_time in ('06:30', '07:00', '07:30', '08:00', '08:30')
  ),
  effective_from text not null,
  note text,
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'declined', 'cancelled')
  ),
  reviewed_by text references members(id) on delete set null,
  reviewed_at text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  check (
    (status in ('pending', 'cancelled') and reviewed_at is null)
    or (status in ('approved', 'declined') and reviewed_at is not null)
  )
);

create index if not exists regular_slot_change_requests_member_lookup
  on regular_slot_change_requests (member_id, status, effective_from);

create index if not exists regular_slot_change_requests_pending_lookup
  on regular_slot_change_requests (status, created_at)
  where status = 'pending';

create table if not exists app_state (
  key text primary key,
  value text not null,
  updated_at text not null default (datetime('now'))
);
