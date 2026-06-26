import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DM_Sans } from 'next/font/google'
import { supabaseAdmin } from '@/lib/supabase'
import { ADMIN_SESSION_COOKIE } from '@/lib/admin-session'
import AdminPanel from './AdminPanel'
import type { AdminTenant } from './types'

const dmSans = DM_Sans({ subsets: ['latin'] })

async function isAuthed(): Promise<boolean> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  const expected = process.env.ADMIN_SESSION_TOKEN
  return !!cookie && !!expected && cookie === expected
}

export default async function AdminPage() {
  const authed = await isAuthed()
  if (!authed) redirect('/admin/login')

  const [tenantsRes, customersRes, extraLoginsRes] = await Promise.all([
    supabaseAdmin
      .from('tenants')
      .select(
        'id, name, slug, email, phone, is_active, customer_limit, paid_logins, prints_month, prints_lifetime, subscription_status, trial_ends_at, current_period_end, subscription_amount, plan_key, gst_number, billing_company_name'
      )
      .order('name'),
    supabaseAdmin.from('customers').select('tenant_id'),
    // Only need ACTIVE add-on subscriptions here — this lets the admin panel flag a
    // mismatch against paid_logins (e.g. one extra-login sub was cancelled but the seat
    // count was never manually reduced).
    supabaseAdmin.from('extra_login_subscriptions').select('tenant_id').eq('status', 'active'),
  ])

  const customerCounts: Record<string, number> = {}
  for (const row of customersRes.data ?? []) {
    const tid = (row as { tenant_id: string }).tenant_id
    customerCounts[tid] = (customerCounts[tid] ?? 0) + 1
  }

  const activeExtraLoginCounts: Record<string, number> = {}
  for (const row of extraLoginsRes.data ?? []) {
    const tid = (row as { tenant_id: string }).tenant_id
    activeExtraLoginCounts[tid] = (activeExtraLoginCounts[tid] ?? 0) + 1
  }

  const tenants: AdminTenant[] = (tenantsRes.data ?? []).map(t => ({
    ...t,
    active_extra_logins: activeExtraLoginCounts[t.id] ?? 0,
  })) as AdminTenant[]

  return (
    <main className={`${dmSans.className} min-h-screen bg-[#0F172A] px-4 py-8 sm:px-8`}>
      <div className="mx-auto max-w-6xl">
        <AdminPanel tenants={tenants} customerCounts={customerCounts} />
      </div>
    </main>
  )
}
