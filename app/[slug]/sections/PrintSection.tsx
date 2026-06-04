'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { incrementPrintCount } from '../actions'
import type { Customer, Transporter, Tenant, LabelSize, CareSymbol } from '../types'

interface Props {
  tenant: Tenant
  customers: Customer[]
  transporters: Transporter[]
  defaultCustomer?: Customer
  onPrintDone: (counts: { prints_month: number; prints_lifetime: number }) => void
}

const SIZES: LabelSize[] = ['A4', 'A5', 'A6', 'A7', 'DL Env', 'C5 Env', 'C4 Env']
const CARE_SYMBOLS: CareSymbol[] = ['Fragile', 'Glass', 'Keep Dry', 'This Side Up', 'Do Not Bend']
const FREIGHT_OPTS = ['To Pay', 'Paid']
const LR_OPTS = ['CC Attached', 'Self', 'Not Attached', 'Through Bank']
const MODE_OPTS = ['Air', 'Surface']

// mm dimensions [width, height]
const SIZE_DIMS: Record<LabelSize, [number, number]> = {
  'A4': [210, 297], 'A5': [148, 210], 'A6': [105, 148], 'A7': [74, 105],
  'DL Env': [220, 110], 'C5 Env': [229, 162], 'C4 Env': [324, 229],
}

const CARE_ICONS: Record<CareSymbol, string> = {
  'Fragile': '⚠', 'Glass': '◈', 'Keep Dry': '☂', 'This Side Up': '⬆', 'Do Not Bend': '⊘',
}

