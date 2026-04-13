import { createClient } from '@supabase/supabase-js';
import { requirePublicEnv } from './env';

const supabaseUrl = requirePublicEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = requirePublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function checkAdminRole(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return false;
  }

  return data.role === 'admin';
}

export async function getAdminSession() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  const isAdmin = await checkAdminRole(session.user.id);

  if (!isAdmin) {
    return null;
  }

  return session;
}
