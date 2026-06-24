import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { DM_Sans } from 'next/font/google'
import type { Metadata } from 'next'
import DashboardShell from './DashboardShell'
import type { Tenant, Customer, Transporter } from './types'

const dmSans = DM_Sans({ subsets: ['latin'] })

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const { data } = await supabaseAdmin.from('tenants').select('name').eq('slug', slug).single()
  return { title: data ? `${data.name} — AddressPrint` : 'Not Found' }
}

export default async function DashboardPage({ params }: Props) {
  const { slug } = await params

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id, name, slug, logo_url, address, pin, state, country, phone, extra_phones, prints_month, prints_lifetime, subscription_status, trial_ends_at, current_period_end')
    .eq('slug', slug)
    .single()

  if (!tenant) notFound()

  const [{ data: customers }, { data: transporters }] = await Promise.all([
    supabaseAdmin.from('customers').select('*').eq('tenant_id', tenant.id).order('company_name'),
    supabaseAdmin.from('transporters').select('*').eq('tenant_id', tenant.id).order('name'),
  ])

  return (
    <DashboardShell
      tenant={tenant as Tenant}
      initialCustomers={(customers ?? []) as Customer[]}
      initialTransporters={(transporters ?? []) as Transporter[]}
      fontClassName={dmSans.className}
    />
  )
}
