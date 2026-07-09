insert into public.members
  (id, first_name, last_name, phone, email, weekly_quota, role, status)
values
  ('00000000-0000-4000-8000-000000000001', 'Ben', '', '+447900000001', 'manu+coach-ben@intentionalsets.com', 1, 'coach', 'active'),
  ('00000000-0000-4000-8000-000000000002', 'Manu', '', '+447900000002', 'manu+coach-manu@intentionalsets.com', 1, 'coach', 'active'),
  ('00000000-0000-4000-8000-000000000003', 'Ennor', '', '+447900000003', 'manu+coach-ennor@intentionalsets.com', 1, 'coach', 'active'),
  ('00000000-0000-4000-8000-000000000004', 'Mel', '', '+447900000004', 'manu+coach-mel@intentionalsets.com', 1, 'coach', 'active'),
  ('00000000-0000-4000-8000-000000000101', 'Maddie', 'Cannon', '+447900000101', 'manu+maddie@intentionalsets.com', 2, 'member', 'active'),
  ('00000000-0000-4000-8000-000000000102', 'Emma', 'Richierich', '+447900000102', 'manu+emma@intentionalsets.com', 2, 'member', 'active'),
  ('00000000-0000-4000-8000-000000000103', 'Gemma', 'Partridge', '+447900000103', 'manu+gemma@intentionalsets.com', 3, 'member', 'active')
on conflict (email) do nothing;

insert into public.recurring_slots
  (member_id, weekday, start_time, effective_from)
values
  ('00000000-0000-4000-8000-000000000101', 1, '06:30', current_date),
  ('00000000-0000-4000-8000-000000000101', 4, '07:00', current_date),
  ('00000000-0000-4000-8000-000000000102', 2, '08:00', current_date),
  ('00000000-0000-4000-8000-000000000102', 5, '07:00', current_date),
  ('00000000-0000-4000-8000-000000000103', 1, '07:30', current_date),
  ('00000000-0000-4000-8000-000000000103', 3, '06:30', current_date),
  ('00000000-0000-4000-8000-000000000103', 5, '08:00', current_date);

insert into public.regular_slot_change_requests
  (member_id, requested_weekday, requested_start_time, effective_from, note)
values
  (
    '00000000-0000-4000-8000-000000000101',
    2,
    '07:30',
    (current_date + interval '7 days')::date,
    'Works better with school drop-off this month.'
  );

with next_days as (
  select generate_series(current_date, current_date + interval '13 days', interval '1 day')::date as session_date
)
insert into public.bookings
  (member_id, session_date, start_time, status, kind)
select
  recurring_slots.member_id,
  next_days.session_date,
  recurring_slots.start_time,
  'booked',
  'regular'
from public.recurring_slots
join next_days
  on extract(isodow from next_days.session_date)::smallint = recurring_slots.weekday
where next_days.session_date >= recurring_slots.effective_from
  and (recurring_slots.effective_until is null or next_days.session_date <= recurring_slots.effective_until)
on conflict do nothing;
