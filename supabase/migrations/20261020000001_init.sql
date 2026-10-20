-- Inventory System — auth foundation
-- Run in Supabase: SQL Editor → New query → paste → Run. Safe to re-run.

-- ---------------------------------------------------------------------------
-- tbl_user — one row per account, filled from the signup form.
--
-- Passwords are NOT stored here. Supabase Auth keeps only a bcrypt hash in
-- auth.users.encrypted_password, which is not exposed through the API and is
-- never sent to the browser.
-- ---------------------------------------------------------------------------
create table if not exists public.tbl_user (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text not null,
  username      text not null,
  phone_number  text not null,
  email         text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists tbl_user_username_lower_idx on public.tbl_user (lower(username));
create unique index if not exists tbl_user_email_lower_idx on public.tbl_user (lower(email));

alter table public.tbl_user enable row level security;
revoke all on public.tbl_user from anon;

drop policy if exists "Users can view own row" on public.tbl_user;
create policy "Users can view own row"
  on public.tbl_user for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can update own row" on public.tbl_user;
create policy "Users can update own row"
  on public.tbl_user for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tbl_user_set_updated_at on public.tbl_user;
create trigger tbl_user_set_updated_at
  before update on public.tbl_user
  for each row execute function public.set_updated_at();

-- Create the tbl_user row automatically from signUp() metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tbl_user (id, full_name, username, phone_number, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill accounts created before this migration ran.
insert into public.tbl_user (id, full_name, username, phone_number, email)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  coalesce(u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1) || '_' || left(u.id::text, 4)),
  coalesce(u.raw_user_meta_data ->> 'phone', ''),
  u.email
from auth.users u
where u.email is not null
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Signup availability check (service role only)
-- email_status: 'none' | 'unconfirmed' | 'confirmed'
-- ---------------------------------------------------------------------------
create or replace function public.check_signup_availability(p_email text, p_username text)
returns table (email_status text, username_taken boolean)
language sql
security definer
set search_path = ''
as $$
  select
    coalesce(
      (select case when u.email_confirmed_at is null then 'unconfirmed' else 'confirmed' end
         from auth.users u
        where lower(u.email) = lower(p_email)
        limit 1),
      'none'
    ) as email_status,
    exists (
      select 1
        from public.tbl_user t
       where lower(t.username) = lower(p_username)
         and lower(t.email) <> lower(p_email)
    ) as username_taken;
$$;

revoke all on function public.check_signup_availability(text, text) from public, anon, authenticated;
grant execute on function public.check_signup_availability(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Login OTP challenges (second login step). Service role only — RLS on, no policies.
-- Stores only a SHA-256 hash of each code, never the code or any session token.
-- ---------------------------------------------------------------------------
create table if not exists public.login_challenges (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  email         text not null,
  code_hash     text not null,
  expires_at    timestamptz not null,
  attempts      integer not null default 0,
  last_sent_at  timestamptz not null default now(),
  consumed_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists login_challenges_user_id_idx on public.login_challenges (user_id);

alter table public.login_challenges enable row level security;
revoke all on public.login_challenges from anon, authenticated;
