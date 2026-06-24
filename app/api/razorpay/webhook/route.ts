import { NextResponse, type NextRequest } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

// Events that mean "payment succeeded — this tenant should have access."
const ACTIVATING_EVENTS = new Set(['subscription.activated', 'subscription.charged'])

// Events that mean "billing stopped — this tenant should be blocked again."
const DEACTIVATING_EVENTS = new Set([
  'subscription.cancelled',
  'subscription.completed',
  'subscription.halted',
])

export async function POST(request: NextRequest) {
  // Must read the raw text BEFORE any JSON parsing — the signature is computed over
  // the exact raw bytes Razorpay sent, and re-serialized JSON would not match.
  const rawBody = await request.text()
  const signature = request.headers.get('x-razorpay-signature')
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET

  if (!secret || !signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

  const validSignature =
    expectedSignature.length === signature.length &&
    crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))

  if (!validSignature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: {
    event?: string
    payload?: { subscription?: { entity?: { id?: string; current_end?: number } } }
  }

  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventType = event.event ?? ''
  const subscription = event.payload?.subscription?.entity
  const subscriptionId = subscription?.id

  if (subscriptionId && ACTIVATING_EVENTS.has(eventType)) {
    const currentPeriodEnd = subscription?.current_end
      ? new Date(subscription.current_end * 1000).toISOString()
      : null

    // First check whether this is a base-plan subscription (lives on tenants.razorpay_subscription_id).
    const { data: baseTenant } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('razorpay_subscription_id', subscriptionId)
      .maybeSingle()

    if (baseTenant) {
      await supabaseAdmin
        .from('tenants')
        .update({ subscription_status: 'active', current_period_end: currentPeriodEnd })
        .eq('id', baseTenant.id)
    } else {
      // Not a base-plan payment — check whether it's an extra-login purchase instead.
      const { data: extraRow } = await supabaseAdmin
        .from('extra_login_subscriptions')
        .select('id, tenant_id, status')
        .eq('razorpay_subscription_id', subscriptionId)
        .maybeSingle()

      if (extraRow) {
        const isFirstActivation = extraRow.status !== 'active'

        await supabaseAdmin
          .from('extra_login_subscriptions')
          .update({ status: 'active', current_period_end: currentPeriodEnd })
          .eq('id', extraRow.id)

        // Only add a seat the FIRST time this subscription activates — later renewal
        // charges for the same subscription must not keep incrementing paid_logins.
        if (isFirstActivation) {
          const { data: tenantRow } = await supabaseAdmin
            .from('tenants')
            .select('paid_logins')
            .eq('id', extraRow.tenant_id)
            .single()

          await supabaseAdmin
            .from('tenants')
            .update({ paid_logins: (tenantRow?.paid_logins ?? 1) + 1 })
            .eq('id', extraRow.tenant_id)
        }
      }
    }
  }

  if (subscriptionId && DEACTIVATING_EVENTS.has(eventType)) {
    await supabaseAdmin
      .from('tenants')
      .update({ subscription_status: 'cancelled' })
      .eq('razorpay_subscription_id', subscriptionId)

    // If it was an extra-login subscription instead, just mark it cancelled for
    // record-keeping. We deliberately do NOT auto-decrease paid_logins or pick which
    // staff login to disable — that stays a manual JBSS admin decision.
    await supabaseAdmin
      .from('extra_login_subscriptions')
      .update({ status: 'cancelled' })
      .eq('razorpay_subscription_id', subscriptionId)
  }

  // Always acknowledge with 200 quickly — Razorpay retries aggressively on non-200s,
  // and we've already done everything we need to with the events we recognize.
  return NextResponse.json({ status: 'ok' })
}
