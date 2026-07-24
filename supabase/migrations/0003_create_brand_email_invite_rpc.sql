-- Atomically create a shared brand and an email-bound invitation.
begin;

create or replace function public.create_brand_email_invite(
  p_client_brand_id text,
  p_brand_name text,
  p_email text,
  p_role text default 'commenter'
)
returns table (shared_brand_id uuid, token text)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_owner_id uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_role text := case
    when p_role in ('editor', 'viewer', 'commenter') then p_role
    else 'commenter'
  end;
  v_shared_brand_id uuid;
  v_token text;
  v_invite_id uuid;
begin
  if v_owner_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(p_client_brand_id, '')), '') is null then
    raise exception 'Brand id is required' using errcode = '22023';
  end if;
  if v_email = '' or position('@' in v_email) < 2 then
    raise exception 'A valid email is required' using errcode = '22023';
  end if;

  insert into public.shared_brands (owner_id, client_brand_id, name)
  values (v_owner_id, p_client_brand_id, coalesce(nullif(trim(p_brand_name), ''), 'Brand'))
  on conflict (owner_id, client_brand_id)
  do update set name = excluded.name
  returning id into v_shared_brand_id;

  select i.id, i.token into v_invite_id, v_token
    from public.brand_invites i
   where i.shared_brand_id = v_shared_brand_id
     and lower(trim(coalesce(i.email, ''))) = v_email
     and i.status = 'pending'
   order by i.id limit 1 for update;

  if v_invite_id is not null then
    update public.brand_invites set role = v_role, email = v_email
     where id = v_invite_id;
  else
    v_token := md5(v_owner_id::text || v_email || clock_timestamp()::text || random()::text);
    insert into public.brand_invites (shared_brand_id, token, email, role, invited_by)
    values (v_shared_brand_id, v_token, v_email, v_role, v_owner_id);
  end if;

  return query select v_shared_brand_id, v_token;
end;
$$;

revoke all on function public.create_brand_email_invite(text, text, text, text) from public;
grant execute on function public.create_brand_email_invite(text, text, text, text) to authenticated;
notify pgrst, 'reload schema';
commit;
