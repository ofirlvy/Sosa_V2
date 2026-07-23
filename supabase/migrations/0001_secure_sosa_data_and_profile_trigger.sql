-- Migration 0001: per-user isolation + RLS for sosa_data, and auto-profile creation
-- Context: sosa_data was a global key/value store with RLS disabled (security hole,
-- no multi-user separation). profiles/brands already had correct per-user RLS.

begin;

-- 1. Add ownership column to sosa_data
alter table public.sosa_data
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 2. Backfill the single existing row to its real owner (contact@rezzle.co)
update public.sosa_data
  set user_id = '4af175c0-5550-41b2-9bf1-350760cf63a9'
  where user_id is null;

-- 3. Require ownership + make the key unique per-user (composite PK)
alter table public.sosa_data alter column user_id set not null;
alter table public.sosa_data drop constraint sosa_data_pkey;
alter table public.sosa_data add primary key (user_id, key);

-- 4. Enable RLS + a single owner-only policy covering all operations
alter table public.sosa_data enable row level security;
drop policy if exists "Users manage own data" on public.sosa_data;
create policy "Users manage own data" on public.sosa_data
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 5. Auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

commit;
