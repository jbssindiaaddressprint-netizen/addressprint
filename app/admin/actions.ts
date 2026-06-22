'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { ADMIN_SESSION_COOKIE } from '@/lib/admin-session'

async function assertAdmin() {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  const expected = process.env.ADMIN_SESSION_TOKEN
  if (!cookie || !expected || cookie !== expected) {
    throw new Error('Not authorized')
  }
}

export async function setTenantActive(tenantId: string, isActive: boolean) {
  await assertAdmin()
  const { error } = await supabaseAdmin
    .from('tenants')
    .update({ is_active: isActive })
    .eq('id', tenantId)

  if (error) return { success: false as const, error: error.message }
  revalidatePath('/admin')
  return { success: true as const }
}

export async function updateTenantCaps(
  tenantId: string,
  customerLimit: number,
  paidLogins: number
) {
  await assertAdmin()

  if (!Number.isFinite(customerLimit) || customerLimit < 0) {
    return { success: false as const, error: 'Customer limit must be a valid number.' }
  }
  if (!Number.isFinite(paidLogins) || paidLogins < 1) {
    return { success: false as const, error: 'Paid logins must be at least 1.' }
  }

  const { error } = await supabaseAdmin
    .from('tenants')
    .update({ customer_limit: customerLimit, paid_logins: paidLogins })
    .eq('id', tenantId)

  if (error) return { success: false as const, error: error.message }
  revalidatePath('/admin')
  return { success: true as const }
}
