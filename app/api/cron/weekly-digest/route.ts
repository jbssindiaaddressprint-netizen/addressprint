import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendBrevoEmail } from '@/lib/brevo'
import { planLabel } from '@/lib/planLabels'

// Vercel invokes this once a week (Monday morning) and sends an Authorization header
// matching the CRON_SECRET env var — same verification pattern as renewal-reminders.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runWeeklyDigest()
  return NextResponse.json({ status: 'ok', ...result })
}

async function runWeeklyDigest() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Only renewals here — first-time conversions already get an instant email of
  // their own (see the webhook), so including them here would just be a duplicate.
  const { data: events, error } = await supabaseAdmin
    .from('billing_events')
    .select('tenant_id, event_type, amount, plan_key, gst_number, billing_company_name, created_at')
    .in('event_type', ['base_renewal', 'extra_login_renewal'])
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('weekly-digest: failed to read billing_events', error)
    return { sent: false, reason: 'query_failed' }
  }

  const rows = events ?? []

  // Tenant names aren't stored on billing_events itself — look them up in one batch.
  const tenantIds = [...new Set(rows.map(r => r.tenant_id))]
  const tenantNames: Record<string, string> = {}
  if (tenantIds.length > 0) {
    const { data: tenants } = await supabaseAdmin.from('tenants').select('id, name').in('id', tenantIds)
    for (const t of tenants ?? []) tenantNames[t.id] = t.name
  }

  const totalAmount = rows.reduce((sum, r) => sum + Number(r.amount), 0)

  const tableRows = rows
    .map(r => {
      const planText = r.event_type === 'extra_login_renewal' ? 'Extra Login' : planLabel(r.plan_key)
      const dateText = new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      return `<tr>
        <td style="padding:4px 12px 4px 0;">${tenantNames[r.tenant_id] ?? r.tenant_id}</td>
        <td style="padding:4px 12px 4px 0;">${planText}</td>
        <td style="padding:4px 12px 4px 0;">&#8377;${r.amount}</td>
        <td style="padding:4px 12px 4px 0;color:#666;">${r.gst_number ?? 'Not provided'}</td>
        <td style="padding:4px 12px 4px 0;color:#666;">${r.billing_company_name ?? 'Not provided'}</td>
        <td style="padding:4px 12px 4px 0;color:#666;">${dateText}</td>
      </tr>`
    })
    .join('')

  const body =
    rows.length === 0
      ? `<div style="font-family: sans-serif;">
          <p>No AddressPrint renewals in the past 7 days.</p>
          <p style="color:#888;font-size:12px;">This is the regular weekly digest — sent even when empty, so you know the check itself is still running.</p>
        </div>`
      : `<div style="font-family: sans-serif;">
          <p><strong>${rows.length} renewal${rows.length === 1 ? '' : 's'}</strong> in the past 7 days, totalling &#8377;${totalAmount}.</p>
          <table style="font-size: 14px; border-collapse: collapse;">
            <tr style="text-align:left;color:#666;">
              <th style="padding:4px 12px 4px 0;">Tenant</th>
              <th style="padding:4px 12px 4px 0;">Plan</th>
              <th style="padding:4px 12px 4px 0;">Amount</th>
              <th style="padding:4px 12px 4px 0;">GST Number</th>
              <th style="padding:4px 12px 4px 0;">Billing Company</th>
              <th style="padding:4px 12px 4px 0;">Date</th>
            </tr>
            ${tableRows}
          </table>
        </div>`

  const emailResult = await sendBrevoEmail('info@jbssindia.com', 'AddressPrint: Weekly renewal digest', body)
  if (!emailResult.success) {
    console.error('weekly-digest: email failed', emailResult.error)
    return { sent: false, reason: 'email_failed', count: rows.length }
  }

  return { sent: true, count: rows.length, totalAmount }
}
