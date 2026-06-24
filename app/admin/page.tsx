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

  const [tenantsRes, customersRes] = await Promise.all([
    supabaseAdmin
      .from('tenants')
      .select(
        'id, name, slug, email, phone, is_active, customer_limit, paid_logins, prints_month, prints_lifetime, subscription_status, trial_ends_at, current_period_end, subscription_amount'
      )
      .order('name'),
    supabaseAdmin.from('customers').select('tenant_id'),
  ])

  const tenants: AdminTenant[] = tenantsRes.data ?? []

  const customerCounts: Record<string, number> = {}
  for (const row of customersRes.data ?? []) {
    const tid = (row as { tenant_id: string }).tenant_id
    customerCounts[tid] = (customerCounts[tid] ?? 0) + 1
  }

  return (
    <main className={`${dmSans.className} min-h-screen bg-[#0F172A] px-4 py-8 sm:px-8`}>
      <div className="mx-auto max-w-6xl">
        <AdminPanel tenants={tenants} customerCounts={customerCounts} />
      </div>
    </main>
  )
}
