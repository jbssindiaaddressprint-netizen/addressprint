'use client'

import { useMemo, useState, useTransition } from 'react'
import { getStateFromPin } from '@/lib/pinLookup'
import { addCustomer, updateCustomer, deleteCustomer } from '../actions'
import type { Customer, ContactPerson } from '../types'

interface Props {
  tenantId: string
  tenantName: string
  customers: Customer[]
  onAdded: (c: Customer) => void
  onUpdated: (c: Customer) => void
  onDeleted: (id: string) => void
  onPrintCustomer: (c: Customer) => void
}

type ModalMode = { type: 'add' } | { type: 'edit'; customer: Customer }

const EMPTY_CONTACT: ContactPerson = { name: '', phone: '', is_default: true }

function defaultContact(c: Customer) {
  return c.contacts?.find(x => x.is_default) ?? c.contacts?.[0] ?? null
}

const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#14B8A6] focus:ring-2 focus:ring-[#14B8A6]/20'
const labelCls = 'block text-xs font-medium text-slate-600 mb-1'

export default function CustomersSection({ tenantId, tenantName, customers, onAdded, onUpdated, onDeleted, onPrintCustomer }: Props) {
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState<ModalMode | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  // Contact form state
  const [contacts, setContacts] = useState<ContactPerson[]>([{ ...EMPTY_CONTACT }])
  const [pin, setPin] = useState('')
  const [stateVal, setStateVal] = useState('')

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return customers
    return customers.filter(c =>
      c.company_name.toLowerCase().includes(q) ||
      c.address.toLowerCase().includes(q) ||
      c.pin.includes(q)
    )
  }, [customers, query])

  function csvEscape(val: string | null | undefined) {
    const s = val == null ? '' : String(val)
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
    return s
  }

  function handleExport() {
    const headers = ['Company Name', 'Address', 'PIN Code', 'State', 'Country', 'Default Contact Name', 'Default Contact Phone', 'All Contacts']
    const rows = customers.map(c => {
      const dc = defaultContact(c)
      const allContacts = (c.contacts || [])
        .map(ct => `${ct.name || '-'} - ${ct.phone || '-'}${ct.is_default ? ' (Default)' : ''}`)
        .join('; ')
      return [c.company_name, c.address, c.pin, c.state, c.country, dc?.name || '', dc?.phone || '', allContacts]
    })
    const csvBody = [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n')
    const blob = new Blob(['\uFEFF' + csvBody], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const safeName = (tenantName || 'AddressPrint').replace(/[^a-zA-Z0-9]+/g, '_')
    const dateStr = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `${safeName}_Customers_${dateStr}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function openAdd() {
    setContacts([{ ...EMPTY_CONTACT }])
    setPin('')
    setStateVal('')
    setFormError(null)
    setModal({ type: 'add' })
  }

  function openEdit(c: Customer) {
    setContacts(c.contacts?.length ? c.contacts.map(x => ({ ...x })) : [{ ...EMPTY_CONTACT }])
    setPin(c.pin)
    setStateVal(c.state)
    setFormError(null)
    setModal({ type: 'edit', customer: c })
  }

  function handlePinChange(val: string) {
    const clean = val.replace(/\D/g, '').slice(0, 6)
    setPin(clean)
    if (clean.length >= 2) {
      const s = getStateFromPin(clean)
      if (s) setStateVal(s)
    }
    if (clean.length === 0) setStateVal('')
  }

  function addContact() {
    setContacts(p => [...p, { name: '', phone: '', is_default: false }])
  }

  function removeContact(i: number) {
    setContacts(p => {
      const next = p.filter((_, idx) => idx !== i)
      if (p[i].is_default && next.length > 0) next[0].is_default = true
      return next
    })
  }

  function setDefault(i: number) {
    setContacts(p => p.map((c, idx) => ({ ...c, is_default: idx === i })))
  }

  function updateContactField(i: number, field: 'name' | 'phone', val: string) {
    setContacts(p => p.map((c, idx) => idx === i ? { ...c, [field]: val } : c))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!modal) return
    const fd = new FormData(e.currentTarget)
    const input = {
      company_name: (fd.get('company_name') as string).trim(),
      address: (fd.get('address') as string).trim(),
      pin,
      state: stateVal.trim(),
      country: (fd.get('country') as string).trim() || 'India',
      contacts,
    }
    if (!input.company_name || !input.address || !input.pin || !input.state) {
      setFormError('Please fill in all required fields.')
      return
    }
    setFormError(null)
    startTransition(async () => {
      if (modal.type === 'add') {
        const r = await addCustomer(tenantId, input)
        if (r.success) { onAdded(r.data); setModal(null) }
        else setFormError(r.error)
      } else {
        const r = await updateCustomer(modal.customer.id, input)
        if (r.success) { onUpdated(r.data); setModal(null) }
        else setFormError(r.error)
      }
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const r = await deleteCustomer(id)
      if (r.success) { onDeleted(id); setDeleteId(null) }
    })
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7 7 0 1116.65 2.35a7 7 0 010 14.3z" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search customers…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#14B8A6] focus:ring-2 focus:ring-[#14B8A6]/20"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={customers.length === 0}
            title={customers.length === 0 ? 'No customers to export' : 'Download all customers as a spreadsheet'}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm6.293-12.707a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 7.414V13a1 1 0 11-2 0V7.414L7.707 8.707a1 1 0 01-1.414-1.414l3-3z" clipRule="evenodd" /></svg>
            Export
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 rounded-lg bg-[#0F766E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d6b63] transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
            Add Customer
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            {query ? `No customers match "${query}"` : 'No customers yet. Add your first one.'}
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Company / Name</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-cell">Address</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">PIN</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 lg:table-cell">State</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 xl:table-cell">Default Contact</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(c => {
                const dc = defaultContact(c)
                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{c.company_name}</p>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <p className="max-w-[180px] truncate text-slate-600">{c.address}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.pin}</td>
                    <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">{c.state}</td>
                    <td className="hidden px-4 py-3 xl:table-cell">
                      {dc ? (
                        <div>
                          <p className="text-slate-700 font-medium">{dc.name}</p>
                          <p className="text-xs text-slate-500">{dc.phone}</p>
                        </div>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => onPrintCustomer(c)} className="rounded px-2 py-1 text-xs font-medium text-[#0F766E] hover:bg-[#0F766E]/10 transition" title="Print label">Print</button>
                        <button onClick={() => openEdit(c)} className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 transition">Edit</button>
                        <button onClick={() => setDeleteId(c.id)} className="rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 transition">Delete</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-bold text-slate-800">
                {modal.type === 'add' ? 'Add Customer' : 'Edit Customer'}
              </h2>
              <button onClick={() => setModal(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className={labelCls}>Company Name *</label>
                <input name="company_name" required defaultValue={modal.type === 'edit' ? modal.customer.company_name : ''} className={inputCls} placeholder="Hitech Industries" />
              </div>
              <div>
                <label className={labelCls}>Address *</label>
                <input name="address" required defaultValue={modal.type === 'edit' ? modal.customer.address : ''} className={inputCls} placeholder="123 Industrial Area, Rajkot" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>PIN Code *</label>
                  <input
                    value={pin}
                    onChange={e => handlePinChange(e.target.value)}
                    inputMode="numeric"
                    maxLength={6}
                    required
                    className={inputCls}
                    placeholder="360001"
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    State *{stateVal && <span className="ml-1 text-[#0F766E] font-normal">auto-filled</span>}
                  </label>
                  <input value={stateVal} onChange={e => setStateVal(e.target.value)} required className={inputCls} placeholder="Gujarat" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Country</label>
                <input name="country" defaultValue={modal.type === 'edit' ? modal.customer.country : 'India'} className={inputCls} />
              </div>

              {/* Contacts */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls + ' mb-0'}>Contact Persons</label>
                  <button type="button" onClick={addContact} className="text-xs font-semibold text-[#0F766E] hover:underline">+ Add Contact</button>
                </div>
                <div className="space-y-2">
                  {contacts.map((ct, i) => (
                    <div key={i} className="rounded-lg border border-slate-200 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDefault(i)}
                            className={`h-4 w-4 rounded-full border-2 transition ${ct.is_default ? 'border-[#0F766E] bg-[#0F766E]' : 'border-slate-300'}`}
                            title="Set as default"
                          />
                          <span className="text-xs text-slate-500">{ct.is_default ? 'Default' : 'Set default'}</span>
                        </div>
                        {contacts.length > 1 && (
                          <button type="button" onClick={() => removeContact(i)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={ct.name}
                          onChange={e => updateContactField(i, 'name', e.target.value)}
                          placeholder="Name"
                          className={inputCls}
                        />
                        <input
                          value={ct.phone}
                          onChange={e => updateContactField(i, 'phone', e.target.value)}
                          placeholder="Phone"
                          type="tel"
                          className={inputCls}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {formError && <p className="text-sm text-red-500">{formError}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModal(null)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" disabled={isPending} className="flex-1 rounded-lg bg-[#0F766E] py-2.5 text-sm font-semibold text-white hover:bg-[#0d6b63] disabled:opacity-60 transition">
                  {isPending ? 'Saving…' : modal.type === 'add' ? 'Add Customer' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-800">Delete customer?</h3>
            <p className="mt-1 text-sm text-slate-500">This action cannot be undone.</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} disabled={isPending} className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition">
                {isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
