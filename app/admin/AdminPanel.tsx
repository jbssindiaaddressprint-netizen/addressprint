'use client'

import { useMemo, useState, useTransition } from 'react'
import { setTenantActive, updateTenantCaps, updateTenantEmail } from './actions'
import { logoutAdmin } from './login/actions'
import type { AdminTenant } from './types'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Mirrors the tenant-facing SubscriptionBanner so JBSS sees the same status the tenant sees.
function BillingStatus({ tenant }: { tenant: AdminTenant }) {
  const { subscription_status, trial_ends_at, current_period_end, subscription_amount } = tenant

  // Pre-existing tenants never moved onto the billing system have no dates at all —
  // label them clearly as legacy/free rather than implying they're on a real trial.
  if (!trial_ends_at && !current_period_end) {
    return <p className="mt-1 text-xs text-slate-500">Legacy (no billing)</p>
  }

  if (subscription_status === 'cancelled') {
    return <p className="mt-1 text-xs text-red-400">Cancelled</p>
  }

  if (subscription_status === 'trial' && trial_ends_at) {
    return <p className="mt-1 text-xs text-amber-400">Trial · ends {formatDate(trial_ends_at)}</p>
  }

  if (subscription_status === 'active' && current_period_end) {
    return (
      <p className="mt-1 text-xs text-emerald-400">
        Renews {formatDate(current_period_end)}
        {subscription_amount != null ? ` · ₹${subscription_amount}` : ''}
      </p>
    )
  }

  return <p className="mt-1 text-xs text-slate-500">—</p>
}

interface Props {
  tenants: AdminTenant[]
  customerCounts: Record<string, number>
}

