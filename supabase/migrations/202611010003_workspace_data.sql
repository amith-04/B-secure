create table if not exists public.organization_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  updated_at timestamptz not null default now()
);

create or replace function public.sync_organization_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.organization_profiles(user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (user_id) do update set display_name = excluded.display_name, updated_at = now();
  return new;
end; $$;

drop trigger if exists on_auth_user_profile_created on auth.users;
create trigger on_auth_user_profile_created after insert or update of raw_user_meta_data on auth.users
for each row execute function public.sync_organization_profile();

insert into public.organization_profiles(user_id, display_name)
select id, coalesce(raw_user_meta_data->>'name', split_part(email, '@', 1)) from auth.users
on conflict (user_id) do nothing;

create table if not exists public.organization_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text not null default '',
  severity text not null default 'Medium' check (severity in ('Low','Medium','High')),
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.content_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id),
  title text not null default 'Untitled draft' check (char_length(title) <= 160),
  content text not null check (char_length(content) <= 5000),
  status text not null default 'Draft' check (status in ('Draft','In Review','Approved','Changes Requested')),
  findings jsonb not null default '[]'::jsonb,
  feedback text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.draft_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  draft_id uuid not null references public.content_drafts(id) on delete cascade,
  reviewer_id uuid not null default auth.uid() references auth.users(id),
  decision text not null check (decision in ('Approved','Changes Requested')),
  feedback text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  truthshift_enabled boolean not null default false,
  ai_model text not null default 'llama-3.3-70b-versatile',
  updated_at timestamptz not null default now()
);

alter table public.organization_profiles enable row level security;
alter table public.organization_rules enable row level security;
alter table public.content_drafts enable row level security;
alter table public.draft_reviews enable row level security;
alter table public.organization_settings enable row level security;

drop policy if exists "Org members can view profiles" on public.organization_profiles;
create policy "Org members can view profiles" on public.organization_profiles for select to authenticated
using (exists (select 1 from public.organization_members mine join public.organization_members theirs
  on theirs.organization_id=mine.organization_id where mine.user_id=(select auth.uid()) and theirs.user_id=organization_profiles.user_id));

drop policy if exists "Members view organization rules" on public.organization_rules;
create policy "Members view organization rules" on public.organization_rules for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists "Admins manage organization rules" on public.organization_rules;
create policy "Admins manage organization rules" on public.organization_rules for all to authenticated using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

drop policy if exists "Members view permitted drafts" on public.content_drafts;
create policy "Members view permitted drafts" on public.content_drafts for select to authenticated
using (public.is_org_member(content_drafts.organization_id) and (author_id=(select auth.uid()) or public.is_org_admin(content_drafts.organization_id) or exists (
  select 1 from public.organization_members m where m.organization_id=content_drafts.organization_id and m.user_id=(select auth.uid()) and m.role='manager')));
drop policy if exists "Creators manage own drafts" on public.content_drafts;
create policy "Creators manage own drafts" on public.content_drafts for insert to authenticated
with check (public.is_org_member(organization_id) and author_id=auth.uid());
drop policy if exists "Authors update drafts" on public.content_drafts;
create policy "Authors update drafts" on public.content_drafts for update to authenticated
using (author_id=auth.uid() and status in ('Draft','Changes Requested'))
with check (author_id=auth.uid() and status in ('Draft','Changes Requested','In Review'));
drop policy if exists "Managers decide drafts" on public.content_drafts;
create policy "Managers decide drafts" on public.content_drafts for update to authenticated
using (public.is_org_admin(content_drafts.organization_id) or exists (select 1 from public.organization_members m where m.organization_id=content_drafts.organization_id and m.user_id=(select auth.uid()) and m.role='manager'))
with check (public.is_org_admin(content_drafts.organization_id) or exists (select 1 from public.organization_members m where m.organization_id=content_drafts.organization_id and m.user_id=(select auth.uid()) and m.role='manager'));

drop policy if exists "Members view reviews" on public.draft_reviews;
create policy "Members view reviews" on public.draft_reviews for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists "Managers add reviews" on public.draft_reviews;
create policy "Managers add reviews" on public.draft_reviews for insert to authenticated
with check (reviewer_id=auth.uid() and (public.is_org_admin(organization_id) or exists (
  select 1 from public.organization_members m where m.organization_id=organization_id and m.user_id=auth.uid() and m.role='manager')));

drop policy if exists "Members view organization settings" on public.organization_settings;
create policy "Members view organization settings" on public.organization_settings for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists "Admins manage organization settings" on public.organization_settings;
create policy "Admins manage organization settings" on public.organization_settings for all to authenticated using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

grant select on public.organization_profiles to authenticated;
grant select, insert, update, delete on public.organization_rules to authenticated;
grant select, insert, update on public.content_drafts to authenticated;
grant select, insert on public.draft_reviews to authenticated;
grant select, insert, update, delete on public.organization_settings to authenticated;

insert into public.organization_settings(organization_id)
select id from public.organizations on conflict do nothing;
