insert or ignore into members (
  id,
  first_name,
  last_name,
  email,
  phone,
  weekly_quota,
  role,
  status,
  attended_count,
  missed_count
) values
  ('coach-ben', 'Ben', 'Coach', 'manu+coach-ben@intentionalsets.com', null, 1, 'coach', 'active', 0, 0),
  ('coach-manu', 'Manu', 'Coach', 'manu@intentionalsets.com', null, 1, 'coach', 'active', 0, 0),
  ('coach-ennor', 'Ennor', 'Coach', 'manu+coach-ennor@intentionalsets.com', null, 1, 'coach', 'active', 0, 0),
  ('coach-mel', 'Mel', 'Coach', 'manu+coach-mel@intentionalsets.com', null, 1, 'coach', 'active', 0, 0),
  ('maddie', 'Maddie', 'Cannon', 'manu+maddie@intentionalsets.com', null, 2, 'member', 'active', 42, 1),
  ('emma', 'Emma', 'Richierich', 'manu+emma@intentionalsets.com', null, 2, 'member', 'active', 42, 1),
  ('gemma', 'Gemma', 'Partridge', 'manu+gemma@intentionalsets.com', null, 3, 'member', 'active', 42, 1);

insert or ignore into recurring_slots (
  id,
  member_id,
  weekday,
  start_time,
  effective_from
) values
  ('regular-1', 'maddie', 1, '06:30', '2026-07-06'),
  ('regular-2', 'maddie', 4, '07:00', '2026-07-06'),
  ('regular-emma-1', 'emma', 2, '08:00', '2026-07-06'),
  ('regular-emma-2', 'emma', 5, '07:00', '2026-07-06'),
  ('regular-gemma-1', 'gemma', 1, '07:30', '2026-07-06'),
  ('regular-gemma-2', 'gemma', 3, '06:30', '2026-07-06'),
  ('regular-gemma-3', 'gemma', 5, '08:00', '2026-07-06');

insert or ignore into regular_slot_change_requests (
  id,
  member_id,
  requested_weekday,
  requested_start_time,
  effective_from,
  note,
  status
) values (
  'regular-request-1',
  'maddie',
  2,
  '07:30',
  '2026-07-20',
  'Works better with school drop-off this month.',
  'pending'
);
