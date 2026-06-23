import SubscribeOptions from './SubscribeOptions'

type Props = {
  params: Promise<{ slug: string }>
}

export default async function SubscribePage({ params }: Props) {
  const { slug } = await params

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0F172A] px-4 py-12 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-[#0F766E]">Trial ended</p>
      <h1 className="mt-3 text-2xl font-bold text-white">Choose a plan to keep using AddressPrint</h1>
      <p className="mt-2 max-w-sm text-slate-400">
        One login and up to 1,000 customers included. Pick whichever billing cycle works for you.
      </p>

      <SubscribeOptions slug={slug} />

      <a
        href="https://wa.me/919383861514"
        className="mt-6 text-sm text-slate-500 underline hover:text-slate-300"
      >
        Need help? Contact JBSS
      </a>
    </main>
  )
}
