import { DM_Sans } from 'next/font/google'
import AdminLoginForm from './AdminLoginForm'

const dmSans = DM_Sans({ subsets: ['latin'] })

export default function AdminLoginPage() {
  return (
    <main className={`${dmSans.className} flex min-h-screen items-center justify-center bg-[#0F172A] px-4`}>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#0F766E]">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-white">
              <path d="M13 2L3 14h8.5l-1.5 8L20 10h-8.5L13 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">AddressPrint Admin</h1>
          <p className="mt-1 text-sm text-slate-400">JBSS internal access only</p>
        </div>

        <AdminLoginForm />
      </div>
    </main>
  )
}
