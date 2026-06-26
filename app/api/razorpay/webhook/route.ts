import { NextResponse, type NextRequest } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { sendBrevoEmail } from '@/lib/brevo'
import { sendWhatsAppTemplate } from '@/lib/whatsapp'
import { planLabel } from '@/lib/planLabels'

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
    payload?: {
      subscription?: { entity?: { id?: string; current_end?: number } }
      payment?: { entity?: { amount?: number } }
    }
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

    // Razorpay sends the actual charged amount (in paise) on the payment entity — this is
    // the ground truth (reflects any coupon/offer discount), more reliable than recomputing
    // from a plan price.
    const chargedAmountRupees = event.payload?.payment?.entity?.amount
      ? Math.round(event.payload.payment.entity.amount / 100)
      : null

    // First check whether this is a base-plan subscription (lives on tenants.razorpay_subscription_id).
    const { data: baseTenant } = await supabaseAdmin
      .from('tenants')
      .select('id, name, email, phone, current_period_end, subscription_status, gst_number, billing_company_name, plan_key')
      .eq('razorpay_subscription_id', subscriptionId)
      .maybeSingle()

    if (baseTenant) {
      // A genuine renewal is a "subscription.charged" event for a tenant who already
      // completed at least one billing cycle (current_period_end was already set before
      // this webhook run). This deliberately excludes the very first charge after trial —
      // that one is already covered by the welcome/trial-started messages, not a "renewal".
      const isRenewal = eventType === 'subscription.charged' && !!baseTenant.current_period_end

      // First-ever conversion = was on "trial" before this event. Checked on the
      // pre-update status, so a duplicate webhook for the same event (Razorpay retries,
      // or "activated" + "charged" both landing for the same payment) won't double-fire
      // this once the first one has already flipped status to "active".
      const isFirstConversion = !isRenewal && baseTenant.subscription_status === 'trial'

      const amountText = chargedAmountRupees != null ? String(chargedAmountRupees) : '—'
      const renewedUntilText = currentPeriodEnd
        ? new Date(currentPeriodEnd).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—'

      await supabaseAdmin
        .from('tenants')
        .update({
          subscription_status: 'active',
          current_period_end: currentPeriodEnd,
          ...(chargedAmountRupees ? { subscription_amount: chargedAmountRupees } : {}),
          // Reset the reminder flag so the advance-warning can fire again ahead of the NEXT cycle.
          ...(isRenewal ? { renewal_reminder_sent_at: null } : {}),
        })
        .eq('id', baseTenant.id)

      if (isRenewal) {
        // Best-effort notifications — the webhook must still succeed (return 200) even if
        // these fail, otherwise Razorpay will keep retrying a payment event we already processed.
        // These helpers return {success:false, error} rather than throwing, so we check the
        // result explicitly and log it — a bare try/catch would silently miss real failures.
        if (baseTenant.email) {
          const emailResult = await sendBrevoEmail(
            baseTenant.email,
            'Your AddressPrint subscription has been renewed',
            `<div style="font-family: sans-serif; max-width: 480px;">
              <p>Hi ${baseTenant.name ?? ''},</p>
              <p>Your AddressPrint subscription has been renewed. &#8377;${amountText} was charged successfully, and your service is active until <strong>${renewedUntilText}</strong>.</p>
              <p>Thank you for staying with us!</p>
              <p>If you ever need help, reach us at support@jbssindia.com.</p>
              <p style="color: #888; font-size: 12px; margin-top: 24px;">JBSS AddressPrint &middot; support@jbssindia.com</p>
            </div>`
          )
          if (!emailResult.success) console.error(`Renewal-success email failed for ${baseTenant.id}:`, emailResult.error)
        }

        if (baseTenant.phone) {
          const whatsappResult = await sendWhatsAppTemplate(baseTenant.phone, 'ap_renewal_success', [
            baseTenant.name ?? 'there',
            amountText,
            renewedUntilText,
          ])
          if (!whatsappResult.success) console.error(`Renewal-success WhatsApp failed for ${baseTenant.id}:`, whatsappResult.error)
        }
      } else if (isFirstConversion) {
        // First time this tenant has actually paid — notify JBSS directly so there's no
        // need to check Supabase, and so the GST number / billing company are on hand
        // right away for the Zoho invoice cross-check. Renewals deliberately do NOT
        // send this — those get covered by a weekly digest instead, to avoid one email
        // per tenant per billing cycle once there are many tenants.
        const adminNotifyResult = await sendBrevoEmail(
          'info@jbssindia.com',
          `AddressPrint: ${baseTenant.name} just subscribed`,
          `<div style="font-family: sans-serif; max-width: 480px;">
            <p><strong>${baseTenant.name}</strong> just converted from trial to a paid AddressPrint subscription.</p>
            <table style="font-size: 14px; border-collapse: collapse;">
              <tr><td style="padding:4px 12px 4px 0;color:#666;">Plan</td><td>${planLabel(baseTenant.plan_key)}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#666;">Amount charged</td><td>&#8377;${amountText}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#666;">GST number</td><td>${baseTenant.gst_number ?? 'Not provided'}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#666;">Billing company</td><td>${baseTenant.billing_company_name ?? 'Not provided'}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#666;">Active until</td><td>${renewedUntilText}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#666;">Tenant email</td><td>${baseTenant.email ?? '—'}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#666;">Tenant phone</td><td>${baseTenant.phone ?? '—'}</td></tr>
            </table>
          </div>`
        )
        if (!adminNotifyResult.success) console.error(`First-conversion admin-notify email failed for ${baseTenant.id}:`, adminNotifyResult.error)
      }

      // Log every real charge (first conversion AND renewals) into the permanent
      // billing ledger — this is what the weekly digest reads from, and it also
      // doubles as a standing payment history for Zoho reconciliation.
      if (chargedAmountRupees != null) {
        const { error: logError } = await supabaseAdmin.from('billing_events').insert({
          tenant_id: baseTenant.id,
          event_type: isRenewal ? 'base_renewal' : 'base_first',
          amount: chargedAmountRupees,
          plan_key: baseTenant.plan_key,
          gst_number: baseTenant.gst_number,
          billing_company_name: baseTenant.billing_company_name,
        })
        if (logError) console.error(`billing_events insert failed for ${baseTenant.id}:`, logError)
      }
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

        // Same permanent billing ledger as the base-plan branch above — GST number and
        // billing company live on the tenant row, not on the add-on subscription itself.
        if (chargedAmountRupees != null) {
          const { data: gstInfo } = await supabaseAdmin
            .from('tenants')
            .select('name, gst_number, billing_company_name')
            .eq('id', extraRow.tenant_id)
            .single()

          const { error: logError } = await supabaseAdmin.from('billing_events').insert({
            tenant_id: extraRow.tenant_id,
            event_type: isFirstActivation ? 'extra_login_first' : 'extra_login_renewal',
            amount: chargedAmountRupees,
            plan_key: null,
            gst_number: gstInfo?.gst_number ?? null,
            billing_company_name: gstInfo?.billing_company_name ?? null,
          })
          if (logError) console.error(`billing_events insert failed for extra-login ${extraRow.tenant_id}:`, logError)
        }
      }
    }
  }

  if (subscriptionId && DEACTIVATING_EVENTS.has(eventType)) {
    await supabaseAdmin
      .from('tenants')
      .update({ subscription_status: 'cancelled', cancel_at_period_end: false })
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
