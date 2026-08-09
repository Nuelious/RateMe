import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://cjhnfirauwuxiuhcekwi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YXliQbmKByufrk8KcBMfqw_R1ahcT8D';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export function generateShareCode(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data?.user || null;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = 'index.html';
    return null;
  }
  return user;
}

// ---------- NEW: username / activity helpers ----------

export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function ensureUserProfile(userId, username) {
  const { data: existing } = await supabase
    .from('user_profiles')
    .select('id, username')
    .eq('id', userId)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('user_profiles')
    .insert({ id: userId, username: username || 'user_' + Math.random().toString(36).slice(2, 8) })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateActivity() {
  const user = await getCurrentUser();
  if (!user) return;
  await supabase
    .from('user_profiles')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', user.id);
}
