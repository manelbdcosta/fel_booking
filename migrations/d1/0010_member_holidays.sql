create table if not exists member_holidays (
  id text primary key,
  member_id text not null references members(id) on delete cascade,
  starts_on text not null,
  ends_on text not null,
  cancelled_booking_count integer not null default 0 check (cancelled_booking_count >= 0),
  credit_count integer not null default 0 check (credit_count >= 0),
  created_at text not null default (datetime('now')),
  check (ends_on >= starts_on)
);

create index if not exists member_holidays_member_range_lookup
  on member_holidays (member_id, starts_on, ends_on);
