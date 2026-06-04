import { DM_Sans } from 'next/font/google'
import type { Metadata } from 'next'
import OnboardForm from './OnboardForm'

const dmSans = DM_Sans({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Set up your AddressPrint account',
  description: 'Create your AddressPrint account to start managing customer addresses.',
}

export default function OnboardPage() {
  return (
    <main
      className={`${dmSans.className} min-h-screen bg-[#0F172A] px-4 py-12 sm:px-6`}
    >
      <div className="mx-auto max-w-lg">
        {/* Brand header */}
        <div className="mb-10 text-center">
          {/* JBSS Lightning bolt */}
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-[#0F766E] mb-4 shadow-lg shadow-[#0F766E]/30">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-8 w-8 text-white"
              aria-hidden="true"
            >
              <path d="M13 2L3 14h8.5l-1.5 8L20 10h-8.5L13 2z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white">
            AddressPrint
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            BizKit by JB Service Solutions (India)
          </p>

          <div className="mt-6">
            <h2 className="text-xl font-semibold text-white">
              Set up your AddressPrint account
            </h2>
            <p className="mt-1.5 text-sm text-slate-400">
              Fill in your business details below. This only takes a minute.
            </p>
          </div>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-[#1E293B] bg-[#0c1322] p-8 shadow-2xl shadow-black/40 ring-1 ring-white/[0.04]">
          <OnboardForm />
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-slate-600">
          &copy; {new Date().getFullYear()} JB Service Solutions (India). All rights reserved.
        </p>
      </div>
    </main>
  )
}
