import { supabase } from './supabase';

// ------------------------------------------------------------- Typen
export type Role = 'admin' | 'viewer';
export interface OrgRef { id: string; name: string; role: Role }
export interface Me { email: string; is_platform_admin: boolean; organizations: OrgRef[] }
export interface Question {
  id: string; text: string; labels: [string, string, string];
  active: boolean; archived: boolean; created_at: string; votes: number;
}
export interface Terminal {
  id: string; name: string; created_at: string;
  last_seen_at: string | null; last_vote_at: string | null; revoked: boolean;
}
export interface Member { user_id: string; email: string; role: Role; is_me: boolean }
export interface Invite { id: string; email: string; role: Role; created_at: string }
export interface StatRow {
  day: string; hour: number; terminal_id: string | null; question_id: string;
  neg: number; neu: number; pos: number;
}
export interface TerminalConfig {
  status: 'ok' | 'revoked';
  terminal?: { id: string; name: string };
  organization?: { id: string; name: string };
  question?: { id: string; text: string; labels: [string, string, string] } | null;
}

// ------------------------------------------------------------- Aufruf
export class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) { super(message); this.code = code; }
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new ApiError(translate(error.message, error.code), error.code);
  return data as T;
}

function translate(msg: string, code?: string): string {
  if (code === 'PGRST202') return 'Die Datenbankfunktion fehlt. Ist das Schema eingespielt?';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Keine Verbindung zum Server. Bitte Internet prüfen.';
  return msg;
}

// ------------------------------------------------------------- Verwaltung
export const api = {
  canLogin: (email: string) => rpc<boolean>('sb_can_login', { p_email: email }),
  me: () => rpc<Me>('sb_me'),
  orgCreate: (name: string) => rpc<string>('sb_org_create', { p_name: name }),
  orgRename: (org: string, name: string) => rpc<void>('sb_org_rename', { p_org: org, p_name: name }),

  questions: (org: string) => rpc<Question[]>('sb_questions', { p_org: org }),
  questionSave: (org: string, id: string | null, text: string, labels: string[]) =>
    rpc<string>('sb_question_save', { p_org: org, p_id: id, p_text: text, p_labels: labels }),
  questionActivate: (org: string, id: string) => rpc<void>('sb_question_activate', { p_org: org, p_id: id }),
  questionArchive: (org: string, id: string, archived: boolean) =>
    rpc<void>('sb_question_archive', { p_org: org, p_id: id, p_archived: archived }),

  terminals: (org: string) => rpc<Terminal[]>('sb_terminals', { p_org: org }),
  terminalClaim: (org: string, code: string, name: string) =>
    rpc<string>('sb_terminal_claim', { p_org: org, p_code: code, p_name: name }),
  terminalRename: (org: string, id: string, name: string) =>
    rpc<void>('sb_terminal_rename', { p_org: org, p_id: id, p_name: name }),
  terminalRevoke: (org: string, id: string) => rpc<void>('sb_terminal_revoke', { p_org: org, p_id: id }),

  members: (org: string) => rpc<{ members: Member[]; invites: Invite[] }>('sb_members', { p_org: org }),
  invite: (org: string, email: string, role: Role) => rpc<void>('sb_invite', { p_org: org, p_email: email, p_role: role }),
  inviteDelete: (org: string, id: string) => rpc<void>('sb_invite_delete', { p_org: org, p_id: id }),
  memberSetRole: (org: string, user: string, role: Role) =>
    rpc<void>('sb_member_set_role', { p_org: org, p_user: user, p_role: role }),
  memberRemove: (org: string, user: string) => rpc<void>('sb_member_remove', { p_org: org, p_user: user }),

  stats: (org: string, from: string, to: string) =>
    rpc<StatRow[]>('sb_stats', { p_org: org, p_from: from, p_to: to }),
};

// ------------------------------------------------------------- Terminal (ohne Konto)
export const terminalApi = {
  pairStart: () => rpc<{ code: string; secret: string; expires_at: string }>('sb_terminal_pair_start'),
  pairStatus: (secret: string) =>
    rpc<{ status: 'pending' | 'paired' | 'expired' | 'unknown' }>('sb_terminal_pair_status', { p_secret: secret }),
  config: (token: string) => rpc<TerminalConfig>('sb_terminal_config', { p_token: token }),
  vote: (token: string, question: string, value: number, at?: string) =>
    rpc<{ ok: boolean; reason?: string }>('sb_terminal_vote', {
      p_token: token, p_question: question, p_value: value, p_at: at ?? null,
    }),
};
