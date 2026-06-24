import Link from 'next/link'
import { DM_Sans } from 'next/font/google'
import WelcomeLoginForm from './WelcomeLoginForm'

const dmSans = DM_Sans({ subsets: ['latin'] })

export default function Home() {
  return (
    <main className={`${dmSans.className} flex min-h-screen items-center justify-center bg-[#0F172A] px-4 py-12`}>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0F766E] shadow-lg shadow-[#0F766E]/30">
            <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
              <polygon points="5.44,12 10.13,6.75 18,6.75 18,17.25 10.13,17.25" fill="white" />
              <circle cx="8.63" cy="12" r="0.84" fill="#0F766E" />
              <rect x="11.25" y="9.75" width="4.69" height="0.75" rx="0.375" fill="#0F766E" />
              <rect x="11.25" y="11.63" width="5.81" height="0.75" rx="0.375" fill="#0F766E" />
              <rect x="11.25" y="13.5" width="3.75" height="0.75" rx="0.375" fill="#0F766E" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">AddressPrint</h1>
          <p className="mt-1 text-sm text-slate-500">BizKit by JB Service Solutions (India)</p>
        </div>

        <WelcomeLoginForm />

        <p className="mt-6 text-center text-sm text-slate-400">
          New here?{' '}
          <Link href="/onboard" className="font-semibold text-[#14B8A6] hover:underline">
            Start your free 3-day trial
          </Link>
        </p>
      </div>
    </main>
  )
}
