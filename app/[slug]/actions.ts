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
