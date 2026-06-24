import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendBrevoEmail } from '@/lib/brevo'
import { sendWhatsAppTemplate } from '@/lib/whatsapp'

// How many days before the renewal charge we want tenants to be warned.
const REMINDER_WINDOW_DAYS = 3

// Vercel invokes this once a day and automatically sends an Authorization header
// matching the CRON_SECRET env var — we verify it so nobody else can trigger sends.
// This route now handles two independent daily checks: upcoming renewals, and
// trials that have just ended.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const renewals = await runRenewalReminders()
  const trialEnded = await runTrialEndedNotices()

  return NextResponse.json({ status: 'ok', renewals, trialEnded })
}

async function runRenewalReminders() {
  const { data: tenants, error } = await supabaseAdmin
    .from('tenants')
    .select('id, name, email, phone, current_period_end, subscription_amount')
    .eq('subscription_status', 'active')
    .is('renewal_reminder_sent_at', null)
    .not('current_period_end', 'is', null)

  if (error) return { error: error.message }

  const now = Date.now()

  // Anyone whose renewal is somewhere in the next REMINDER_WINDOW_DAYS days and hasn't
  // been reminded yet this cycle. A multi-day window (rather than an exact day match)
  // means a missed or delayed cron run never causes a tenant to be skipped entirely.
  const dueTenants = (tenants ?? []).filter((t) => {
    if (!t.current_period_end) return false
    const daysUntilRenewal = (new Date(t.current_period_end).getTime() - now) / (24 * 60 * 60 * 1000)
    return daysUntilRenewal > 0 && daysUntilRenewal <= REMINDER_WINDOW_DAYS
  })

  let sent = 0
  const results: { tenantId: string; email?: string; whatsapp?: string }[] = []

  for (const tenant of dueTenants) {
    const renewalDateText = new Date(tenant.current_period_end as string).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    const amountText = tenant.subscription_amount != null ? String(tenant.subscription_amount) : '—'
    let emailResult: { success: boolean; error?: string } = { success: false, error: 'No email on file' }
    let whatsappResult: { success: boolean; error?: string } = { success: false, error: 'No phone on file' }

    // Best-effort sends — one tenant's failed email/WhatsApp must not block the others,
    // and we still mark them reminded so we don't retry-spam them tomorrow. We still
    // capture and log the actual result (these helpers return {success:false, error}
    // rather than throwing, so a try/catch alone would silently miss real failures).
    if (tenant.email) {
      emailResult = await sendBrevoEmail(
        tenant.email,
        'Your AddressPrint subscription renews soon',
        `<div style="font-family: sans-serif; max-width: 480px;">
          <p>Hi ${tenant.name ?? ''},</p>
          <p>Your AddressPrint subscription renews on <strong>${renewalDateText}</strong> for &#8377;${amountText}. This happens automatically — no action needed.</p>
          <p>Questions? Reply to this email or contact support@jbssindia.com.</p>
          <p style="color: #888; font-size: 12px; margin-top: 24px;">JBSS AddressPrint &middot; support@jbssindia.com</p>
        </div>`
      )
    }
    if (!emailResult.success) console.error(`Renewal reminder email failed for ${tenant.id}:`, emailResult.error)

    if (tenant.phone) {
      whatsappResult = await sendWhatsAppTemplate(tenant.phone, 'ap_renewal_reminder', [
        tenant.name ?? 'there',
        renewalDateText,
        amountText,
      ])
    }
    if (!whatsappResult.success) console.error(`Renewal reminder WhatsApp failed for ${tenant.id}:`, whatsappResult.error)

    await supabaseAdmin
      .from('tenants')
      .update({ renewal_reminder_sent_at: new Date().toISOString() })
      .eq('id', tenant.id)

    sent++
    results.push({
      tenantId: tenant.id,
      email: emailResult.success ? 'sent' : emailResult.error,
      whatsapp: whatsappResult.success ? 'sent' : whatsappResult.error,
    })
  }

  return { checked: tenants?.length ?? 0, sent, results }
}

async function runTrialEndedNotices() {
  const nowIso = new Date().toISOString()

  const { data: tenants, error } = await supabaseAdmin
    .from('tenants')
    .select('id, name, email, phone')
    .eq('subscription_status', 'trial')
    .is('trial_ended_notified_at', null)
    .not('trial_ends_at', 'is', null)
    .lt('trial_ends_at', nowIso)

  if (error) return { error: error.message }

  let sent = 0
  const results: { tenantId: string; email?: string; whatsapp?: string }[] = []

  for (const tenant of tenants ?? []) {
    let emailResult: { success: boolean; error?: string } = { success: false, error: 'No email on file' }
    let whatsappResult: { success: boolean; error?: string } = { success: false, error: 'No phone on file' }

    if (tenant.email) {
      emailResult = await sendBrevoEmail(
        tenant.email,
        'Your AddressPrint free trial has ended',
        `<div style="font-family: sans-serif; max-width: 480px;">
          <p>Hi ${tenant.name ?? ''},</p>
          <p>Your 3-day free trial of AddressPrint has ended. Subscribe to keep printing your shipping labels without interruption.</p>
          <p>Questions? Reply to this email or contact support@jbssindia.com.</p>
          <p style="color: #888; font-size: 12px; margin-top: 24px;">JBSS AddressPrint &middot; support@jbssindia.com</p>
        </div>`
      )
    }
    if (!emailResult.success) console.error(`Trial-ended email failed for ${tenant.id}:`, emailResult.error)

    if (tenant.phone) {
      whatsappResult = await sendWhatsAppTemplate(tenant.phone, 'ap_trial_ended', [tenant.name ?? 'there'])
    }
    if (!whatsappResult.success) console.error(`Trial-ended WhatsApp failed for ${tenant.id}:`, whatsappResult.error)

    await supabaseAdmin
      .from('tenants')
      .update({ trial_ended_notified_at: new Date().toISOString() })
      .eq('id', tenant.id)

    sent++
    results.push({
      tenantId: tenant.id,
      email: emailResult.success ? 'sent' : emailResult.error,
      whatsapp: whatsappResult.success ? 'sent' : whatsappResult.error,
    })
  }

  return { checked: tenants?.length ?? 0, sent, results }
}
