'use client'

import Link from 'next/link'
import type { Tenant } from './types'

interface Props {
  tenant: Tenant
}

function daysUntil(dateStr: string): number {
  const ms = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function SubscriptionBanner({ tenant }: Props) {
  const { subscription_status, trial_ends_at, current_period_end, slug } = tenant

  // Pre-existing tenants who were never moved onto the billing system have no
  // trial/period dates at all — show nothing. Same safety principle as the
  // middleware billing gate: untouched accounts are never bothered.
  if (!trial_ends_at && !current_period_end) return null

  if (subscription_status === 'cancelled') {
    return (
      <Banner
        tone="urgent"
        message="Your subscription has been cancelled."
        action={{ label: 'Subscribe', href: `/${slug}/subscribe` }}
      />
    )
  }

  if (subscription_status === 'trial' && trial_ends_at) {
    const days = daysUntil(trial_ends_at)
    const message =
      days > 1
        ? `Your free trial ends in ${days} days.`
        : days === 1
        ? 'Your free trial ends tomorrow.'
        : days === 0
        ? 'Your free trial ends today.'
        : 'Your free trial has ended.'
    return (
      <Banner
        tone={days <= 1 ? 'urgent' : 'info'}
        message={message}
        action={{ label: 'Subscribe', href: `/${slug}/subscribe` }}
      />
    )
  }

  if (subscription_status === 'active' && current_period_end) {
    return <Banner tone="success" message={`Your subscription renews on ${formatDate(current_period_end)}.`} />
  }

  return null
}

function Banner({
  tone,
  message,
  action,
}: {
  tone: 'info' | 'urgent' | 'success'
  message: string
  action?: { label: string; href: string }
}) {
  const styles =
    tone === 'urgent'
      ? 'bg-amber-50 border-amber-200 text-amber-900'
      : tone === 'success'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
      : 'bg-slate-50 border-slate-200 text-slate-700'

  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 border-b px-5 py-2 text-[13px] ${styles}`}>
      <span>{message}</span>
      {action && (
        <Link
          href={action.href}
          className="shrink-0 rounded-md bg-[#0F766E] px-3 py-1 text-xs font-semibold text-white transition hover:bg-[#0d5f59]"
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}
