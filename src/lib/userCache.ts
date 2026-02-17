import { supabase } from './supabase';

// Module-level cache persists across re-renders and hook instances
const nameCache = new Map<string, string>();

export async function resolveDisplayName(userId: string): Promise<string> {
  if (nameCache.has(userId)) return nameCache.get(userId)!;
  const { data } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', userId)
    .single();
  const name = data?.display_name || 'User';
  nameCache.set(userId, name);
  return name;
}
