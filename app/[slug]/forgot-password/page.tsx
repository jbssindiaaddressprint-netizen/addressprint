import { notFound } from 'next/navigation'
import { DM_Sans } from 'next/font/google'
import { supabaseAdmin } from '@/lib/supabase'
import ForgotPasswordForm from './ForgotPasswordForm'

const dmSans = DM_Sans({ subsets: ['latin'] })

type Props = {
  params: Promise<{ slug: string }>
}

export default async function ForgotPasswordPage({ params }: Props) {
  const { slug } = await params

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('name')
    .eq('slug', slug)
    .single()

  if (!tenant) notFound()

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
          <p className="mt-1 text-sm text-slate-400">Reset your password</p>
        </div>

        <ForgotPasswordForm slug={slug} />
      </div>
    </main>
  )
}
