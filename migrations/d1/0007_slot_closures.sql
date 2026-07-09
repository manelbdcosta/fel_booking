create table if not exists slot_closures (
  id text primary key,
  session_date text not null,
  start_time text not null check (
    start_time in ('06:30', '07:00', '07:30', '08:00', '08:30')
  ),
  reason text,
  closed_by text references members(id) on delete set null,
  created_at text not null default (datetime('now')),
  unique (session_date, start_time)
);

create index if not exists slot_closures_lookup
  on slot_closures (session_date, start_time);
