import type { Draft, Membership, Role, Rule, User, WorkspaceData } from '../types';
import { supabase } from '../utils/supabase';

const db = () => { if (!supabase) throw new Error('Supabase is not configured.'); return supabase; };
type Member = { userId: string; name: string; email: string; role: Role; joinedAt: string };
type WorkspaceSnapshot = { workspace: WorkspaceData; members: Member[] };

export async function loadWorkspace(organizationId: string): Promise<WorkspaceSnapshot> {
  const api = db();
  const [settings, rules, drafts, reviews, members] = await Promise.all([
    api.from('organization_settings').select('truthshift_enabled').eq('organization_id', organizationId).maybeSingle(),
    api.from('organization_rules').select('id,name,description,severity,active').eq('organization_id', organizationId).order('created_at'),
    api.from('content_drafts').select('id,title,content,status,author_id,updated_at,findings,feedback').eq('organization_id', organizationId).order('updated_at', { ascending: false }),
    api.from('draft_reviews').select('id,draft_id,decision,reviewer_id,feedback,created_at').eq('organization_id', organizationId).order('created_at', { ascending: false }),
    api.from('organization_members').select('organization_id,user_id,role,joined_at').eq('organization_id', organizationId),
  ]);
  for (const result of [settings, rules, drafts, reviews, members]) if (result.error) throw result.error;
  const memberRows = members.data || [];
  const ids = memberRows.map((member) => member.user_id);
  const profileResult = ids.length ? await api.from('organization_profiles').select('user_id,display_name').in('user_id', ids) : { data: [], error: null };
  if (profileResult.error) throw profileResult.error;
  const current = await api.auth.getUser();
  if (current.error) throw current.error;
  const profileNames = new Map((profileResult.data || []).map((profile) => [profile.user_id, profile.display_name]));
  const mappedMembers: Member[] = memberRows.map((member) => ({
    userId: member.user_id,
    name: profileNames.get(member.user_id) || 'Team member',
    email: member.user_id === current.data.user?.id ? current.data.user.email || '' : '',
    role: (member.role[0].toUpperCase() + member.role.slice(1)) as Role,
    joinedAt: member.joined_at,
  }));
  const mappedDrafts: Draft[] = (drafts.data || []).map((draft) => ({
    id: draft.id, title: draft.title, content: draft.content, status: draft.status,
    authorId: draft.author_id, updatedAt: draft.updated_at, findings: draft.findings || [], feedback: draft.feedback || undefined,
  }));
  const workspace: WorkspaceData = {
    organizationId,
    rules: (rules.data || []) as Rule[],
    drafts: mappedDrafts,
    reviews: (reviews.data || []).map((review) => ({ id: review.id, draftId: review.draft_id, decision: review.decision, reviewerId: review.reviewer_id, feedback: review.feedback, createdAt: review.created_at })),
    analysisHistory: [],
    truthShiftEnabled: settings.data?.truthshift_enabled || false,
  };
  return { workspace, members: mappedMembers };
}

export async function saveRule(organizationId: string, name: string, description: string, severity: Rule['severity']) {
  const { error } = await db().from('organization_rules').insert({ organization_id: organizationId, name, description, severity });
  if (error) throw error;
}
export async function deleteRule(id: string) { const { error } = await db().from('organization_rules').delete().eq('id', id); if (error) throw error; }
export async function saveDraft(organizationId: string, title: string, content: string, findings: string[]) {
  const { data: { user }, error: authError } = await db().auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Log in again to save your draft.');
  const { error } = await db().from('content_drafts').insert({ organization_id: organizationId, author_id: user.id, title, content, findings });
  if (error) throw error;
}
export async function submitDraft(id: string) { const { error } = await db().from('content_drafts').update({ status: 'In Review', updated_at: new Date().toISOString() }).eq('id', id); if (error) throw error; }
export async function reviewDraft(organizationId: string, draftId: string, decision: 'Approved' | 'Changes Requested', feedback: string) {
  const api = db();
  const { data: { user }, error: authError } = await api.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Log in again to review this draft.');
  const update = await api.from('content_drafts').update({ status: decision, feedback, updated_at: new Date().toISOString() }).eq('id', draftId);
  if (update.error) throw update.error;
  const insert = await api.from('draft_reviews').insert({ organization_id: organizationId, draft_id: draftId, reviewer_id: user.id, decision, feedback });
  if (insert.error) throw insert.error;
}
export async function setTruthShift(organizationId: string, enabled: boolean) {
  const { error } = await db().from('organization_settings').upsert({ organization_id: organizationId, truthshift_enabled: enabled, updated_at: new Date().toISOString() });
  if (error) throw error;
}
