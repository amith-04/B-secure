import type { AppState, Membership, Organization, Role, User, WorkspaceData } from '../types';
import { supabase } from '../utils/supabase';

type DatabaseRole = 'admin' | 'manager' | 'creator';

const fromDatabaseRole = (role: DatabaseRole): Role =>
  role[0].toUpperCase() + role.slice(1) as Role;

const toDatabaseRole = (role: Exclude<Role, 'Admin'>): DatabaseRole => role.toLowerCase() as DatabaseRole;

const client = () => {
  if (!supabase) throw new Error('Supabase is not configured. Check frontend/.env.local and restart the app.');
  return supabase;
};

const workspaceFor = (organizationId: string): WorkspaceData => ({
  organizationId,
  rules: [],
  drafts: [],
  reviews: [],
  analysisHistory: [],
  truthShiftEnabled: false,
});

export async function loadRealAppState(): Promise<AppState | null> {
  const db = client();
  const { data: { user }, error: userError } = await db.auth.getUser();
  if (userError) throw userError;
  if (!user) return null;

  const { data: membershipRows, error: membershipError } = await db
    .from('organization_members')
    .select('organization_id, role, joined_at');
  if (membershipError) throw membershipError;

  const membershipIds = membershipRows.map((row) => row.organization_id);
  const { data: organizationRows, error: organizationError } = membershipIds.length
    ? await db.from('organizations').select('id, name, description, created_at').in('id', membershipIds)
    : { data: [], error: null };
  if (organizationError) throw organizationError;

  const profile: User = {
    id: user.id,
    name: String(user.user_metadata?.name || user.email?.split('@')[0] || 'B-Secure user'),
    email: user.email || '',
  };
  const organizations: Organization[] = (organizationRows || []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description || '',
    createdAt: row.created_at,
  }));
  const memberships: Membership[] = membershipRows.map((row) => ({
    id: `${row.organization_id}:${user.id}`,
    organizationId: row.organization_id,
    userId: user.id,
    role: fromDatabaseRole(row.role as DatabaseRole),
    status: 'Active',
    joinedAt: row.joined_at,
  }));

  return {
    users: [profile],
    organizations,
    memberships,
    workspaces: organizations.map((organization) => workspaceFor(organization.id)),
    currentUserId: user.id,
    selectedOrganizationId: null,
    isDemo: false,
  };
}

export async function signUp(name: string, email: string, password: string) {
  const { data, error } = await client().auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { error } = await client().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await client().auth.signOut();
  if (error) throw error;
}

export async function sendPasswordReset(email: string) {
  const { error } = await client().auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/`,
  });
  if (error) throw error;
}

export async function createRealOrganization(name: string, description: string) {
  const { data, error } = await client().rpc('create_organization', {
    org_name: name,
    org_description: description,
  });
  if (error) throw error;
  return data as string;
}

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

export async function createInvitation(organizationId: string, email: string, role: Exclude<Role, 'Admin'>) {
  const token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
  const { data: expiresAt, error } = await client().rpc('create_organization_invitation', {
    target_org: organizationId,
    invite_email: email,
    invite_role: toDatabaseRole(role),
    token_digest: await sha256(token),
  });
  if (error) throw error;
  return { token, expiresAt: expiresAt as string };
}

export async function acceptInvitation(token: string) {
  const { data: organizationId, error } = await client().rpc('accept_organization_invitation', {
    invite_token_hash: await sha256(token.trim()),
  });
  if (error) throw error;
  return organizationId as string;
}
