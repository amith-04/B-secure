create or replace function public.create_organization(org_name text, org_description text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(trim(org_name)) < 2 or char_length(trim(org_name)) > 100 then
    raise exception 'Organization name must be 2 to 100 characters';
  end if;
  insert into public.organizations(name, description, created_by)
  values (trim(org_name), coalesce(org_description, ''), auth.uid()) returning id into new_id;
  insert into public.organization_members(organization_id, user_id, role)
  values (new_id, auth.uid(), 'admin');
  return new_id;
end; $$;
revoke all on function public.create_organization(text,text) from public;
grant execute on function public.create_organization(text,text) to authenticated;

create or replace function public.create_organization_invitation(
  target_org uuid, invite_email text, invite_role public.org_role, token_digest text
) returns timestamptz language plpgsql security definer set search_path = '' as $$
declare expiration timestamptz := now() + interval '7 days';
begin
  if auth.uid() is null or not public.is_org_admin(target_org) then
    raise exception 'Only organization admins can invite members';
  end if;
  if invite_role = 'admin' then raise exception 'Admin invitations are not allowed'; end if;
  if exists (select 1 from public.organization_members m join auth.users u on u.id=m.user_id
      where m.organization_id=target_org and lower(u.email)=lower(trim(invite_email))) then
    raise exception 'This person is already a member';
  end if;
  insert into public.organization_invitations(organization_id,email,role,token_hash,invited_by,expires_at)
  values(target_org,lower(trim(invite_email)),invite_role,token_digest,auth.uid(),expiration);
  return expiration;
end; $$;
revoke all on function public.create_organization_invitation(uuid,text,public.org_role,text) from public;
grant execute on function public.create_organization_invitation(uuid,text,public.org_role,text) to authenticated;