function buildPrintHTML(opts: {
  customer: Customer
  selectedContacts: number[]
  transporter: Transporter | null
  branch: string
  mode: string
  freight: string
  lr: string
  showFrom: boolean
  selectedPhones: string[]
  size: LabelSize
  careSymbols: CareSymbol[]
  tenant: Tenant
}): string {
  const { customer, selectedContacts, transporter, branch, mode, freight, lr, showFrom, selectedPhones, size, careSymbols, tenant } = opts
  const [w, h] = SIZE_DIMS[size]
  const landscape = w > h
  const baseFont = w <= 74 ? 8 : w <= 105 ? 9 : w <= 148 ? 10.5 : 12

  const contacts = customer.contacts.filter((_, i) => selectedContacts.includes(i))
  const contactLines = contacts.map(c => `${c.name}${c.phone ? ` &mdash; ${c.phone}` : ''}`).join('<br>')

  const transporterHtml = transporter ? `
    <div style="border-bottom:1.5pt solid #000;padding-bottom:5pt;margin-bottom:6pt;display:flex;gap:10pt;flex-wrap:wrap;align-items:baseline;">
      <span style="font-weight:900;font-size:0.65em;letter-spacing:.12em;text-transform:uppercase;">${transporter.type === 'courier' ? 'COURIER' : 'TRANSPORT'}</span>
      <span style="font-weight:700;">${transporter.name}</span>
      ${branch ? `<span style="font-size:.85em;color:#444;">Branch: ${branch}</span>` : ''}
      ${transporter.type === 'courier' && mode ? `<span style="font-size:.85em;color:#444;">Mode: ${mode}</span>` : ''}
      ${transporter.type === 'transporter' && freight ? `<span style="font-size:.85em;color:#444;">Freight: ${freight}</span>` : ''}
      ${transporter.type === 'transporter' && lr ? `<span style="font-size:.85em;color:#444;">LR: ${lr}</span>` : ''}
    </div>` : ''

  const careHtml = careSymbols.length > 0 ? `
    <div style="display:flex;flex-direction:${landscape ? 'row' : 'column'};gap:3pt;${landscape ? 'margin-left:auto;' : 'margin-bottom:8pt;'}">
      ${careSymbols.map(s => `
        <div style="border:1pt solid #000;padding:3pt 4pt;text-align:center;min-width:32pt;">
          <div style="font-size:1.3em;">${CARE_ICONS[s]}</div>
          <div style="font-size:.55em;text-transform:uppercase;letter-spacing:.05em;margin-top:1pt;">${s}</div>
        </div>`).join('')}
    </div>` : ''

  const phones = selectedPhones.length > 0 ? selectedPhones : [tenant.phone, ...(tenant.extra_phones ?? [])].filter(Boolean)

  const fromHtml = showFrom ? `
    <div style="border-top:1pt dashed #888;margin-top:auto;padding-top:5pt;">
      <div style="font-weight:900;font-size:.6em;letter-spacing:.15em;text-transform:uppercase;margin-bottom:2pt;">From</div>
      <div style="font-weight:700;font-size:.9em;">${tenant.name}</div>
      <div style="font-size:.75em;color:#333;">${tenant.address}, ${tenant.pin} &mdash; ${tenant.state}</div>
      <div style="font-size:.75em;color:#333;">${phones.join(' / ')}</div>
    </div>` : ''

  const toBlock = `
    <div style="flex:1;">
      <div style="font-weight:900;font-size:.6em;letter-spacing:.2em;text-transform:uppercase;border-bottom:2pt solid #000;padding-bottom:2pt;margin-bottom:6pt;">To</div>
      <div style="font-weight:900;font-size:${landscape ? 1.8 : 2.2}em;line-height:1.1;margin-bottom:4pt;">${customer.company_name}</div>
      ${contactLines ? `<div style="font-size:.9em;margin-bottom:4pt;line-height:1.5;">${contactLines}</div>` : ''}
      <div style="font-size:.9em;line-height:1.6;">${customer.address}</div>
      <div style="font-size:.85em;color:#333;margin-top:2pt;">${customer.pin} &mdash; ${customer.state}, ${customer.country}</div>
    </div>`

  const mainContent = landscape
    ? `<div style="display:flex;flex:1;gap:8pt;align-items:flex-start;">
        ${showFrom ? `
          <div style="min-width:35%;border-right:1pt dashed #aaa;padding-right:8pt;">
            <div style="font-weight:900;font-size:.6em;letter-spacing:.15em;text-transform:uppercase;margin-bottom:3pt;">From</div>
            <div style="font-weight:700;font-size:.9em;">${tenant.name}</div>
            <div style="font-size:.75em;color:#333;">${tenant.address}, ${tenant.pin} &mdash; ${tenant.state}</div>
            <div style="font-size:.75em;color:#333;">${phones.join(' / ')}</div>
          </div>` : ''}
        ${toBlock}
        ${careHtml}
      </div>`
    : `<div style="flex:1;">
        ${careHtml}
        ${toBlock}
      </div>
      ${fromHtml}`

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Address Label</title>
<style>
  @page { size: ${w}mm ${h}mm; margin: 6mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { font-family: Arial, Helvetica, sans-serif; font-size: ${baseFont}pt; width: ${w}mm; min-height: ${h}mm; }
  .wrap { display: flex; flex-direction: column; min-height: ${h - 12}mm; }
  .footer { font-size: .5em; text-align: right; color: #bbb; padding-top: 4pt; margin-top: auto; }
</style>
</head>
<body>
<div class="wrap">
  ${transporterHtml}
  ${mainContent}
  <div class="footer">AddressPrint &mdash; BizKit by JBSS India</div>
</div>
<script>
  window.onload = function() { window.print(); };
  window.onafterprint = function() { window.close(); };
<\/script>
</body>
</html>`
}

export default function PrintSection({ tenant, customers, transporters, defaultCustomer, onPrintDone }: Props) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(defaultCustomer?.id ?? '')
  const [selectedContacts, setSelectedContacts] = useState<number[]>([])
  const [selectedTransporterId, setSelectedTransporterId] = useState('')
  const [branch, setBranch] = useState('')
  const [mode, setMode] = useState('Air')
  const [freight, setFreight] = useState('To Pay')
  const [lr, setLr] = useState('Self')
  const [showFrom, setShowFrom] = useState(true)
  const [selectedPhones, setSelectedPhones] = useState<string[]>([])
  const [size, setSize] = useState<LabelSize>('A4')
  const [careSymbols, setCareSymbols] = useState<CareSymbol[]>([])
  const [printError, setPrintError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const customer = customers.find(c => c.id === selectedCustomerId) ?? null
  const transporter = transporters.find(t => t.id === selectedTransporterId) ?? null
  const allPhones = [tenant.phone, ...(tenant.extra_phones ?? [])].filter(Boolean)

  // Reset contacts when customer changes
  useEffect(() => {
    if (customer) {
      setSelectedContacts(customer.contacts.map((_, i) => i))
    } else {
      setSelectedContacts([])
    }
  }, [selectedCustomerId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset transporter options when transporter changes
  useEffect(() => {
    if (transporter) {
      setBranch(transporter.branch ?? '')
      setMode(transporter.mode ?? 'Air')
      setFreight(transporter.freight ?? 'To Pay')
      setLr(transporter.lr ?? 'Self')
    }
  }, [selectedTransporterId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset phones when showFrom changes
  useEffect(() => {
    if (showFrom) setSelectedPhones([...allPhones])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFrom])

  // Init phones on mount
  useEffect(() => { setSelectedPhones([...allPhones]) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleContact(i: number) {
    setSelectedContacts(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i])
  }

  function togglePhone(phone: string) {
    setSelectedPhones(p => p.includes(phone) ? p.filter(x => x !== phone) : [...p, phone])
  }

  function toggleCare(sym: CareSymbol) {
    setCareSymbols(p => p.includes(sym) ? p.filter(x => x !== sym) : [...p, sym])
  }

  function handlePrint() {
    if (!customer) { setPrintError('Please select a customer.'); return }
    setPrintError(null)

    const html = buildPrintHTML({
      customer, selectedContacts, transporter, branch, mode, freight, lr,
      showFrom, selectedPhones, size, careSymbols, tenant,
    })

    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) { setPrintError('Popup blocked. Please allow popups for this site.'); return }
    win.document.write(html)
    win.document.close()

    startTransition(async () => {
      const r = await incrementPrintCount(tenant.id)
      if (r.success) onPrintDone(r.data)
    })
  }

  // Preview scale
  const [pw, ph] = SIZE_DIMS[size]
  const landscape = pw > ph
  const PREVIEW_W = 320
  const scale = PREVIEW_W / (pw * 3.78)
  const previewH = Math.round(ph * 3.78 * scale)

  const sectionCls = 'mb-5'
  const headCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2'
  const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#14B8A6] focus:ring-2 focus:ring-[#14B8A6]/20 bg-white'
  const selectCls = inputCls

  return (
    <div className="flex h-full overflow-hidden">
      {/* Controls panel */}
      <div className="w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-5">

        {/* Customer */}
        <div className={sectionCls}>
          <p className={headCls}>Customer *</p>
          <select value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)} className={selectCls}>
            <option value="">— Select customer —</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
        </div>

        {/* Contacts */}
        {customer && customer.contacts.length > 0 && (
          <div className={sectionCls}>
            <p className={headCls}>Contacts</p>
            <div className="space-y-1.5">
              {customer.contacts.map((ct, i) => (
                <label key={i} className="flex items-center gap-2.5 cursor-pointer rounded-lg px-2 py-1.5 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={selectedContacts.includes(i)}
                    onChange={() => toggleContact(i)}
                    className="h-4 w-4 rounded accent-[#0F766E]"
                  />
                  <span className="text-sm text-slate-700">{ct.name}{ct.phone ? ` — ${ct.phone}` : ''}</span>
                  {ct.is_default && <span className="ml-auto text-[10px] font-semibold text-[#0F766E]">Default</span>}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Transporter */}
        <div className={sectionCls}>
          <p className={headCls}>Transporter (optional)</p>
          <select value={selectedTransporterId} onChange={e => setSelectedTransporterId(e.target.value)} className={selectCls}>
            <option value="">— None —</option>
            {transporters.map(t => <option key={t.id} value={t.id}>{t.name} ({t.type === 'courier' ? 'Courier' : 'Transport'})</option>)}
          </select>

          {transporter && (
            <div className="mt-3 space-y-2.5 rounded-lg bg-slate-50 p-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Branch</label>
                <input value={branch} onChange={e => setBranch(e.target.value)} className={inputCls} />
              </div>
              {transporter.type === 'courier' ? (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Mode</label>
                  <select value={mode} onChange={e => setMode(e.target.value)} className={selectCls}>
                    {MODE_OPTS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Freight</label>
                    <select value={freight} onChange={e => setFreight(e.target.value)} className={selectCls}>
                      {FREIGHT_OPTS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">LR</label>
                    <select value={lr} onChange={e => setLr(e.target.value)} className={selectCls}>
                      {LR_OPTS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* From toggle */}
        <div className={sectionCls}>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={showFrom} onChange={e => setShowFrom(e.target.checked)} className="h-4 w-4 rounded accent-[#0F766E]" />
            <span className="text-sm font-semibold text-slate-700">Include From address</span>
          </label>

          {showFrom && allPhones.length > 0 && (
            <div className="mt-2.5 space-y-1.5 rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500 mb-1.5">From phones</p>
              {allPhones.map(phone => (
                <label key={phone} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={selectedPhones.includes(phone)} onChange={() => togglePhone(phone)} className="h-4 w-4 rounded accent-[#0F766E]" />
                  <span className="text-sm text-slate-700">{phone}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Size chips */}
        <div className={sectionCls}>
          <p className={headCls}>Paper Size</p>
          <div className="flex flex-wrap gap-1.5">
            {SIZES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${size === s ? 'bg-[#0F766E] text-white' : 'border border-slate-200 text-slate-600 hover:border-[#0F766E] hover:text-[#0F766E]'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Care symbols */}
        <div className={sectionCls}>
          <p className={headCls}>Handle With Care</p>
          <div className="flex flex-wrap gap-1.5">
            {CARE_SYMBOLS.map(sym => (
              <button
                key={sym}
                type="button"
                onClick={() => toggleCare(sym)}
                className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${careSymbols.includes(sym) ? 'border-[#0F766E] bg-[#0F766E]/10 text-[#0F766E]' : 'border-slate-200 text-slate-600 hover:border-[#0F766E]'}`}
              >
                <span>{CARE_ICONS[sym]}</span>
                {sym}
              </button>
            ))}
          </div>
        </div>

        {printError && <p className="mb-3 text-sm text-red-500">{printError}</p>}

        {/* Action buttons */}
        <div className="space-y-2 sticky bottom-0 bg-white pt-2 border-t border-slate-100">
          <button
            onClick={handlePrint}
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F766E] py-3 text-sm font-bold text-white hover:bg-[#0d6b63] disabled:opacity-60 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a1 1 0 001 1h8a1 1 0 001-1v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1zm2 0h6v3H7V4zm-1 9h8v3H6v-3zm2-4a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" /></svg>
            {isPending ? 'Saving…' : 'Print'}
          </button>
          <button
            onClick={handlePrint}
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#0F766E] py-3 text-sm font-bold text-[#0F766E] hover:bg-[#0F766E]/5 disabled:opacity-60 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" /></svg>
            Save as PDF
          </button>
        </div>
      </div>

      {/* Preview panel */}
      <div className="flex-1 overflow-auto bg-slate-100 p-6 flex flex-col items-center">
        <p className="mb-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Live Preview — {size}</p>

        {!customer ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white px-8 py-16 text-center" style={{ width: PREVIEW_W }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-slate-400">Select a customer to preview the label</p>
          </div>
        ) : (
          <div className="shadow-2xl" style={{ width: PREVIEW_W, height: previewH, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              width: pw * 3.78,
              height: ph * 3.78,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              background: 'white',
              fontFamily: 'Arial, sans-serif',
              fontSize: pw <= 74 ? 8 : pw <= 105 ? 9 : pw <= 148 ? 10.5 : 12,
              display: 'flex',
              flexDirection: 'column',
              padding: '6mm',
              boxSizing: 'border-box',
            }}>
              {/* Transporter row */}
              {transporter && (
                <div style={{ borderBottom: '1.5px solid #000', paddingBottom: 6, marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline', fontSize: '0.85em' }}>
                  <span style={{ fontWeight: 900, fontSize: '0.65em', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{transporter.type === 'courier' ? 'COURIER' : 'TRANSPORT'}</span>
                  <span style={{ fontWeight: 700 }}>{transporter.name}</span>
                  {branch && <span style={{ color: '#444' }}>Branch: {branch}</span>}
                  {transporter.type === 'courier' && mode && <span style={{ color: '#444' }}>Mode: {mode}</span>}
                  {transporter.type === 'transporter' && freight && <span style={{ color: '#444' }}>Freight: {freight}</span>}
                  {transporter.type === 'transporter' && lr && <span style={{ color: '#444' }}>LR: {lr}</span>}
                </div>
              )}

              {/* Main area */}
              <div style={{ flex: 1, display: 'flex', flexDirection: landscape ? 'row' : 'column', gap: 8 }}>
                {/* FROM (landscape left) */}
                {landscape && showFrom && (
                  <div style={{ minWidth: '35%', borderRight: '1px dashed #aaa', paddingRight: 8 }}>
                    <div style={{ fontWeight: 900, fontSize: '0.6em', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 3 }}>From</div>
                    <div style={{ fontWeight: 700 }}>{tenant.name}</div>
                    <div style={{ fontSize: '0.8em', color: '#444' }}>{tenant.address}</div>
                    <div style={{ fontSize: '0.8em', color: '#444' }}>{tenant.pin} — {tenant.state}</div>
                    <div style={{ fontSize: '0.8em', color: '#444' }}>{(selectedPhones.length > 0 ? selectedPhones : allPhones).join(' / ')}</div>
                  </div>
                )}

                {/* TO block */}
                <div style={{ flex: 1 }}>
                  {/* Care symbols portrait (above TO) */}
                  {!landscape && careSymbols.length > 0 && (
                    <div style={{ display: 'flex', gap: 3, marginBottom: 8, flexWrap: 'wrap' }}>
                      {careSymbols.map(s => (
                        <div key={s} style={{ border: '1px solid #000', padding: '2px 4px', textAlign: 'center', fontSize: '0.75em' }}>
                          <div>{CARE_ICONS[s]}</div>
                          <div style={{ fontSize: '0.6em', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ fontWeight: 900, fontSize: '0.6em', letterSpacing: '0.2em', textTransform: 'uppercase', borderBottom: '2px solid #000', paddingBottom: 2, marginBottom: 6 }}>To</div>
                  <div style={{ fontWeight: 900, fontSize: landscape ? '1.6em' : '2em', lineHeight: 1.1, marginBottom: 4 }}>{customer.company_name}</div>
                  {customer.contacts.filter((_, i) => selectedContacts.includes(i)).map((ct, i) => (
                    <div key={i} style={{ fontSize: '0.9em', marginBottom: 2 }}>{ct.name}{ct.phone ? ` — ${ct.phone}` : ''}</div>
                  ))}
                  <div style={{ fontSize: '0.9em', lineHeight: 1.5, marginTop: 4 }}>{customer.address}</div>
                  <div style={{ fontSize: '0.85em', color: '#444', marginTop: 2 }}>{customer.pin} — {customer.state}, {customer.country}</div>
                </div>

                {/* Care symbols landscape (right of TO) */}
                {landscape && careSymbols.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {careSymbols.map(s => (
                      <div key={s} style={{ border: '1px solid #000', padding: '2px 4px', textAlign: 'center', minWidth: 32, fontSize: '0.75em' }}>
                        <div>{CARE_ICONS[s]}</div>
                        <div style={{ fontSize: '0.6em', textTransform: 'uppercase' }}>{s}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* FROM bottom (portrait) */}
              {!landscape && showFrom && (
                <div style={{ borderTop: '1px dashed #888', marginTop: 8, paddingTop: 5 }}>
                  <div style={{ fontWeight: 900, fontSize: '0.6em', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 2 }}>From</div>
                  <div style={{ fontWeight: 700, fontSize: '0.9em' }}>{tenant.name}</div>
                  <div style={{ fontSize: '0.75em', color: '#444' }}>{tenant.address}, {tenant.pin} — {tenant.state}</div>
                  <div style={{ fontSize: '0.75em', color: '#444' }}>{(selectedPhones.length > 0 ? selectedPhones : allPhones).join(' / ')}</div>
                </div>
              )}
            </div>
          </div>
        )}

        <p className="mt-3 text-xs text-slate-400">
          {pw}mm × {ph}mm &nbsp;·&nbsp; Screen preview only — print uses exact paper dimensions
        </p>
      </div>
    </div>
  )
}
