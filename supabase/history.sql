-- Sosa — server-side version history for sosa_data.
-- Keeps the PREVIOUS version of every row on each update, so a bad write can
-- always be rolled back even if the browser/localStorage is gone.
-- Additive only: does not alter sosa_data itself.

create table if not exists public.sosa_data_history (
  id          bigserial primary key,
  user_id     uuid        not null,
  key         text        not null,
  data        jsonb       not null,
  archived_at timestamptz not null default now()
);

create index if not exists sosa_data_history_lookup
  on public.sosa_data_history (user_id, key, archived_at desc);

alter table public.sosa_data_history enable row level security;

-- Users may only ever READ their own history. Writes come from the trigger,
-- which runs as SECURITY DEFINER — no client can insert/update/delete here.
drop policy if exists "read own history" on public.sosa_data_history;
create policy "read own history"
  on public.sosa_data_history for select
  using (auth.uid() = user_id);

-- Archive the OLD row before it is overwritten, then prune to the newest 20
-- versions per (user_id, key) so history can never grow without bound.
create or replace function public.archive_sosa_data()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  last_archived timestamptz;
begin
  if old.data is distinct from new.data then
    select max(archived_at) into last_archived
      from public.sosa_data_history
     where user_id = old.user_id and key = old.key;

    -- Throttle to at most one archived version per 10 minutes per (user,key).
    -- Saves are debounced to ~1s, so without this a single editing burst would
    -- flush the whole history window and leave only seconds of coverage.
    if last_archived is null or last_archived < now() - interval '10 minutes' then
      insert into public.sosa_data_history (user_id, key, data)
      values (old.user_id, old.key, old.data);

      delete from public.sosa_data_history h
      where h.user_id = old.user_id
        and h.key = old.key
        and h.id not in (
          select id from public.sosa_data_history
          where user_id = old.user_id and key = old.key
          order by archived_at desc
          limit 20
        );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sosa_data_archive on public.sosa_data;
create trigger sosa_data_archive
  before update on public.sosa_data
  for each row execute function public.archive_sosa_data();
