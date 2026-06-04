'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import type { Tenant } from '../types'
import { updateExtraPhones } from '../actions'

interface Props {
  tenant: Tenant
  onExtraPhonesUpdated: (phones: string[]) => void
}

function LockBadge() {
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
      </svg>
      Locked
    </span>
  )
}

export default function ProfileSection({ tenant, onExtraPhonesUpdated }: Props) {
  const [phones, setPhones] = useState<string[]>(
    Array.from({ length: 3 }, (_, i) => tenant.extra_phones?.[i] ?? '')
  )
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateExtraPhones(tenant.id, phones.filter(Boolean))
      if (result.success) {
        onExtraPhonesUpdated(phones.filter(Boolean))
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        setError(result.error)
      }
    })
  }

  const fieldClass = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 cursor-not-allowed'

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Company Profile</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Locked fields can only be changed by emailing{' '}
          <a href="mailto:support@jbssindia.com" className="text-[#0F766E] hover:underline">
            support@jbssindia.com
          </a>
        </p>
      </div>

      {/* Logo */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-5">
          {tenant.logo_url ? (
            <Image
              src={tenant.logo_url}
              alt={tenant.name}
              width={72}
              height={72}
              className="h-18 w-18 rounded-xl border border-slate-100 object-contain"
              unoptimized
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#0F766E] text-2xl font-bold text-white">
              {tenant.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-bold text-slate-800 text-lg">{tenant.name}</p>
            <p className="text-sm text-slate-500 mt-0.5">Company Logo</p>
            <LockBadge />
          </div>
        </div>
      </div>

      {/* Locked fields */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">Business Details</h3>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Company Name <LockBadge />
          </label>
          <input readOnly value={tenant.name} className={fieldClass} />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Address <LockBadge />
          </label>
          <input readOnly value={tenant.address} className={fieldClass} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              PIN Code <LockBadge />
            </label>
            <input readOnly value={tenant.pin} className={fieldClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              State <LockBadge />
            </label>
            <input readOnly value={tenant.state} className={fieldClass} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Primary Phone <LockBadge />
          </label>
          <input readOnly value={tenant.phone} className={fieldClass} />
        </div>
      </div>

      {/* Editable extra phones */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Additional Phone Numbers</h3>
          <p className="text-xs text-slate-500 mt-0.5">Up to 3 extra numbers shown on printed labels.</p>
        </div>

        {[0, 1, 2].map(i => (
          <div key={i}>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Additional Phone {i + 1}
            </label>
            <input
              type="tel"
              value={phones[i]}
              onChange={e => {
                const updated = [...phones]
                updated[i] = e.target.value
                setPhones(updated)
              }}
              placeholder="+91 98765 43210"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#14B8A6] focus:ring-2 focus:ring-[#14B8A6]/20"
            />
          </div>
        ))}

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded-lg bg-[#0F766E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d6b63] disabled:opacity-60 transition"
          >
            {isPending ? 'Saving…' : 'Save Phone Numbers'}
          </button>
          {saved && (
            <span className="text-sm text-[#0F766E] font-medium">✓ Saved</span>
          )}
        </div>
      </div>
    </div>
  )
}
