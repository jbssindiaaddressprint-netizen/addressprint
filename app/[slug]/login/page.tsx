import { notFound } from 'next/navigation'
import { DM_Sans } from 'next/font/google'
import { supabaseAdmin } from '@/lib/supabase'
import LoginForm from './LoginForm'

const dmSans = DM_Sans({ subsets: ['latin'] })

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ reason?: string }>
}

const REASON_MESSAGES: Record<string, string> = {
  idle: 'You were logged out after 15 minutes of inactivity, to keep your data safe.',
  kicked: 'You were logged out because this account was logged in on another device.',
  inactive: 'This account has been deactivated. Please contact JBSS support.',
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { reason } = await searchParams

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('name')
    .eq('slug', slug)
    .single()

  if (!tenant) notFound()

  const message = reason ? REASON_MESSAGES[reason] : undefined

  return (
    <main className={`${dmSans.className} flex min-h-screen items-center justify-center bg-[#0F172A] px-4`}>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#0F766E]">
            <svg viewBox="0 0 24 24" className="h-6 w-6">
              <polygon points="4.7,12 10.3,5.8 18.5,5.8 18.5,18.2 10.3,18.2" fill="white" />
              <circle cx="8.1" cy="12" r="1.2" fill="#0F766E" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">{tenant.name}</h1>
          <p className="mt-1 text-sm text-slate-400">Log in to AddressPrint</p>
        </div>

        {message && (
          <div className="mb-4 rounded-xl border border-amber-800/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
            {message}
          </div>
        )}

        <LoginForm slug={slug} />
      </div>
    </main>
  )
}
