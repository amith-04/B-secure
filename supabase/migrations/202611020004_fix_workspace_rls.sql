drop policy if exists "Org members can view profiles" on public.organization_profiles;
create policy "Org members can view profiles" on public.organization_profiles for select to authenticated
using (exists (
  select 1 from public.organization_members mine
  join public.organization_members theirs on theirs.organization_id = mine.organization_id
  where mine.user_id = (select auth.uid())
    and theirs.user_id = organization_profiles.user_id
));

drop policy if exists "Members view permitted drafts" on public.content_drafts;
create policy "Members view permitted drafts" on public.content_drafts for select to authenticated
using (
  public.is_org_member(content_drafts.organization_id)
  and (
    content_drafts.author_id = (select auth.uid())
    or public.is_org_admin(content_drafts.organization_id)
    or exists (
      select 1 from public.organization_members m
      where m.organization_id = content_drafts.organization_id
        and m.user_id = (select auth.uid())
        and m.role = 'manager'
    )
  )
);

drop policy if exists "Creators manage own drafts" on public.content_drafts;
create policy "Creators manage own drafts" on public.content_drafts for insert to authenticated
with check (
  public.is_org_member(content_drafts.organization_id)
  and content_drafts.author_id = (select auth.uid())
  and exists (
    select 1 from public.organization_members m
    where m.organization_id = content_drafts.organization_id
      and m.user_id = (select auth.uid())
      and m.role = 'creator'
  )
);
