import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0F172A] px-4 text-center">
      <p className="text-6xl font-bold text-[#0F766E]">404</p>
      <h1 className="mt-4 text-2xl font-bold text-white">Page not found</h1>
      <p className="mt-2 text-slate-400">No AddressPrint account exists at this URL.</p>
      <Link
        href="/onboard"
        className="mt-6 rounded-lg bg-[#0F766E] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0d6b63] transition"
      >
        Create an account
      </Link>
    </main>
  )
}
