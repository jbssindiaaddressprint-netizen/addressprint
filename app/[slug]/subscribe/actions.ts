'use server'

import { supabaseAdmin } from '@/lib/supabase'

export type SubscribeState = {
  status: 'idle' | 'error' | 'redirecting'
  url?: string
  error?: string
}

type PlanKey = 'base_monthly' | 'base_3month' | 'base_6month' | 'base_yearly'

// total_count = number of billing cycles. Capped at the ~30-year max Razorpay allows,
// which in practice means "renews automatically until cancelled."
const PLAN_CONFIG: Record<PlanKey, { planId: string; totalCount: number }> = {
  base_monthly: { planId: 'plan_T4nHHmca4SFj7Z', totalCount: 360 }, // every 1 month x 30yrs
  base_3month: { planId: 'plan_T4nI3ge2xPuBrH', totalCount: 120 }, // every 3 months x 30yrs
  base_6month: { planId: 'plan_T4nImKxQwgqrud', totalCount: 60 }, // every 6 months x 30yrs
  base_yearly: { planId: 'plan_T4nJMsz5cfB6VM', totalCount: 30 }, // every 1 year x 30yrs
}

// Coupon codes the tenant can type in, mapped to a Razorpay Offer ID created in the
// dashboard. TEST99 is a throwaway offer for safely testing real payments at ~₹1-5
// instead of full price — remove it once real coupons are needed.
const COUPON_CODES: Record<string, string> = {
  TEST99: 'offer_T59sWEOWpKkkB6',
}

export async function startSubscription(
  _prev: SubscribeState,
  formData: FormData
): Promise<SubscribeState> {
  const slug = formData.get('slug') as string
  const planKey = formData.get('planKey') as PlanKey

  const config = PLAN_CONFIG[planKey]
  if (!slug || !config) return { status: 'error', error: 'Invalid plan selected.' }

  const couponCodeRaw = (formData.get('couponCode') as string | null)?.trim().toUpperCase()
  let offerId: string | undefined
  if (couponCodeRaw) {
    const matchedOfferId = COUPON_CODES[couponCodeRaw]
    if (!matchedOfferId) {
      return { status: 'error', error: `"${couponCodeRaw}" is not a valid coupon code.` }
    }
    offerId = matchedOfferId
  }

  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .select('id, email, phone')
    .eq('slug', slug)
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
        ...(offerId ? { offer_id: offerId } : {}),
        notes: { tenant_id: tenant.id, tenant_slug: slug, plan_key: planKey, coupon: couponCodeRaw ?? '' },
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

  // Record the subscription id right away so the webhook (built next) can find this
  // tenant when the payment completes. Status stays "trial" until that webhook confirms.
  const { error: updateError } = await supabaseAdmin
    .from('tenants')
    .update({ razorpay_subscription_id: data.id })
    .eq('id', tenant.id)

  if (updateError) {
    // Don't send the tenant to pay if we can't even record which subscription is
    // theirs — the webhook would have no way to find them afterward.
    return {
      status: 'error',
      error: 'Something went wrong saving your subscription. Please contact JBSS support before trying again — do not complete payment yet.',
    }
  }

  return { status: 'redirecting', url: data.short_url }
}
