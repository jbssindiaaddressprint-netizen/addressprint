'use client'

import { useEffect, useState, useTransition, useActionState } from 'react'
import type { Tenant, TenantLogin } from '../types'
import { addStaffLogin, startExtraLoginSubscription, type ExtraLoginState } from '../logins/actions'

interface Props {
  tenant: Tenant
  logins: TenantLogin[]
  onAdded: (login: TenantLogin) => void
}

const EXTRA_PLANS: { key: string; label: string; base: string; total: string; sub: string }[] = [
  { key: 'extra_monthly', label: 'Monthly', base: '₹299', total: '₹353', sub: 'billed every month' },
  { key: 'extra_3month', label: '3 Months', base: '₹870', total: '₹1,027', sub: 'billed once every 3 months · ~3% off' },
  { key: 'extra_6month', label: '6 Months', base: '₹1,700', total: '₹2,006', sub: 'billed once every 6 months · ~5% off' },
  { key: 'extra_yearly', label: 'Yearly', base: '₹3,300', total: '₹3,894', sub: 'billed once a year · ~8% off' },
]

const initialExtraState: ExtraLoginState = { status: 'idle' }

export default function LoginsSection({ tenant, logins, onAdded }: Props) {
  const activeCount = logins.filter((l) => l.is_active).length
  const paidLogins = tenant.paid_logins ?? 1
  const canAddMore = activeCount < paidLogins

  const [label, setLabel] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showBuy, setShowBuy] = useState(false)

  const [extraState, extraFormAction, extraPending] = useActionState(startExtraLoginSubscription, initialExtraState)

  useEffect(() => {
    if (extraState.status === 'redirecting' && extraState.url) {
      window.location.href = extraState.url
    }
  }, [extraState])

  function handleAdd() {
    setError(null)
    startTransition(async () => {
      const result = await addStaffLogin(tenant.id, label, password)
      if (result.success) {
        onAdded(result.data)
        setLabel('')
        setPassword('')
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Logins</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          {activeCount} of {paidLogins} paid login{paidLogins === 1 ? '' : 's'} used.
        </p>
      </div>

      {/* Existing logins */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Staff Logins</h3>
        {logins.length === 0 ? (
          <p className="text-sm text-slate-500">No logins yet.</p>
        ) : (
          <div className="space-y-2">
            {logins.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5"
              >
                <span className="text-sm font-medium text-slate-800">{l.label}</span>
                <span
                  className={`text-xs font-semibold ${l.is_active ? 'text-[#0F766E]' : 'text-slate-400'}`}
                >
                  {l.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add new login */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">Add a Staff Login</h3>

        {canAddMore ? (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Office Staff"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#14B8A6] focus:ring-2 focus:ring-[#14B8A6]/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#14B8A6] focus:ring-2 focus:ring-[#14B8A6]/20"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              onClick={handleAdd}
              disabled={isPending}
              className="rounded-lg bg-[#0F766E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d6b63] disabled:opacity-60 transition"
            >
              {isPending ? 'Adding…' : 'Add Login'}
            </button>
          </>
        ) : (
          <p className="text-sm text-slate-500">
            You&apos;ve used all your paid logins. Buy an extra login below to add another staff member.
          </p>
        )}
      </div>

      {/* Buy extra login */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Buy an Extra Login</h3>
            <p className="text-xs text-slate-500 mt-0.5">Adds one more seat to your account.</p>
          </div>
          {!showBuy && (
            <button
              onClick={() => setShowBuy(true)}
              className="rounded-lg border border-[#0F766E] px-3 py-1.5 text-xs font-semibold text-[#0F766E] hover:bg-[#f0fdf9] transition"
            >
              Buy Extra Login
            </button>
          )}
        </div>

        {showBuy && (
          <div className="space-y-2.5">
            {EXTRA_PLANS.map((plan) => (
              <form action={extraFormAction} key={plan.key}>
                <input type="hidden" name="tenantId" value={tenant.id} />
                <input type="hidden" name="slug" value={tenant.slug} />
                <input type="hidden" name="planKey" value={plan.key} />
                <button
                  type="submit"
                  disabled={extraPending}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-[#14B8A6] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">{plan.label}</span>
                    <span className="block text-xs text-slate-500">{plan.sub}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-base font-bold text-[#0F766E]">{plan.total}</span>
                    <span className="block text-[10px] text-slate-400">{plan.base} + 18% GST</span>
                  </span>
                </button>
              </form>
            ))}

            {extraState.status === 'error' && <p className="text-sm text-red-500">{extraState.error}</p>}
            {extraPending && <p className="text-sm text-slate-500">Taking you to secure payment…</p>}
          </div>
        )}
      </div>
    </div>
  )
}
