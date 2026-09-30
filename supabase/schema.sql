-- Dev Task Sheet — run once in the Supabase SQL editor.

-- One row per team member. Created by the trigger below whenever an account is
-- added (scripts/create-users.mjs), so there is no sign-up path in the app.
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  name        text not null,
  email       text not null unique,
  sort_order  int  not null default 0,
  active      boolean not null default true
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, sort_order)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'sort_order')::int, 0)
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

do $$ begin
  create type public.task_status as enum ('not_started', 'in_progress', 'paused', 'completed');
exception when duplicate_object then null; end $$;

-- A task belongs to one day, like a row in that day's sheet. Unfinished tasks are
-- copied onto the next day (see ensure_day), so every day keeps its own history.
create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  work_date     date not null,
  dev_id        uuid not null references public.profiles(id) on delete cascade,
  priority      int  not null default 1,
  ticket_id     text,
  client_name   text,
  description   text,
  status        public.task_status not null default 'not_started',
  started_at    timestamptz,
  ended_at      timestamptz,
  notes         text,
  carried_from  uuid references public.tasks(id) on delete set null,
  origin_date   date not null,   -- the day this task was first added
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.profiles(id) on delete set null
);

create index if not exists tasks_work_date_idx on public.tasks (work_date);
create index if not exists tasks_ticket_idx on public.tasks (ticket_id);

create or replace function public.touch_task()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'INSERT' and new.origin_date is null then
    new.origin_date := new.work_date;
  end if;
  return new;
end $$;

drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch
  before insert or update on public.tasks
  for each row execute function public.touch_task();

-- Days that have already received yesterday's unfinished work.
create table if not exists public.days (
  work_date   date primary key,
  carried_at  timestamptz not null default now()
);

-- ensure_day (opening a day) is defined in the admin section below, after daily tasks.

-- Everyone on the team can see and edit the whole sheet, same as the Google Sheet.
alter table public.profiles enable row level security;
alter table public.tasks    enable row level security;
alter table public.days     enable row level security;

drop policy if exists "team reads profiles" on public.profiles;
create policy "team reads profiles" on public.profiles
  for select to authenticated using (true);

drop policy if exists "team edits tasks" on public.tasks;
create policy "team edits tasks" on public.tasks
  for all to authenticated using (true) with check (true);

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Live updates when two people have the sheet open.
do $$ begin
  alter publication supabase_realtime add table public.tasks;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Admins: manage the team and set up daily tasks. Accounts are created through
-- these admin-only functions, so the app never needs the service-role key.
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false)
$$;

create or replace function public.require_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Only admins can do this' using errcode = '42501';
  end if;
end $$;

-- Admins edit names, order, admin flag and active flag straight from the app.
drop policy if exists "admins edit profiles" on public.profiles;
create policy "admins edit profiles" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.admin_create_user(p_name text, p_email text, p_password text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := gen_random_uuid();
  next_order int;
begin
  perform require_admin();
  p_email := lower(trim(p_email));
  if coalesce(trim(p_name), '') = '' then raise exception 'Name is required'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'Password must be at least 6 characters'; end if;
  if exists (select 1 from auth.users where email = p_email) then
    raise exception 'An account with % already exists', p_email;
  end if;

  select coalesce(max(sort_order), 0) + 1 into next_order from profiles;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', p_email,
          crypt(p_password, gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}',
          jsonb_build_object('name', trim(p_name), 'sort_order', next_order),
          now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, 'email',
          jsonb_build_object('sub', uid::text, 'email', p_email, 'email_verified', true),
          now(), now(), now());

  return uid;  -- handle_new_user adds the profile
end $$;

