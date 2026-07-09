alter table regular_slot_change_requests add column abandoned_weekday integer
  check (abandoned_weekday between 1 and 5);

alter table regular_slot_change_requests add column abandoned_start_time text
  check (
    abandoned_start_time in ('06:30', '07:00', '07:30', '08:00', '08:30')
  );

update regular_slot_change_requests
set
  abandoned_weekday = 1,
  abandoned_start_time = '06:30'
where id = 'regular-request-1' and abandoned_weekday is null;
