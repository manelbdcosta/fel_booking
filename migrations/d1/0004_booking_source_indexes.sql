alter table bookings add column source_recurring_slot_id text;

create index if not exists bookings_member_schedule_lookup
  on bookings (member_id, session_date, status);

create index if not exists bookings_source_recurring_slot_lookup
  on bookings (source_recurring_slot_id, session_date, status);

create index if not exists credits_member_status_lookup
  on credits (member_id, status, expires_on);
