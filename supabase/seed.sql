insert into public.members
  (id, first_name, last_name, phone, email, weekly_quota, role, status)
values
  ('00000000-0000-4000-8000-000000000001', 'Fit East', 'Coach', '+447900000001', 'manu+coach@intentionalsets.com', 3, 'coach', 'active'),
  ('00000000-0000-4000-8000-000000000101', 'Amira', 'Khan', '+447900000101', 'manu+amira@intentionalsets.com', 2, 'member', 'active'),
  ('00000000-0000-4000-8000-000000000102', 'Ben', 'Taylor', '+447900000102', 'manu+ben@intentionalsets.com', 1, 'member', 'active'),
  ('00000000-0000-4000-8000-000000000103', 'Cara', 'Morgan', '+447900000103', 'manu+cara@intentionalsets.com', 3, 'member', 'active'),
  ('00000000-0000-4000-8000-000000000104', 'Dev', 'Patel', '+447900000104', 'manu+dev@intentionalsets.com', 2, 'member', 'active'),
  ('00000000-0000-4000-8000-000000000105', 'Ella', 'Reed', '+447900000105', 'manu+ella@intentionalsets.com', 1, 'member', 'active'),
  ('00000000-0000-4000-8000-000000000106', 'Finn', 'Osei', '+447900000106', 'manu+finn@intentionalsets.com', 2, 'member', 'active'),
  ('00000000-0000-4000-8000-000000000107', 'Gia', 'Lewis', '+447900000107', 'manu+gia@intentionalsets.com', 3, 'member', 'active'),
  ('00000000-0000-4000-8000-000000000108', 'Hugo', 'Wright', '+447900000108', 'manu+hugo@intentionalsets.com', 1, 'member', 'pending'),
  ('00000000-0000-4000-8000-000000000109', 'Iris', 'Stone', '+447900000109', 'manu+iris@intentionalsets.com', 2, 'member', 'active'),
  ('00000000-0000-4000-8000-000000000110', 'Jonah', 'Bell', '+447900000110', 'manu+jonah@intentionalsets.com', 1, 'member', 'active')
on conflict (email) do nothing;

insert into public.recurring_slots
  (member_id, weekday, start_time, effective_from)
values
  ('00000000-0000-4000-8000-000000000101', 1, '06:30', current_date),
  ('00000000-0000-4000-8000-000000000101', 4, '07:00', current_date),
  ('00000000-0000-4000-8000-000000000102', 2, '08:00', current_date),
  ('00000000-0000-4000-8000-000000000103', 1, '07:30', current_date),
  ('00000000-0000-4000-8000-000000000103', 3, '07:30', current_date),
  ('00000000-0000-4000-8000-000000000103', 5, '08:30', current_date),
  ('00000000-0000-4000-8000-000000000104', 2, '07:00', current_date),
  ('00000000-0000-4000-8000-000000000104', 4, '08:00', current_date),
  ('00000000-0000-4000-8000-000000000105', 5, '06:30', current_date),
  ('00000000-0000-4000-8000-000000000106', 1, '08:00', current_date),
  ('00000000-0000-4000-8000-000000000106', 3, '06:30', current_date),
  ('00000000-0000-4000-8000-000000000107', 2, '06:30', current_date),
  ('00000000-0000-4000-8000-000000000107', 3, '08:30', current_date),
  ('00000000-0000-4000-8000-000000000107', 5, '07:00', current_date),
  ('00000000-0000-4000-8000-000000000109', 1, '08:30', current_date),
  ('00000000-0000-4000-8000-000000000109', 4, '06:30', current_date),
  ('00000000-0000-4000-8000-000000000110', 5, '08:00', current_date);

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
