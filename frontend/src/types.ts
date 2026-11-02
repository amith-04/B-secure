export type Role='Admin'|'Manager'|'Creator';
export type MemberStatus='Active'|'Invited';
export type Screen='welcome'|'login'|'register'|'forgot'|'demo'|'organizations'|'create-organization'|'join-organization'|'workspace';
export type WorkspacePage='Dashboard'|'Content Analysis'|'Drafts'|'Review Management'|'Brand Guidelines'|'TruthShift'|'Team Members'|'Organization Settings';
export interface User{id:string;name:string;email:string;mockPassword?:string;profileImage?:string}
export interface Organization{id:string;name:string;description:string;createdAt:string}
export interface Membership{id:string;userId:string;organizationId:string;role:Role;status:MemberStatus;joinedAt:string}
export interface Draft{id:string;title:string;content:string;status:'Draft'|'In Review'|'Approved'|'Changes Requested';authorId:string;updatedAt:string;findings:string[];feedback?:string}
export interface Rule{id:string;name:string;description:string;severity:'Low'|'Medium'|'High';active:boolean}
export interface Review{id:string;draftId:string;decision:'Approved'|'Changes Requested';reviewerId:string;feedback:string;createdAt:string}
export interface WorkspaceData{organizationId:string;rules:Rule[];drafts:Draft[];reviews:Review[];analysisHistory:string[];truthShiftEnabled:boolean}
export interface AppState{users:User[];organizations:Organization[];memberships:Membership[];workspaces:WorkspaceData[];currentUserId:string|null;selectedOrganizationId:string|null;isDemo:boolean}
