'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { Tenant } from './types'
import { cancelSubscription } from './actions'

interface Props {
  tenant: Tenant
  onChanged: (updates: Partial<Tenant>) => void
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function SubscriptionCard({ tenant, onChanged }: Props) {
  const [showOptions, setShowOptions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Pre-existing tenants never moved onto billing — nothing to show here, same
  // safety principle as the dashboard banner and the middleware billing gate.
  if (!tenant.trial_ends_at && !tenant.current_period_end) return null

  function handleCancel(mode: 'now' | 'period_end') {
    setError(null)
    startTransition(async () => {
      const result = await cancelSubscription(tenant.id, mode)
      if (result.status === 'success') {
        if (mode === 'now') {
          onChanged({ subscription_status: 'cancelled', cancel_at_period_end: false })
        } else {
          onChanged({ cancel_at_period_end: true })
        }
        setShowOptions(false)
      } else {
        setError(result.error ?? 'Something went wrong. Please try again.')
      }
    })
  }

  if (tenant.subscription_status === 'cancelled') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Subscription</h3>
        <p className="text-sm text-slate-500">Your subscription has ended.</p>
        <Link
          href={`/${tenant.slug}/subscribe`}
          className="inline-block rounded-lg bg-[#0F766E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d6b63] transition"
        >
          Subscribe
        </Link>
      </div>
    )
  }

  if (tenant.subscription_status !== 'active') return null

  if (tenant.cancel_at_period_end && tenant.current_period_end) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm space-y-1">
        <h3 className="text-sm font-semibold text-amber-900">Subscription</h3>
        <p className="text-sm text-amber-800">
          Your subscription is scheduled to end on {formatDate(tenant.current_period_end)}. It will not
          renew after that — no further charges.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-700">Subscription</h3>
        {tenant.current_period_end && (
          <p className="text-sm text-slate-500 mt-0.5">Renews on {formatDate(tenant.current_period_end)}.</p>
        )}
      </div>

      {!showOptions ? (
        <button
          onClick={() => setShowOptions(true)}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
        >
          Cancel Subscription
        </button>
      ) : (
        <div className="space-y-2.5">
          <button
            onClick={() => handleCancel('period_end')}
            disabled={isPending}
            className="flex w-full flex-col items-start rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-[#14B8A6] disabled:opacity-50"
          >
            <span className="text-sm font-semibold text-slate-800">Cancel at Period End</span>
            <span className="text-xs text-slate-500 mt-0.5">
              Keep full access until{' '}
              {tenant.current_period_end ? formatDate(tenant.current_period_end) : 'your paid-through date'}.
              It simply won&apos;t renew after that — no further charges.
            </span>
          </button>
          <button
            onClick={() => handleCancel('now')}
            disabled={isPending}
            className="flex w-full flex-col items-start rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left transition hover:border-red-400 disabled:opacity-50"
          >
            <span className="text-sm font-semibold text-red-700">Cancel Now</span>
            <span className="text-xs text-red-600 mt-0.5">
              You&apos;ll lose access immediately. No refund for remaining paid days.
            </span>
          </button>
          <button
            onClick={() => setShowOptions(false)}
            disabled={isPending}
            className="text-xs text-slate-400 hover:text-slate-600 transition"
          >
            Never mind, keep my subscription
          </button>
        </div>
      )}

      {isPending && <p className="text-xs text-slate-400">Processing…</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
