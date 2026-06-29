-- ============================================================================
-- LASU Connect — complete Supabase setup
-- Run this ONCE in the Supabase SQL Editor (paste the whole file, click Run).
-- Safe to re-run: every statement uses "if not exists" / "or replace".
-- ============================================================================

-- pgcrypto gives us bcrypt password hashing (crypt + gen_salt).
create extension if not exists pgcrypto;


-- ----------------------------------------------------------------------------
-- 1) SHARED APP STATE  (reports, timetable, announcements, location pins)
--    Stored as a single row with id = 'global', synced by every device.
-- ----------------------------------------------------------------------------
create table if not exists public.app_state (
  id text primary key,
  issues jsonb not null default '[]'::jsonb,
  timetable jsonb not null default '[]'::jsonb,
  announcements jsonb not null default '[]'::jsonb,
  location_overrides jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Keep updated_at fresh on every write.
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

-- Seed the single shared row.
insert into public.app_state (id)
values ('global')
on conflict (id) do nothing;

-- The browser uses the public anon key, so allow it to read/write ONLY the
-- single 'global' row (it can never touch anything else).
alter table public.app_state enable row level security;

drop policy if exists app_state_select_policy on public.app_state;
create policy app_state_select_policy
on public.app_state for select
to anon, authenticated
using (id = 'global');

drop policy if exists app_state_insert_policy on public.app_state;
create policy app_state_insert_policy
on public.app_state for insert
to anon, authenticated
with check (id = 'global');

drop policy if exists app_state_update_policy on public.app_state;
create policy app_state_update_policy
on public.app_state for update
to anon, authenticated
using (id = 'global')
with check (id = 'global');


-- ----------------------------------------------------------------------------
-- 2) STUDENT ACCOUNTS  (signup / login by matric number + password)
--    The table is locked down (RLS on, no policies) so the browser can NEVER
--    read it directly. All access goes through the two SECURITY DEFINER
--    functions below, which hash passwords with bcrypt inside the database.
-- ----------------------------------------------------------------------------
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  matric text not null,
  matric_key text not null,
  name text not null default '',
  faculty text not null default '',
  department text not null default '',
  level text not null default '',
  semester text not null default '',
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- One account per matric number (normalized: lowercase, no whitespace).
create unique index if not exists students_matric_key_idx
  on public.students (matric_key);

alter table public.students enable row level security;
revoke all on public.students from anon, authenticated;

-- Normalize a matric number for lookups / uniqueness.
create or replace function public.lasu_norm_matric(p text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(coalesce(p, '')), '\s+', '', 'g');
$$;

-- Create a new student account. Returns { ok, student } or { ok:false, error }.
create or replace function public.register_student(
  p_matric text,
  p_name text,
  p_faculty text,
  p_department text,
  p_level text,
  p_semester text,
  p_password text
) returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key text := public.lasu_norm_matric(p_matric);
  v_row public.students;
begin
  if coalesce(btrim(p_matric), '') = '' then
    return json_build_object('ok', false, 'error', 'matric_required');
  end if;
  if coalesce(p_password, '') = '' or length(p_password) < 6 then
    return json_build_object('ok', false, 'error', 'weak_password');
  end if;
  if exists (select 1 from public.students where matric_key = v_key) then
    return json_build_object('ok', false, 'error', 'matric_taken');
  end if;

  insert into public.students
    (matric, matric_key, name, faculty, department, level, semester, password_hash)
  values
    (btrim(p_matric), v_key, coalesce(p_name, ''), coalesce(p_faculty, ''),
     coalesce(p_department, ''), coalesce(p_level, ''), coalesce(p_semester, ''),
     crypt(p_password, gen_salt('bf')))
  returning * into v_row;

  return json_build_object('ok', true, 'student', json_build_object(
    'id', v_row.id, 'name', v_row.name, 'matric', v_row.matric,
    'faculty', v_row.faculty, 'department', v_row.department,
    'level', v_row.level, 'semester', v_row.semester
  ));
