/**
 * focus.ts — ETAPA 71 A3/B4: lentila „test mâine" (user_focus).
 * Focus temporar pe concepte — citit de hartă, azi și daily până la expirare.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ActiveFocus {
  concept_ids: string[];
  label: string | null;
  expires_at: string;
}

export async function getActiveFocus(
  service: SupabaseClient,
  userId: string
): Promise<ActiveFocus | null> {
  const { data, error } = await service
    .from('user_focus')
    .select('concept_ids, label, expires_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[focus] read failed:', error.message);
    return null;
  }
  if (!data) return null;
  if (new Date(data.expires_at as string).getTime() < Date.now()) return null; // expirat
  const ids = (data.concept_ids as string[]) ?? [];
  if (ids.length === 0) return null;
  return { concept_ids: ids, label: (data.label as string | null) ?? null, expires_at: data.expires_at as string };
}
