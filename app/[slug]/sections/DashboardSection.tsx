'use client'

import Image from 'next/image'
import type { Tenant, Customer, Transporter } from '../types'
import type { Section } from '../DashboardShell'

interface Props {
  tenant: Tenant
  customers: Customer[]
  transporters: Transporter[]
  onNavigate: (section: Section) => void
}

export default function DashboardSection({ tenant, customers, transporters, onNavigate }: Props) {
  const stats = [
    { label: 'Total Customers', value: customers.length, color: 'bg-blue-50 text-blue-700', icon: '👥' },
    { label: 'Total Transporters', value: transporters.length, color: 'bg-purple-50 text-purple-700', icon: '🚚' },
    { label: 'Prints This Month', value: tenant.prints_month ?? 0, color: 'bg-teal-50 text-teal-700', icon: '🖨️' },
    { label: 'Prints Lifetime', value: tenant.prints_lifetime ?? 0, color: 'bg-amber-50 text-amber-700', icon: '📦' },
  ]

  const defaultContact = (c: Customer) => c.contacts?.find(x => x.is_default) ?? c.contacts?.[0]

  return (
    <div className="p-6 space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">{s.label}</p>
                <p className="mt-1.5 text-3xl font-bold text-slate-800">{s.value}</p>
              </div>
              <span className="text-2xl">{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Company info */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          {tenant.logo_url ? (
            <Image
              src={tenant.logo_url}
              alt={tenant.name}
              width={56}
              height={56}
              className="h-14 w-14 rounded-xl object-contain border border-slate-100"
              unoptimized
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#0F766E] text-2xl font-bold text-white">
              {tenant.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-lg font-bold text-slate-800">{tenant.name}</h2>
            <p className="text-sm text-slate-500">{tenant.address}</p>
            <p className="text-sm text-slate-500">
              {tenant.pin}, {tenant.state} &mdash; {tenant.phone}
            </p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-500 uppercase tracking-wider">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => onNavigate('print')}
            className="flex items-center gap-2 rounded-lg bg-[#0F766E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0d6b63] transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a1 1 0 001 1h8a1 1 0 001-1v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1zm2 0h6v3H7V4zm-1 9h8v3H6v-3zm2-4a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" /></svg>
            Print Address
          </button>
          <button
            onClick={() => onNavigate('customers')}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#0F766E]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
            Add Customer
          </button>
          <button
            onClick={() => onNavigate('transporters')}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#0F766E]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
            Add Transporter
          </button>
        </div>
      </div>

      {/* Recent customers preview */}
      {customers.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-500 uppercase tracking-wider">Recent Customers</h3>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            {customers.slice(0, 5).map((c, i) => {
              const dc = defaultContact(c)
              return (
                <div key={c.id} className={`flex items-center justify-between px-5 py-3 ${i < 4 && i < customers.length - 1 ? 'border-b border-slate-100' : ''}`}>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{c.company_name}</p>
                    <p className="text-xs text-slate-500">{c.pin}, {c.state}</p>
                  </div>
                  {dc && (
                    <p className="text-xs text-slate-500">{dc.name} — {dc.phone}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
