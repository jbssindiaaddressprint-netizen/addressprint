'use client'

import { useActionState, useEffect, useState } from 'react'
import { startSubscription, type SubscribeState } from './actions'

const initialState: SubscribeState = { status: 'idle' }

const PLANS: { key: string; label: string; price: string; sub: string }[] = [
  { key: 'base_monthly', label: 'Monthly', price: '₹499', sub: 'billed every month' },
  { key: 'base_3month', label: '3 Months', price: '₹1,420', sub: 'billed once every 3 months · ~5% off' },
  { key: 'base_6month', label: '6 Months', price: '₹2,750', sub: 'billed once every 6 months · ~8% off' },
  { key: 'base_yearly', label: 'Yearly', price: '₹5,988', sub: 'billed once a year · 13th month free' },
]

export default function SubscribeOptions({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState(startSubscription, initialState)
  const [coupon, setCoupon] = useState('')

  useEffect(() => {
    if (state.status === 'redirecting' && state.url) {
      window.location.href = state.url
    }
  }, [state])

  return (
    <div className="mt-8 grid w-full max-w-md gap-3">
      <div className="mb-1">
        <input
          type="text"
          value={coupon}
          onChange={(e) => setCoupon(e.target.value)}
          placeholder="Have a coupon code? (optional)"
          disabled={pending}
          className="w-full rounded-xl border border-[#334155] bg-[#1E293B] px-4 py-2.5 text-center text-sm text-white placeholder-slate-500 outline-none transition focus:ring-2 focus:ring-[#14B8A6] disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {PLANS.map((plan) => (
        <form action={formAction} key={plan.key}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="planKey" value={plan.key} />
          <input type="hidden" name="couponCode" value={coupon} />
          <button
            type="submit"
            disabled={pending}
            className="flex w-full items-center justify-between rounded-xl border border-[#334155] bg-[#1E293B] px-5 py-4 text-left transition hover:border-[#14B8A6] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>
              <span className="block font-semibold text-white">{plan.label}</span>
              <span className="block text-xs text-slate-400">{plan.sub}</span>
            </span>
            <span className="text-lg font-bold text-[#14B8A6]">{plan.price}</span>
          </button>
        </form>
      ))}

      {state.status === 'error' && (
        <div className="rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-400">
          {state.error}
        </div>
      )}

      {pending && <p className="text-center text-sm text-slate-400">Taking you to secure payment…</p>}
    </div>
  )
}
