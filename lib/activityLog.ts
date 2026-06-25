// Shared helper for writing entries to the activity_log table.
// Best-effort: a logging failure should never block the actual user action
// (forgot password, login, etc.) from completing.

import { supabaseAdmin } from './supabase'

export type ActivityEventType =
  | 'forgot_password_requested'
  | 'password_reset_completed'

export async function logActivity(
  tenantId: string,
  eventType: ActivityEventType,
  detail?: string
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('activity_log').insert({
      tenant_id: tenantId,
      event_type: eventType,
      detail: detail ?? null,
    })
    if (error) console.error(`Activity log insert failed (${eventType}):`, error.message)
  } catch (err) {
    console.error(`Activity log insert threw (${eventType}):`, err)
  }
}
