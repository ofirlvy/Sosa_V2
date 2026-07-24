-- Automatically claim brand invitations by the authenticated user's email.
begin;

create or replace function public.claim_brand_invites_by_email()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_claimed integer := 0;
  v_invite record;
begin
  if v_user_id is null or v_email = '' then return 0; end if;

  for v_invite in
    select i.id, i.shared_brand_id, i.role
      from public.brand_invites i
      join public.shared_brands b on b.id = i.shared_brand_id
     where i.status = 'pending'
       and lower(trim(coalesce(i.email, ''))) = v_email
       and b.owner_id <> v_user_id
     for update of i
  loop
    update public.brand_members
       set email = v_email, role = v_invite.role, status = 'active'
     where shared_brand_id = v_invite.shared_brand_id and user_id = v_user_id;

    if not found then
      begin
        insert into public.brand_members (shared_brand_id, user_id, email, role, status)
        values (v_invite.shared_brand_id, v_user_id, v_email, v_invite.role, 'active');
      exception when unique_violation then
        update public.brand_members
           set email = v_email, role = v_invite.role, status = 'active'
         where shared_brand_id = v_invite.shared_brand_id and user_id = v_user_id;
      end;
    end if;

    update public.brand_invites set status = 'accepted' where id = v_invite.id;
    v_claimed := v_claimed + 1;
  end loop;
  return v_claimed;
end;
$$;

revoke all on function public.claim_brand_invites_by_email() from public;
grant execute on function public.claim_brand_invites_by_email() to authenticated;
notify pgrst, 'reload schema';
commit;
