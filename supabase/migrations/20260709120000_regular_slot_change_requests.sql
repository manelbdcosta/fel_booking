create type public.regular_slot_change_request_status as enum (
  'pending',
  'approved',
  'declined',
  'cancelled'
);

create table public.regular_slot_change_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  requested_weekday smallint not null check (requested_weekday between 1 and 5),
  requested_start_time time not null check (
    requested_start_time in ('06:30', '07:00', '07:30', '08:00', '08:30')
  ),
  effective_from date not null,
  note text,
  status public.regular_slot_change_request_status not null default 'pending',
  reviewed_by uuid references public.members(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status in ('pending', 'cancelled') and reviewed_at is null)
    or (status in ('approved', 'declined') and reviewed_at is not null)
  )
);

create index regular_slot_change_requests_member_lookup
  on public.regular_slot_change_requests (member_id, status, effective_from);

create index regular_slot_change_requests_pending_lookup
  on public.regular_slot_change_requests (status, created_at)
  where status = 'pending';

create trigger regular_slot_change_requests_set_updated_at
  before update on public.regular_slot_change_requests
  for each row execute function public.set_updated_at();

alter table public.regular_slot_change_requests enable row level security;

comment on table public.regular_slot_change_requests is
  'Member-submitted requests for coach-managed recurring slot changes. Members do not update recurring_slots directly.';
