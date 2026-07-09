create extension if not exists citext;
create extension if not exists pgcrypto;

create type public.member_role as enum ('member', 'coach');
create type public.member_status as enum ('pending', 'active', 'archived');
create type public.booking_status as enum ('booked', 'no_show', 'cancelled');
create type public.booking_kind as enum ('regular', 'makeup', 'coach_override');
create type public.credit_origin as enum ('cancellation', 'no_show', 'closure');
create type public.credit_status as enum ('available', 'redeemed', 'expired');

create table public.members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  first_name text not null,
  last_name text not null,
  phone text,
  email citext not null unique,
  weekly_quota smallint not null check (weekly_quota >= 1),
  role public.member_role not null default 'member',
  status public.member_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recurring_slots (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 5),
  start_time time not null check (
    start_time in ('06:30', '07:00', '07:30', '08:00', '08:30')
  ),
  effective_from date not null,
  effective_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_until is null or effective_until >= effective_from)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  session_date date not null,
  start_time time not null check (
    start_time in ('06:30', '07:00', '07:30', '08:00', '08:30')
  ),
  status public.booking_status not null default 'booked',
  kind public.booking_kind not null default 'regular',
  redeemed_credit_id uuid,
  cancelled_at timestamptz,
  cancelled_by uuid references public.members(id) on delete set null,
  coach_override boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'cancelled' and cancelled_at is not null)
    or (status <> 'cancelled' and cancelled_at is null)
  )
);

create unique index bookings_one_active_per_member_slot
  on public.bookings (member_id, session_date, start_time)
  where status <> 'cancelled';

create index bookings_slot_lookup
  on public.bookings (session_date, start_time)
  where status <> 'cancelled';

create table public.credits (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  origin_booking_id uuid not null references public.bookings(id) on delete restrict,
  origin public.credit_origin not null,
  expires_on date not null,
  status public.credit_status not null default 'available',
  redeemed_by_booking_id uuid references public.bookings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bookings
  add constraint bookings_redeemed_credit_id_fkey
  foreign key (redeemed_credit_id)
  references public.credits(id)
  on delete set null;

create unique index credits_one_credit_per_origin
  on public.credits (origin_booking_id, origin);

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  session_date date not null,
  start_time time not null check (
    start_time in ('06:30', '07:00', '07:30', '08:00', '08:30')
  ),
  created_at timestamptz not null default now(),
  unique (member_id, session_date, start_time)
);

create index waitlist_slot_lookup
  on public.waitlist_entries (session_date, start_time, created_at);

create table public.closures (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  reason text,
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger members_set_updated_at
  before update on public.members
  for each row execute function public.set_updated_at();

create trigger recurring_slots_set_updated_at
  before update on public.recurring_slots
  for each row execute function public.set_updated_at();

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

create trigger credits_set_updated_at
  before update on public.credits
  for each row execute function public.set_updated_at();

alter table public.members enable row level security;
alter table public.recurring_slots enable row level security;
alter table public.bookings enable row level security;
alter table public.credits enable row level security;
alter table public.waitlist_entries enable row level security;
alter table public.closures enable row level security;
