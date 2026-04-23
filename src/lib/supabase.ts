import { createClient } from '@supabase/supabase-js';
import { requirePublicEnv } from './env';

const supabaseUrl = requirePublicEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = requirePublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type AdminCheckResult = {
  isAdmin: boolean;
  role: string | null;
  reason: 'ok' | 'profile_not_found' | 'db_error' | 'not_admin';
  details?: string;
};

export async function checkAdminAccess(userId: string): Promise<AdminCheckResult> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    return {
      isAdmin: false,
      role: null,
      reason: 'db_error',
      details: error.message,
    };
  }

  if (!data) {
    return {
      isAdmin: false,
      role: null,
      reason: 'profile_not_found',
    };
  }

  const role = String(data.role ?? '').trim().toLowerCase();
  if (role === 'admin') {
    return {
      isAdmin: true,
      role,
      reason: 'ok',
    };
  }

  return {
    isAdmin: false,
    role: role || null,
    reason: 'not_admin',
  };
}

export async function checkAdminRole(userId: string): Promise<boolean> {
  const result = await checkAdminAccess(userId);
  return result.isAdmin;
}

export async function getAdminSession() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  const adminCheck = await checkAdminAccess(session.user.id);

  if (!adminCheck.isAdmin) {
    return null;
  }

  return session;
}
