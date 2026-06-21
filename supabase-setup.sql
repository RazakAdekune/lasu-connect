-- Run this in Supabase SQL Editor before using the app with cloud sync.

create table if not exists public.app_state (
  id text primary key,
  issues jsonb not null default '[]'::jsonb,
  timetable jsonb not null default '[]'::jsonb,
  announcements jsonb not null default '[]'::jsonb,
  location_overrides jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_app_state_updated_at on public.app_state;
create trigger trg_app_state_updated_at
before update on public.app_state
for each row
execute function public.touch_updated_at();

insert into public.app_state (id)
values ('global')
on conflict (id) do nothing;

alter table public.app_state enable row level security;

drop policy if exists app_state_select_policy on public.app_state;
create policy app_state_select_policy
on public.app_state
for select
to anon, authenticated
using (id = 'global');

drop policy if exists app_state_insert_policy on public.app_state;
create policy app_state_insert_policy
on public.app_state
for insert
to anon, authenticated
with check (id = 'global');

drop policy if exists app_state_update_policy on public.app_state;
create policy app_state_update_policy
on public.app_state
for update
to anon, authenticated
using (id = 'global')
with check (id = 'global');