end;
$$;

-- Verify a login. Returns { ok, student } or { ok:false, error }.
create or replace function public.verify_student(
  p_matric text,
  p_password text
) returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key text := public.lasu_norm_matric(p_matric);
  v_row public.students;
begin
  select * into v_row from public.students where matric_key = v_key;
  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_row.password_hash <> crypt(coalesce(p_password, ''), v_row.password_hash) then
    return json_build_object('ok', false, 'error', 'wrong_password');
  end if;

  return json_build_object('ok', true, 'student', json_build_object(
    'id', v_row.id, 'name', v_row.name, 'matric', v_row.matric,
    'faculty', v_row.faculty, 'department', v_row.department,
    'level', v_row.level, 'semester', v_row.semester
  ));
end;
$$;

-- Let the browser call only these two functions (not the table directly).
revoke all on function public.register_student(text, text, text, text, text, text, text) from public;
revoke all on function public.verify_student(text, text) from public;
grant execute on function public.register_student(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.verify_student(text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3) ADMIN ACCOUNTS  (same per-department logins, now stored in the database)
--    Locked-down table; login goes through verify_admin (bcrypt) only.
--    Keyed by (username + faculty + department) because a department name like
--    "Biochemistry" exists under more than one faculty.
-- ----------------------------------------------------------------------------
create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  username_key text not null,
  faculty text not null default '',
  department text not null default '',
  name text not null default '',
  password_hash text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists admins_identity_idx
  on public.admins (username_key, faculty, department);

alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

-- Verify an admin login. Returns { ok, admin } or { ok:false, error }.
create or replace function public.verify_admin(
  p_username text,
  p_password text,
  p_faculty text,
  p_department text
) returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key text := lower(btrim(coalesce(p_username, '')));
  v_row public.admins;
begin
  select * into v_row
  from public.admins
  where username_key = v_key
    and faculty = coalesce(p_faculty, '')
    and department = coalesce(p_department, '');
  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_row.password_hash <> crypt(coalesce(p_password, ''), v_row.password_hash) then
    return json_build_object('ok', false, 'error', 'wrong_password');
  end if;
  return json_build_object('ok', true, 'admin', json_build_object(
    'username', v_row.username, 'name', v_row.name,
    'faculty', v_row.faculty, 'department', v_row.department
  ));
end;
$$;

revoke all on function public.verify_admin(text, text, text, text) from public;
grant execute on function public.verify_admin(text, text, text, text) to anon, authenticated;

-- Seed the per-department admin accounts (matches the app's built-in logins).
-- Default password for each is "lasu-<department-slug>" — change these later if
-- you want, e.g.:  update public.admins set password_hash = crypt('NewPass', gen_salt('bf')) where username_key = 'admin-computer-science';
insert into public.admins (username, username_key, faculty, department, name, password_hash)
values
  ('admin-nursing', 'admin-nursing', 'Allied Health Sciences', 'Nursing', 'Nursing Admin', crypt('lasu-nursing', gen_salt('bf'))),
  ('admin-physiotherapy', 'admin-physiotherapy', 'Allied Health Sciences', 'Physiotherapy', 'Physiotherapy Admin', crypt('lasu-physiotherapy', gen_salt('bf'))),
  ('admin-medical-laboratory-science', 'admin-medical-laboratory-science', 'Allied Health Sciences', 'Medical Laboratory Science', 'Medical Laboratory Science Admin', crypt('lasu-medical-laboratory-science', gen_salt('bf'))),
  ('admin-radiography-and-radiation-sc', 'admin-radiography-and-radiation-sc', 'Allied Health Sciences', 'Radiography and Radiation Science', 'Radiography and Radiation Science Admin', crypt('lasu-radiography-and-radiation-sc', gen_salt('bf'))),
  ('admin-english-language', 'admin-english-language', 'Arts', 'English Language', 'English Language Admin', crypt('lasu-english-language', gen_salt('bf'))),
  ('admin-history-and-international-st', 'admin-history-and-international-st', 'Arts', 'History and International Studies', 'History and International Studies Admin', crypt('lasu-history-and-international-st', gen_salt('bf'))),
  ('admin-philosophy', 'admin-philosophy', 'Arts', 'Philosophy', 'Philosophy Admin', crypt('lasu-philosophy', gen_salt('bf'))),
  ('admin-religious-studies', 'admin-religious-studies', 'Arts', 'Religious Studies', 'Religious Studies Admin', crypt('lasu-religious-studies', gen_salt('bf'))),
  ('admin-linguistics-african-and-asia', 'admin-linguistics-african-and-asia', 'Arts', 'Linguistics, African and Asian Studies', 'Linguistics, African and Asian Studies Admin', crypt('lasu-linguistics-african-and-asia', gen_salt('bf'))),
  ('admin-music', 'admin-music', 'Arts', 'Music', 'Music Admin', crypt('lasu-music', gen_salt('bf'))),
  ('admin-theatre-arts', 'admin-theatre-arts', 'Arts', 'Theatre Arts', 'Theatre Arts Admin', crypt('lasu-theatre-arts', gen_salt('bf'))),
  ('admin-anatomy', 'admin-anatomy', 'Basic Medical Sciences', 'Anatomy', 'Anatomy Admin', crypt('lasu-anatomy', gen_salt('bf'))),
  ('admin-physiology', 'admin-physiology', 'Basic Medical Sciences', 'Physiology', 'Physiology Admin', crypt('lasu-physiology', gen_salt('bf'))),
  ('admin-biochemistry', 'admin-biochemistry', 'Basic Medical Sciences', 'Biochemistry', 'Biochemistry Admin', crypt('lasu-biochemistry', gen_salt('bf'))),
  ('admin-medicine-and-surgery', 'admin-medicine-and-surgery', 'Clinical Sciences', 'Medicine and Surgery', 'Medicine and Surgery Admin', crypt('lasu-medicine-and-surgery', gen_salt('bf'))),
  ('admin-computer-science', 'admin-computer-science', 'Computing and Information Technology', 'Computer Science', 'Computer Science Admin', crypt('lasu-computer-science', gen_salt('bf'))),
  ('admin-information-and-communicatio', 'admin-information-and-communicatio', 'Computing and Information Technology', 'Information and Communication Technology', 'Information and Communication Technology Admin', crypt('lasu-information-and-communicatio', gen_salt('bf'))),
  ('admin-dentistry', 'admin-dentistry', 'Dentistry', 'Dentistry', 'Dentistry Admin', crypt('lasu-dentistry', gen_salt('bf'))),
  ('admin-educational-management', 'admin-educational-management', 'Education', 'Educational Management', 'Educational Management Admin', crypt('lasu-educational-management', gen_salt('bf'))),
  ('admin-educational-technology', 'admin-educational-technology', 'Education', 'Educational Technology', 'Educational Technology Admin', crypt('lasu-educational-technology', gen_salt('bf'))),
  ('admin-guidance-and-counselling', 'admin-guidance-and-counselling', 'Education', 'Guidance and Counselling', 'Guidance and Counselling Admin', crypt('lasu-guidance-and-counselling', gen_salt('bf'))),
  ('admin-human-kinetics-sports-and-he', 'admin-human-kinetics-sports-and-he', 'Education', 'Human Kinetics, Sports and Health Education', 'Human Kinetics, Sports and Health Education Admin', crypt('lasu-human-kinetics-sports-and-he', gen_salt('bf'))),
  ('admin-science-and-technology-educa', 'admin-science-and-technology-educa', 'Education', 'Science and Technology Education', 'Science and Technology Education Admin', crypt('lasu-science-and-technology-educa', gen_salt('bf'))),
  ('admin-arts-and-social-science-educ', 'admin-arts-and-social-science-educ', 'Education', 'Arts and Social Science Education', 'Arts and Social Science Education Admin', crypt('lasu-arts-and-social-science-educ', gen_salt('bf'))),
  ('admin-language-arts-and-social-stu', 'admin-language-arts-and-social-stu', 'Education', 'Language Arts and Social Studies Education', 'Language Arts and Social Studies Education Admin', crypt('lasu-language-arts-and-social-stu', gen_salt('bf'))),
  ('admin-chemical-and-polymer-enginee', 'admin-chemical-and-polymer-enginee', 'Engineering', 'Chemical and Polymer Engineering', 'Chemical and Polymer Engineering Admin', crypt('lasu-chemical-and-polymer-enginee', gen_salt('bf'))),
  ('admin-electronics-and-computer-eng', 'admin-electronics-and-computer-eng', 'Engineering', 'Electronics and Computer Engineering', 'Electronics and Computer Engineering Admin', crypt('lasu-electronics-and-computer-eng', gen_salt('bf'))),
  ('admin-mechanical-engineering', 'admin-mechanical-engineering', 'Engineering', 'Mechanical Engineering', 'Mechanical Engineering Admin', crypt('lasu-mechanical-engineering', gen_salt('bf'))),
  ('admin-architecture', 'admin-architecture', 'Environmental Sciences', 'Architecture', 'Architecture Admin', crypt('lasu-architecture', gen_salt('bf'))),
  ('admin-building', 'admin-building', 'Environmental Sciences', 'Building', 'Building Admin', crypt('lasu-building', gen_salt('bf'))),
  ('admin-estate-management', 'admin-estate-management', 'Environmental Sciences', 'Estate Management', 'Estate Management Admin', crypt('lasu-estate-management', gen_salt('bf'))),
  ('admin-fine-arts', 'admin-fine-arts', 'Environmental Sciences', 'Fine Arts', 'Fine Arts Admin', crypt('lasu-fine-arts', gen_salt('bf'))),
  ('admin-urban-and-regional-planning', 'admin-urban-and-regional-planning', 'Environmental Sciences', 'Urban and Regional Planning', 'Urban and Regional Planning Admin', crypt('lasu-urban-and-regional-planning', gen_salt('bf'))),
  ('admin-private-and-property-law', 'admin-private-and-property-law', 'Law', 'Private and Property Law', 'Private and Property Law Admin', crypt('lasu-private-and-property-law', gen_salt('bf'))),
  ('admin-public-law', 'admin-public-law', 'Law', 'Public Law', 'Public Law Admin', crypt('lasu-public-law', gen_salt('bf'))),
  ('admin-commercial-and-industrial-la', 'admin-commercial-and-industrial-la', 'Law', 'Commercial and Industrial Law', 'Commercial and Industrial Law Admin', crypt('lasu-commercial-and-industrial-la', gen_salt('bf'))),
  ('admin-jurisprudence-and-internatio', 'admin-jurisprudence-and-internatio', 'Law', 'Jurisprudence and International Law', 'Jurisprudence and International Law Admin', crypt('lasu-jurisprudence-and-internatio', gen_salt('bf'))),
  ('admin-islamic-law', 'admin-islamic-law', 'Law', 'Islamic Law', 'Islamic Law Admin', crypt('lasu-islamic-law', gen_salt('bf'))),
  ('admin-accounting', 'admin-accounting', 'Management Sciences', 'Accounting', 'Accounting Admin', crypt('lasu-accounting', gen_salt('bf'))),
  ('admin-banking-and-finance', 'admin-banking-and-finance', 'Management Sciences', 'Banking and Finance', 'Banking and Finance Admin', crypt('lasu-banking-and-finance', gen_salt('bf'))),
  ('admin-business-administration', 'admin-business-administration', 'Management Sciences', 'Business Administration', 'Business Administration Admin', crypt('lasu-business-administration', gen_salt('bf'))),
  ('admin-insurance', 'admin-insurance', 'Management Sciences', 'Insurance', 'Insurance Admin', crypt('lasu-insurance', gen_salt('bf'))),
  ('admin-public-administration', 'admin-public-administration', 'Management Sciences', 'Public Administration', 'Public Administration Admin', crypt('lasu-public-administration', gen_salt('bf'))),
  ('admin-biochemistry', 'admin-biochemistry', 'Science', 'Biochemistry', 'Biochemistry Admin', crypt('lasu-biochemistry', gen_salt('bf'))),
  ('admin-botany', 'admin-botany', 'Science', 'Botany', 'Botany Admin', crypt('lasu-botany', gen_salt('bf'))),
  ('admin-chemistry', 'admin-chemistry', 'Science', 'Chemistry', 'Chemistry Admin', crypt('lasu-chemistry', gen_salt('bf'))),
  ('admin-fisheries', 'admin-fisheries', 'Science', 'Fisheries', 'Fisheries Admin', crypt('lasu-fisheries', gen_salt('bf'))),
  ('admin-mathematics', 'admin-mathematics', 'Science', 'Mathematics', 'Mathematics Admin', crypt('lasu-mathematics', gen_salt('bf'))),
  ('admin-microbiology', 'admin-microbiology', 'Science', 'Microbiology', 'Microbiology Admin', crypt('lasu-microbiology', gen_salt('bf'))),
  ('admin-physics', 'admin-physics', 'Science', 'Physics', 'Physics Admin', crypt('lasu-physics', gen_salt('bf'))),
  ('admin-science-laboratory-technolog', 'admin-science-laboratory-technolog', 'Science', 'Science Laboratory Technology', 'Science Laboratory Technology Admin', crypt('lasu-science-laboratory-technolog', gen_salt('bf'))),
  ('admin-zoology', 'admin-zoology', 'Science', 'Zoology', 'Zoology Admin', crypt('lasu-zoology', gen_salt('bf'))),
  ('admin-economics', 'admin-economics', 'Social Sciences', 'Economics', 'Economics Admin', crypt('lasu-economics', gen_salt('bf'))),
  ('admin-geography-and-planning', 'admin-geography-and-planning', 'Social Sciences', 'Geography and Planning', 'Geography and Planning Admin', crypt('lasu-geography-and-planning', gen_salt('bf'))),
  ('admin-political-science', 'admin-political-science', 'Social Sciences', 'Political Science', 'Political Science Admin', crypt('lasu-political-science', gen_salt('bf'))),
  ('admin-psychology', 'admin-psychology', 'Social Sciences', 'Psychology', 'Psychology Admin', crypt('lasu-psychology', gen_salt('bf'))),
  ('admin-sociology', 'admin-sociology', 'Social Sciences', 'Sociology', 'Sociology Admin', crypt('lasu-sociology', gen_salt('bf'))),
  ('admin-transport-management-and-ope', 'admin-transport-management-and-ope', 'Transport', 'Transport Management and Operations', 'Transport Management and Operations Admin', crypt('lasu-transport-management-and-ope', gen_salt('bf'))),
  ('admin-transport-planning-and-polic', 'admin-transport-planning-and-polic', 'Transport', 'Transport Planning and Policy', 'Transport Planning and Policy Admin', crypt('lasu-transport-planning-and-polic', gen_salt('bf'))),
  ('admin-transport-technology-and-inf', 'admin-transport-technology-and-inf', 'Transport', 'Transport Technology and Infrastructure', 'Transport Technology and Infrastructure Admin', crypt('lasu-transport-technology-and-inf', gen_salt('bf')))
on conflict (username_key, faculty, department) do nothing;


-- ============================================================================
-- Done. You should see "Success. No rows returned".
-- ============================================================================
