export default function SubscribePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0F172A] px-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-[#0F766E]">Trial ended</p>
      <h1 className="mt-3 text-2xl font-bold text-white">Your 3-day free trial has ended</h1>
      <p className="mt-2 max-w-sm text-slate-400">
        Subscribe to keep using AddressPrint without interruption. Payment options are
        being added here shortly.
      </p>
      <a
        href="https://wa.me/919383861514"
        className="mt-6 rounded-lg bg-[#0F766E] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0d6b63]"
      >
        Contact JBSS to subscribe
      </a>
    </main>
  )
}
