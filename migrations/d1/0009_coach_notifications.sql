create table if not exists coach_notifications (
  id text primary key,
  kind text not null check (
    kind in (
      'booking-created',
      'booking-cancelled',
      'waitlist-joined',
      'waitlist-left',
      'slot-closed',
      'regular-slot-change-requested'
    )
  ),
  member_id text references members(id) on delete set null,
  member_name text not null default '',
  session_date text,
  start_time text,
  regular_slot_request_id text references regular_slot_change_requests(id) on delete set null,
  title text not null,
  body text not null,
  read_at text,
  created_at text not null default (datetime('now'))
);

create index if not exists coach_notifications_created_lookup
  on coach_notifications (created_at desc);

create index if not exists coach_notifications_unread_lookup
  on coach_notifications (read_at, created_at desc);
