'use client'

import { useMemo, useState, useTransition } from 'react'
import { addTransporter, updateTransporter, deleteTransporter } from '../actions'
import type { Transporter, TransporterType } from '../types'

interface Props {
  tenantId: string
  transporters: Transporter[]
  onAdded: (t: Transporter) => void
  onUpdated: (t: Transporter) => void
  onDeleted: (id: string) => void
}

type ModalMode = { type: 'add' } | { type: 'edit'; transporter: Transporter }

const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#14B8A6] focus:ring-2 focus:ring-[#14B8A6]/20'
const labelCls = 'block text-xs font-medium text-slate-600 mb-1'

export default function TransportersSection({ tenantId, transporters, onAdded, onUpdated, onDeleted }: Props) {
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState<ModalMode | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  // Form state
  const [tType, setTType] = useState<TransporterType>('courier')

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return transporters
    return transporters.filter(t =>
      t.name.toLowerCase().includes(q) || t.branch.toLowerCase().includes(q)
    )
  }, [transporters, query])

  function openAdd() {
    setTType('courier')
    setFormError(null)
    setModal({ type: 'add' })
  }

  function openEdit(t: Transporter) {
    setTType(t.type)
    setFormError(null)
    setModal({ type: 'edit', transporter: t })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!modal) return
    const fd = new FormData(e.currentTarget)
    const name = (fd.get('name') as string).trim()

    if (!name) {
      setFormError('Name is required.')
      return
    }
    setFormError(null)

    const input = {
      type: tType,
      name,
      branch: '',
      mode: null,
      freight: null,
      lr: null,
    }

    startTransition(async () => {
      if (modal.type === 'add') {
        const r = await addTransporter(tenantId, input)
        if (r.success) { onAdded(r.data); setModal(null) }
        else setFormError(r.error)
      } else {
        const r = await updateTransporter(modal.transporter.id, input)
        if (r.success) { onUpdated(r.data); setModal(null) }
        else setFormError(r.error)
      }
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const r = await deleteTransporter(id)
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
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search transporters…" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#14B8A6] focus:ring-2 focus:ring-[#14B8A6]/20" />
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 rounded-lg bg-[#0F766E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d6b63] transition">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
          Add Transporter
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            {query ? `No transporters match "${query}"` : 'No transporters yet.'}
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Type</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-cell">Mode</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 lg:table-cell">Branch</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 xl:table-cell">Freight</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 xl:table-cell">LR</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(t => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-800">{t.name}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.type === 'courier' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
                      {t.type === 'courier' ? 'Courier' : 'Transporter'}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{t.mode ?? '—'}</td>
                  <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">{t.branch || '—'}</td>
                  <td className="hidden px-4 py-3 text-slate-600 xl:table-cell">{t.freight ?? '—'}</td>
                  <td className="hidden px-4 py-3 text-slate-600 xl:table-cell">{t.lr ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => openEdit(t)} className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 transition">Edit</button>
                      <button onClick={() => setDeleteId(t.id)} className="rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 transition">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-bold text-slate-800">{modal.type === 'add' ? 'Add Transporter' : 'Edit Transporter'}</h2>
              <button onClick={() => setModal(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {/* Type toggle */}
              <div>
                <label className={labelCls}>Type *</label>
                <div className="flex rounded-lg border border-slate-200 p-1 gap-1">
                  {(['courier', 'transporter'] as TransporterType[]).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTType(t)}
                      className={`flex-1 rounded-md py-2 text-sm font-medium capitalize transition ${tType === t ? 'bg-[#0F766E] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      {t === 'courier' ? 'Courier' : 'Transporter'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Name *</label>
                <input name="name" required defaultValue={modal.type === 'edit' ? modal.transporter.name : ''} className={inputCls} placeholder="DTDC, Blue Dart…" />
              </div>

              {formError && <p className="text-sm text-red-500">{formError}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModal(null)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" disabled={isPending} className="flex-1 rounded-lg bg-[#0F766E] py-2.5 text-sm font-semibold text-white hover:bg-[#0d6b63] disabled:opacity-60 transition">
                  {isPending ? 'Saving…' : modal.type === 'add' ? 'Add' : 'Save'}
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
            <h3 className="text-base font-bold text-slate-800">Delete transporter?</h3>
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