export default function AdminPanel({ tenants, customerCounts }: Props) {
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState<Record<string, { customerLimit: string; paidLogins: string }>>({})
  const [editingEmail, setEditingEmail] = useState<Record<string, string>>({})
  const [rowError, setRowError] = useState<Record<string, string>>({})
  const [savedFlash, setSavedFlash] = useState<Record<string, boolean>>({})

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return tenants
    return tenants.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.slug.toLowerCase().includes(q) ||
      (t.email ?? '').toLowerCase().includes(q)
    )
  }, [tenants, query])

  function startEdit(t: AdminTenant) {
    setEditing(prev => ({
      ...prev,
      [t.id]: { customerLimit: String(t.customer_limit), paidLogins: String(t.paid_logins) },
    }))
  }

  function cancelEdit(id: string) {
    setEditing(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setRowError(prev => ({ ...prev, [id]: '' }))
  }

  function saveCaps(id: string) {
    const draft = editing[id]
    if (!draft) return
    const customerLimit = parseInt(draft.customerLimit, 10)
    const paidLogins = parseInt(draft.paidLogins, 10)

    startTransition(async () => {
      const r = await updateTenantCaps(id, customerLimit, paidLogins)
      if (r.success) {
        cancelEdit(id)
        setSavedFlash(prev => ({ ...prev, [id]: true }))
        setTimeout(() => setSavedFlash(prev => ({ ...prev, [id]: false })), 2000)
      } else {
        setRowError(prev => ({ ...prev, [id]: r.error }))
      }
    })
  }

  function startEditEmail(t: AdminTenant) {
    setEditingEmail(prev => ({ ...prev, [t.id]: t.email ?? '' }))
  }

  function cancelEditEmail(id: string) {
    setEditingEmail(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setRowError(prev => ({ ...prev, [id]: '' }))
  }

  function saveEmail(id: string) {
    const value = editingEmail[id]
    if (value === undefined) return
    startTransition(async () => {
      const r = await updateTenantEmail(id, value)
      if (r.success) {
        cancelEditEmail(id)
        setSavedFlash(prev => ({ ...prev, [id]: true }))
        setTimeout(() => setSavedFlash(prev => ({ ...prev, [id]: false })), 2000)
      } else {
        setRowError(prev => ({ ...prev, [id]: r.error }))
      }
    })
  }

  function toggleActive(t: AdminTenant) {
    startTransition(async () => {
      await setTenantActive(t.id, !t.is_active)
    })
  }

  const inputCls = 'w-20 rounded-md border border-[#334155] bg-[#1E293B] px-2 py-1 text-sm text-white outline-none focus:ring-2 focus:ring-[#14B8A6]'

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">AddressPrint — Admin</h1>
          <p className="mt-1 text-sm text-slate-400">{tenants.length} tenant{tenants.length === 1 ? '' : 's'} total</p>
        </div>
        <form action={logoutAdmin}>
          <button
            type="submit"
            className="rounded-lg border border-[#334155] px-4 py-2 text-sm font-medium text-slate-300 hover:bg-[#1E293B] transition"
          >
            Log Out
          </button>
        </form>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name, slug, or email…"
          className="w-full max-w-xs rounded-lg border border-[#334155] bg-[#1E293B] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-[#14B8A6]"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[#334155]">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-[#1E293B]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-400">Tenant</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-400">Contact</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-400">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-400">Customers</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-400">Paid Logins</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-400">Prints (month / lifetime)</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#334155]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">
                  {query ? `No tenants match "${query}"` : 'No tenants yet.'}
                </td>
              </tr>
            ) : (
              filtered.map(t => {
                const draft = editing[t.id]
                const count = customerCounts[t.id] ?? 0
                return (
                  <tr key={t.id} className="text-slate-200">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white">{t.name}</p>
                      <a
                        href={`https://addressprint.vercel.app/${t.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#14B8A6] hover:underline"
                      >
                        /{t.slug}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {editingEmail[t.id] !== undefined ? (
                        <div className="flex flex-col gap-1">
                          <input
                            value={editingEmail[t.id]}
                            onChange={e => setEditingEmail(prev => ({ ...prev, [t.id]: e.target.value }))}
                            placeholder="email@company.com"
                            className="w-40 rounded-md border border-[#334155] bg-[#1E293B] px-2 py-1 text-xs text-white outline-none focus:ring-2 focus:ring-[#14B8A6]"
                          />
                          <div className="flex items-center gap-2">
                            <button onClick={() => cancelEditEmail(t.id)} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
                            <button onClick={() => saveEmail(t.id)} disabled={isPending} className="text-xs font-semibold text-[#14B8A6] hover:underline">Save</button>
                          </div>
                          {rowError[t.id] && <p className="text-xs text-red-400">{rowError[t.id]}</p>}
                        </div>
                      ) : (
                        <div className="group flex items-center gap-1.5">
                          <div>
                            <p>{t.email || <span className="italic text-slate-500">No email set</span>}</p>
                            <p className="text-xs">{t.phone}</p>
                          </div>
                          <button
                            onClick={() => startEditEmail(t)}
                            className="text-xs text-slate-500 opacity-0 group-hover:opacity-100 hover:text-[#14B8A6] transition"
                            title="Edit email"
                          >
                            ✎
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(t)}
                        disabled={isPending}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          t.is_active
                            ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                            : 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                        }`}
                      >
                        {t.is_active ? 'Active' : 'Inactive'}
                      </button>
                      <BillingStatus tenant={t} />
                    </td>
                    <td className="px-4 py-3">
                      {draft ? (
                        <input
                          value={draft.customerLimit}
                          onChange={e => setEditing(prev => ({ ...prev, [t.id]: { ...prev[t.id], customerLimit: e.target.value.replace(/\D/g, '') } }))}
                          inputMode="numeric"
                          className={inputCls}
                        />
                      ) : (
                        <span>{count} / {t.customer_limit}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {draft ? (
                        <input
                          value={draft.paidLogins}
                          onChange={e => setEditing(prev => ({ ...prev, [t.id]: { ...prev[t.id], paidLogins: e.target.value.replace(/\D/g, '') } }))}
                          inputMode="numeric"
                          className={inputCls}
                        />
                      ) : (
                        <span>{t.paid_logins}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {t.prints_month} / {t.prints_lifetime}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {draft ? (
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => cancelEdit(t.id)}
                              className="rounded px-2 py-1 text-xs font-medium text-slate-400 hover:bg-[#334155] transition"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => saveCaps(t.id)}
                              disabled={isPending}
                              className="rounded bg-[#0F766E] px-3 py-1 text-xs font-semibold text-white hover:bg-[#0d6b63] transition disabled:opacity-60"
                            >
                              Save
                            </button>
                          </div>
                          {rowError[t.id] && <p className="text-xs text-red-400">{rowError[t.id]}</p>}
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          {savedFlash[t.id] && <span className="text-xs text-emerald-400">Saved</span>}
                          <button
                            onClick={() => startEdit(t)}
                            className="rounded px-2 py-1 text-xs font-medium text-slate-300 hover:bg-[#334155] transition"
                          >
                            Edit Limits
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
