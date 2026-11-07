-- Run in Supabase > SQL Editor > New query > Run.
-- Booking times are Brussels local. Stored dates are calendar dates, times are minute offsets.
-- 1320 (22:00) represents the single "Later than 10pm" option.

create table if not exists public.bookings (
  booking_date date not null,
  slot_minutes integer not null,
  person_name text not null check (char_length(trim(person_name)) between 1 and 60),
  created_at timestamptz not null default now(),
  primary key (booking_date, slot_minutes),
  constraint valid_slot check (slot_minutes between 480 and 1320 and slot_minutes % 30 = 0)
);

alter table public.bookings enable row level security;

grant select, insert, update, delete on public.bookings to anon, authenticated;

-- This is a trusted-link calendar, not a truly private app. Anyone with the URL
-- and public key can interact with reservations. Enable Supabase Auth for real access control.
create policy "Read reservations" on public.bookings for select to anon, authenticated using (true);
create policy "Create reservations in two-week window" on public.bookings for insert to anon, authenticated
with check (
  booking_date >= (date_trunc('week', now() at time zone 'Europe/Brussels'))::date
  and booking_date < (date_trunc('week', now() at time zone 'Europe/Brussels'))::date + 14
);
create policy "Rename reservations" on public.bookings for update to anon, authenticated
using (booking_date >= (date_trunc('week', now() at time zone 'Europe/Brussels'))::date)
with check (booking_date >= (date_trunc('week', now() at time zone 'Europe/Brussels'))::date
  and booking_date < (date_trunc('week', now() at time zone 'Europe/Brussels'))::date + 14);
create policy "Delete reservations" on public.bookings for delete to anon, authenticated
using (booking_date >= (date_trunc('week', now() at time zone 'Europe/Brussels'))::date);

-- Realtime on this table. Only execute once; if it says already member, it's already enabled.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;
end $$;

-- Automatic cleanup every day at 03:10 UTC, discarding all weeks before this one.
-- Requires the pg_cron extension, available via Database > Extensions or Integrations > Cron.
create extension if not exists pg_cron;
select cron.schedule(
  'shared-calendar-expired-bookings',
  '10 3 * * *',
  $$ delete from public.bookings
     where booking_date < (date_trunc('week', now() at time zone 'Europe/Brussels'))::date $$
);
