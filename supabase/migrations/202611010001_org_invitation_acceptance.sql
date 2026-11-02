-- Invite acceptance is performed through this RPC so the invite token never
-- grants direct table access. Store only a SHA-256 token hash in the table.
create or replace function public.accept_organization_invitation(invite_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.organization_invitations%rowtype;
  account_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select lower(u.email) into account_email
  from auth.users u where u.id = auth.uid();

  select * into invitation
  from public.organization_invitations i
  where i.token_hash = invite_token_hash
  for update;

  if not found or invitation.accepted_at is not null or invitation.expires_at <= now() then
    raise exception 'Invitation is invalid, expired, or already accepted';
  end if;
  if lower(invitation.email) <> account_email then
    raise exception 'Sign in with the email address that received this invitation';
  end if;
  if exists (
    select 1 from public.organization_members m
    where m.organization_id = invitation.organization_id and m.user_id = auth.uid()
  ) then
    raise exception 'You are already a member of this organization';
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (invitation.organization_id, auth.uid(), invitation.role);

  update public.organization_invitations
  set accepted_at = now()
  where id = invitation.id;

  return invitation.organization_id;
end;
$$;

revoke all on function public.accept_organization_invitation(text) from public;
grant execute on function public.accept_organization_invitation(text) to authenticated;