create or replace function public.admin_update_user(p_user uuid, p_name text, p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  p_email := lower(trim(p_email));
  if coalesce(trim(p_name), '') = '' then raise exception 'Name is required'; end if;
  if exists (select 1 from auth.users where email = p_email and id <> p_user) then
    raise exception 'An account with % already exists', p_email;
  end if;

  update profiles set name = trim(p_name), email = p_email where id = p_user;
  update auth.users
     set email = p_email,
         raw_user_meta_data = raw_user_meta_data || jsonb_build_object('name', trim(p_name)),
         updated_at = now()
   where id = p_user;
  update auth.identities
     set identity_data = identity_data || jsonb_build_object('email', p_email), updated_at = now()
   where user_id = p_user and provider = 'email';
end $$;

create or replace function public.admin_set_password(p_user uuid, p_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform require_admin();
  if length(coalesce(p_password, '')) < 6 then raise exception 'Password must be at least 6 characters'; end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now()
   where id = p_user;
end $$;

-- Deactivating also blocks sign-in; their past tasks stay in the history.
create or replace function public.admin_set_active(p_user uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  if p_user = auth.uid() and not p_active then raise exception 'You can''t deactivate yourself'; end if;
  update profiles set active = p_active where id = p_user;
  -- A far-future date, not 'infinity': Supabase Auth can't read an infinite timestamp.
  update auth.users set banned_until = case when p_active then null else now() + interval '100 years' end
   where id = p_user;
end $$;

-- ---------------------------------------------------------------------------
-- Daily tasks: added to the chosen devs' sheets on the chosen weekdays.
-- ---------------------------------------------------------------------------

create table if not exists public.recurring_tasks (
  id           uuid primary key default gen_random_uuid(),
  ticket_id    text,
  client_name  text,
  description  text not null,
  priority     int  not null default 1,
  dev_ids      uuid[] not null default '{}',
  weekdays     int[]  not null default '{0,1,2,3,4}',  -- 0 = Sunday; Sun–Thu is the work week
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   uuid references public.profiles(id) on delete set null default auth.uid()
);

alter table public.recurring_tasks enable row level security;

drop policy if exists "team reads recurring tasks" on public.recurring_tasks;
create policy "team reads recurring tasks" on public.recurring_tasks
  for select to authenticated using (true);

drop policy if exists "admins manage recurring tasks" on public.recurring_tasks;
create policy "admins manage recurring tasks" on public.recurring_tasks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.tasks
  add column if not exists recurring_id uuid references public.recurring_tasks(id) on delete set null;

-- Adds the day's daily tasks (or just one of them). Skips any a dev already has
-- that day, so it's safe to run again.
create or replace function public.add_recurring(d date, only_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into tasks (work_date, dev_id, priority, ticket_id, client_name, description, origin_date, recurring_id)
  select d, dev.id, r.priority, r.ticket_id, r.client_name, r.description, d, r.id
  from recurring_tasks r
  join profiles dev on dev.id = any(r.dev_ids) and dev.active
  where r.active
    and extract(dow from d)::int = any(r.weekdays)
    and (only_id is null or r.id = only_id)
    and not exists (
      select 1 from tasks t where t.work_date = d and t.dev_id = dev.id and t.recurring_id = r.id
    );
end $$;

-- After an admin saves a daily task, put it on today's sheet too (Dhaka date).
create or replace function public.admin_apply_recurring(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  perform add_recurring((now() at time zone 'Asia/Dhaka')::date, p_id);
end $$;

-- Opens a day: the first time anyone loads it, copy every unfinished task from the
-- most recent earlier day onto it, then add the day's daily tasks. Safe to call
-- repeatedly and concurrently — only the call that inserts the `days` row does it.
-- Daily tasks don't carry over: each day gets a fresh one instead.
create or replace function public.ensure_day(d date)
returns void language plpgsql security definer set search_path = public as $$
declare
  prev date;
begin
  insert into days (work_date) values (d) on conflict do nothing;
  if not found then
    return;
  end if;

  select max(work_date) into prev from tasks where work_date < d;
  if prev is not null then
    insert into tasks (work_date, dev_id, priority, ticket_id, client_name, description,
                       status, started_at, ended_at, notes, carried_from, origin_date)
    select d, t.dev_id, t.priority, t.ticket_id, t.client_name, t.description,
           t.status, t.started_at, t.ended_at, t.notes, t.id, t.origin_date
    from tasks t
    where t.work_date = prev
      and t.status <> 'completed'
      and t.recurring_id is null;
  end if;

  perform add_recurring(d);
end $$;

revoke all on function public.require_admin() from public, anon, authenticated;
revoke all on function public.add_recurring(date, uuid) from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'admin_create_user(text, text, text)', 'admin_update_user(uuid, text, text)',
    'admin_set_password(uuid, text)', 'admin_set_active(uuid, boolean)', 'admin_apply_recurring(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

revoke all on function public.ensure_day(date) from public, anon;
grant execute on function public.ensure_day(date) to authenticated;

-- Make the first admin (change the email):
-- update public.profiles set is_admin = true where email = 'you@example.com';
