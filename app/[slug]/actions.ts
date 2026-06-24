'use server'

import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { SESSION_COOKIE, decodeSession } from '@/lib/session'
import type { Customer, Transporter, ContactPerson, ActionResult } from './types'

type CustomerInput = {
  company_name: string
  address: string
  pin: string
  state: string
  country: string
  contacts: ContactPerson[]
}

type TransporterInput = {
  type: string
  name: string
  branch: string
  mode?: string | null
  freight?: string | null
  lr?: string | null
}

export async function addCustomer(
  tenantId: string,
  input: CustomerInput
): Promise<ActionResult<Customer>> {
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('customer_limit')
    .eq('id', tenantId)
    .single()

  const limit = tenant?.customer_limit ?? 1000

  const { count } = await supabaseAdmin
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  if (count !== null && count >= limit) {
    return {
      success: false,
      error: `You've reached your plan's limit of ${limit} customers. Contact JBSS support to add more.`,
    }
  }

  const { data, error } = await supabaseAdmin
    .from('customers')
    .insert({ tenant_id: tenantId, ...input })
    .select()
    .single()
  if (error) return { success: false, error: error.message }
  return { success: true, data: data as Customer }
}

export async function updateCustomer(
  id: string,
  input: CustomerInput
): Promise<ActionResult<Customer>> {
  const { data, error } = await supabaseAdmin
    .from('customers')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) return { success: false, error: error.message }
  return { success: true, data: data as Customer }
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  const { error } = await supabaseAdmin.from('customers').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}

export async function addTransporter(
  tenantId: string,
  input: TransporterInput
): Promise<ActionResult<Transporter>> {
  const { data, error } = await supabaseAdmin
    .from('transporters')
    .insert({ tenant_id: tenantId, ...input })
    .select()
    .single()
  if (error) return { success: false, error: error.message }
  return { success: true, data: data as Transporter }
}

export async function updateTransporter(
  id: string,
  input: TransporterInput
): Promise<ActionResult<Transporter>> {
  const { data, error } = await supabaseAdmin
    .from('transporters')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) return { success: false, error: error.message }
  return { success: true, data: data as Transporter }
}

export async function deleteTransporter(id: string): Promise<ActionResult> {
  const { error } = await supabaseAdmin.from('transporters').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}

export async function incrementPrintCount(
  tenantId: string
): Promise<ActionResult<{ prints_month: number; prints_lifetime: number }>> {
  const { data: t, error: re } = await supabaseAdmin
    .from('tenants')
    .select('prints_month, prints_lifetime')
    .eq('id', tenantId)
    .single()
  if (re) return { success: false, error: re.message }

  const newMonth = ((t?.prints_month as number | null) ?? 0) + 1
  const newLifetime = ((t?.prints_lifetime as number | null) ?? 0) + 1

  const { error: ue } = await supabaseAdmin
    .from('tenants')
    .update({ prints_month: newMonth, prints_lifetime: newLifetime })
    .eq('id', tenantId)
  if (ue) return { success: false, error: ue.message }

  return { success: true, data: { prints_month: newMonth, prints_lifetime: newLifetime } }
}

export async function updateExtraPhones(
  tenantId: string,
  phones: string[]
): Promise<ActionResult> {
  const { error } = await supabaseAdmin
    .from('tenants')
    .update({ extra_phones: phones.filter(Boolean) })
    .eq('id', tenantId)
  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}

export type CancelState = {
  status: 'idle' | 'error' | 'success'
  error?: string
}

export async function cancelSubscription(
  tenantId: string,
  mode: 'now' | 'period_end'
): Promise<CancelState> {
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .select('razorpay_subscription_id, subscription_status')
    .eq('id', tenantId)
    .single()

  if (tenantError || !tenant) return { status: 'error', error: 'Account not found.' }
  if (tenant.subscription_status !== 'active' || !tenant.razorpay_subscription_id) {
    return { status: 'error', error: 'There is no active subscription to cancel.' }
  }

  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    return { status: 'error', error: 'Payments are not configured yet. Please contact JBSS.' }
  }
  const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64')

  let res: Response
  try {
    res = await fetch(
      `https://api.razorpay.com/v1/subscriptions/${tenant.razorpay_subscription_id}/cancel`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ cancel_at_cycle_end: mode === 'period_end' ? 1 : 0 }),
      }
    )
  } catch {
    return { status: 'error', error: 'Could not reach the payment gateway. Please try again.' }
  }

  const data = await res.json()
  if (!res.ok) {
    return {
      status: 'error',
      error: data?.error?.description || 'Could not cancel subscription. Please try again.',
    }
  }

  // Razorpay's webhook will also confirm this asynchronously, but we update right away
  // here so the dashboard reflects the change instantly instead of waiting on a webhook.
  if (mode === 'now') {
    await supabaseAdmin
      .from('tenants')
      .update({ subscription_status: 'cancelled', cancel_at_period_end: false })
      .eq('id', tenantId)
  } else {
    await supabaseAdmin
      .from('tenants')
      .update({ cancel_at_period_end: true })
      .eq('id', tenantId)
  }

  return { status: 'success' }
}

export async function logout(): Promise<ActionResult> {
  const cookieStore = await cookies()
  const session = decodeSession(cookieStore.get(SESSION_COOKIE)?.value)

  if (session) {
    // Invalidate the ticket server-side too, not just on this browser.
    await supabaseAdmin
      .from('tenant_logins')
      .update({ session_token: null })
      .eq('id', session.loginId)
  }

  cookieStore.delete(SESSION_COOKIE)
  return { success: true, data: undefined }
}

// Used for periodic / on-click checks inside the dashboard (the dashboard never
// reloads the page when switching sections, so middleware alone can't catch a
// kicked-out session until the next hard refresh — this fills that gap).
export async function checkSessionValid(): Promise<boolean> {
  const cookieStore = await cookies()
  const session = decodeSession(cookieStore.get(SESSION_COOKIE)?.value)
  if (!session) return false

  const { data: login } = await supabaseAdmin
    .from('tenant_logins')
    .select('session_token, is_active, tenant_id')
    .eq('id', session.loginId)
    .single()

  if (!login) return false
  if (!login.is_active) return false
  if (login.tenant_id !== session.tenantId) return false
  if (login.session_token !== session.token) return false
  return true
}

// Clears the cookie WITHOUT touching the DB token — used when we've detected this
// session was kicked out by another login. The DB token now belongs to that other
// session, so we must not null it here.
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}
