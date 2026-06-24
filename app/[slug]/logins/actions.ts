'use server'

import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import type { ActionResult, TenantLogin } from '../types'

export async function addStaffLogin(
  tenantId: string,
  label: string,
  password: string
): Promise<ActionResult<TenantLogin>> {
  const trimmedLabel = label.trim()
  if (!trimmedLabel) return { success: false, error: 'Please enter a name for this login.' }
  if (!password || password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' }
  }

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('paid_logins')
    .eq('id', tenantId)
    .single()

  const paidLogins = tenant?.paid_logins ?? 1

  const { count } = await supabaseAdmin
    .from('tenant_logins')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  if (count !== null && count >= paidLogins) {
    return {
      success: false,
      error: `You've used all ${paidLogins} of your paid logins. Buy an extra login below to add another.`,
    }
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const { data, error } = await supabaseAdmin
    .from('tenant_logins')
    .insert({ tenant_id: tenantId, label: trimmedLabel, password_hash: passwordHash })
    .select('id, label, is_active, created_at')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, data: data as TenantLogin }
}

export type ExtraLoginState = {
  status: 'idle' | 'error' | 'redirecting'
  url?: string
  error?: string
}

type ExtraPlanKey = 'extra_monthly' | 'extra_3month' | 'extra_6month' | 'extra_yearly'

// Same total_count pattern as the base plan: effectively "renews until cancelled."
const EXTRA_PLAN_CONFIG: Record<ExtraPlanKey, { planId: string; totalCount: number }> = {
  extra_monthly: { planId: 'plan_T4nKjaOIqh8Tql', totalCount: 360 },
  extra_3month: { planId: 'plan_T4nLa3ep5u4Eoc', totalCount: 120 },
  extra_6month: { planId: 'plan_T4nLxZmhm0SbUp', totalCount: 60 },
  extra_yearly: { planId: 'plan_T4nMQOqdUoTpNC', totalCount: 30 },
}

export async function startExtraLoginSubscription(
  _prev: ExtraLoginState,
  formData: FormData
): Promise<ExtraLoginState> {
  const tenantId = formData.get('tenantId') as string
  const slug = formData.get('slug') as string
  const planKey = formData.get('planKey') as ExtraPlanKey

  const config = EXTRA_PLAN_CONFIG[planKey]
  if (!tenantId || !slug || !config) return { status: 'error', error: 'Invalid plan selected.' }

  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .select('id, email, phone')
    .eq('id', tenantId)
    .single()

  if (tenantError || !tenant) return { status: 'error', error: 'Account not found.' }

  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    return { status: 'error', error: 'Payments are not configured yet. Please contact JBSS.' }
  }

  const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64')
  const phoneDigits = ((tenant.phone as string) || '').replace(/\D/g, '').slice(-10)

  let res: Response
  try {
    res = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({
        plan_id: config.planId,
        total_count: config.totalCount,
        quantity: 1,
        customer_notify: 1,
        // "kind: extra_login" lets the webhook tell this apart from a base-plan payment.
        notes: { tenant_id: tenant.id, tenant_slug: slug, plan_key: planKey, kind: 'extra_login' },
        notify_info: {
          ...(phoneDigits ? { notify_phone: phoneDigits } : {}),
          ...(tenant.email ? { notify_email: tenant.email as string } : {}),
        },
      }),
    })
  } catch {
    return { status: 'error', error: 'Could not reach the payment gateway. Please try again.' }
  }

  const data = await res.json()

  if (!res.ok || !data?.id || !data?.short_url) {
    return {
      status: 'error',
      error: data?.error?.description || 'Could not start payment. Please try again.',
    }
  }

  // Record this as a pending extra-login purchase, separate from the tenant's main
  // subscription, so the webhook (updated next) knows to add a seat — not touch billing.
  const { error: insertError } = await supabaseAdmin
    .from('extra_login_subscriptions')
    .insert({ tenant_id: tenant.id, razorpay_subscription_id: data.id, status: 'pending' })

  if (insertError) {
    return {
      status: 'error',
      error:
        'Something went wrong saving your order. Please contact JBSS support before trying again — do not complete payment yet.',
    }
  }

  return { status: 'redirecting', url: data.short_url }
}
