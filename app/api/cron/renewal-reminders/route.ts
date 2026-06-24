import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendBrevoEmail } from '@/lib/brevo'
import { sendWhatsAppTemplate } from '@/lib/whatsapp'

// How many days before the renewal charge we want tenants to be warned.
const REMINDER_WINDOW_DAYS = 3

// Vercel invokes this once a day and automatically sends an Authorization header
// matching the CRON_SECRET env var — we verify it so nobody else can trigger sends.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: tenants, error } = await supabaseAdmin
    .from('tenants')
    .select('id, name, email, phone, current_period_end, subscription_amount')
    .eq('subscription_status', 'active')
    .is('renewal_reminder_sent_at', null)
    .not('current_period_end', 'is', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

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

  for (const tenant of dueTenants) {
    const renewalDateText = new Date(tenant.current_period_end as string).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    const amountText = tenant.subscription_amount != null ? String(tenant.subscription_amount) : '—'

    // Best-effort sends — one tenant's failed email/WhatsApp must not block the others,
    // and we still mark them reminded so we don't retry-spam them tomorrow.
    try {
      if (tenant.email) {
        await sendBrevoEmail(
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
    } catch {
      // Ignore.
    }

    try {
      if (tenant.phone) {
        await sendWhatsAppTemplate(tenant.phone, 'ap_renewal_reminder', [
          tenant.name ?? 'there',
          renewalDateText,
          amountText,
        ])
      }
    } catch {
      // Ignore.
    }

    await supabaseAdmin
      .from('tenants')
      .update({ renewal_reminder_sent_at: new Date().toISOString() })
      .eq('id', tenant.id)

    sent++
  }

  return NextResponse.json({ status: 'ok', checked: tenants?.length ?? 0, sent })
}
