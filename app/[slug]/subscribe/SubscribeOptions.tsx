'use client'

import { useActionState, useEffect, useState } from 'react'
import { startSubscription, type SubscribeState } from './actions'

const initialState: SubscribeState = { status: 'idle' }

const PLANS: { key: string; label: string; base: string; total: string; sub: string }[] = [
  { key: 'base_monthly', label: 'Monthly', base: '₹499', total: '₹589', sub: 'billed every month' },
  { key: 'base_3month', label: '3 Months', base: '₹1,450', total: '₹1,711', sub: 'billed once every 3 months · ~3% off' },
  { key: 'base_6month', label: '6 Months', base: '₹2,840', total: '₹3,351', sub: 'billed once every 6 months · ~5% off' },
  { key: 'base_yearly', label: 'Yearly', base: '₹5,500', total: '₹6,490', sub: 'billed once a year · ~8% off' },
]

export default function SubscribeOptions({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState(startSubscription, initialState)
  const [coupon, setCoupon] = useState('')
  const [gstNumber, setGstNumber] = useState('')
  const [billingCompanyName, setBillingCompanyName] = useState('')

  useEffect(() => {
    if (state.status === 'redirecting' && state.url) {
      window.location.href = state.url
    }
  }, [state])

  return (
    <div className="mt-8 grid w-full max-w-md gap-3">
      <div className="mb-1 space-y-2">
        <input
          type="text"
          value={coupon}
          onChange={(e) => setCoupon(e.target.value)}
          placeholder="Have a coupon code? (optional)"
          disabled={pending}
          className="w-full rounded-xl border border-[#334155] bg-[#1E293B] px-4 py-2.5 text-center text-sm text-white placeholder-slate-500 outline-none transition focus:ring-2 focus:ring-[#14B8A6] disabled:cursor-not-allowed disabled:opacity-50"
        />
        <input
          type="text"
          value={billingCompanyName}
          onChange={(e) => setBillingCompanyName(e.target.value)}
          placeholder="Billing company name (optional)"
          disabled={pending}
          className="w-full rounded-xl border border-[#334155] bg-[#1E293B] px-4 py-2.5 text-center text-sm text-white placeholder-slate-500 outline-none transition focus:ring-2 focus:ring-[#14B8A6] disabled:cursor-not-allowed disabled:opacity-50"
        />
        <input
          type="text"
          value={gstNumber}
          onChange={(e) => setGstNumber(e.target.value)}
          placeholder="GST number (optional)"
          disabled={pending}
          className="w-full rounded-xl border border-[#334155] bg-[#1E293B] px-4 py-2.5 text-center text-sm text-white placeholder-slate-500 outline-none transition focus:ring-2 focus:ring-[#14B8A6] disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {PLANS.map((plan) => (
        <form action={formAction} key={plan.key}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="planKey" value={plan.key} />
          <input type="hidden" name="couponCode" value={coupon} />
          <input type="hidden" name="gstNumber" value={gstNumber} />
          <input type="hidden" name="billingCompanyName" value={billingCompanyName} />
          <button
            type="submit"
            disabled={pending}
            className="flex w-full items-center justify-between rounded-xl border border-[#334155] bg-[#1E293B] px-5 py-4 text-left transition hover:border-[#14B8A6] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>
              <span className="block font-semibold text-white">{plan.label}</span>
              <span className="block text-xs text-slate-400">{plan.sub}</span>
            </span>
            <span className="text-right">
              <span className="block text-lg font-bold text-[#14B8A6]">{plan.total}</span>
              <span className="block text-[11px] text-slate-500">{plan.base} + 18% GST</span>
            </span>
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
