'use client'
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
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

const SIZE_DIMS: Record<LabelSize, [number, number]> = {
  'A4': [210, 297], 'A5': [148, 210], 'A6': [105, 148], 'A7': [74, 105],
  'DL Env': [220, 110], 'C5 Env': [229, 162], 'C4 Env': [324, 229],
}

interface SP {
  tBarPt: number
  toPt:   number
  coPt:   number
  adPt:   number
  fNmPt:  number
  fAdPt:  number
  iconMm: number
  clPt:   number
  logoMm: number
}

const SZ: Record<LabelSize, SP> = {
  'A4':     { tBarPt:13, toPt:14, coPt:32, adPt:13, fNmPt:11, fAdPt:9,  iconMm:10, clPt:5,   logoMm:20 },
  'A5':     { tBarPt:11, toPt:11, coPt:24, adPt:10, fNmPt:9,  fAdPt:8,  iconMm:8,  clPt:4,   logoMm:16 },
  'A6':     { tBarPt:9,  toPt:9,  coPt:17, adPt:8,  fNmPt:7,  fAdPt:6,  iconMm:6,  clPt:3.5, logoMm:12 },
  'A7':     { tBarPt:7,  toPt:7,  coPt:11, adPt:6,  fNmPt:5,  fAdPt:4,  iconMm:4,  clPt:3,   logoMm:8  },
  'DL Env': { tBarPt:10, toPt:10, coPt:15, adPt:9,  fNmPt:8,  fAdPt:7,  iconMm:7,  clPt:4,   logoMm:14 },
  'C5 Env': { tBarPt:10, toPt:10, coPt:17, adPt:9,  fNmPt:8,  fAdPt:7,  iconMm:7,  clPt:4,   logoMm:14 },
  'C4 Env': { tBarPt:10, toPt:10, coPt:11, adPt:7,  fNmPt:8,  fAdPt:7,  iconMm:7,  clPt:4,   logoMm:14 },
}

const MM = 3.78
const PT = (25.4 / 72) * MM

// ─── Care icon SVG paths ─────────────────────────────────────────────────────

function CareSvgContent({ s }: { s: CareSymbol }) {
  switch (s) {
    case 'Fragile':      return <path d="M9 2 7 6h2v6l-2 3v5h8v-5l-2-3V6h2z" />
    case 'Glass':        return <><path d="M6 3 7 21h10L18 3z" /><line x1={6} y1={10} x2={18} y2={10} /></>
    case 'Keep Dry':     return <><path d="M12 3v8a6 6 0 1 0 0 0z" /><line x1={3} y1={3} x2={21} y2={21} /></>
    case 'This Side Up': return <><polyline points="6 9 12 3 18 9" /><line x1={12} y1={3} x2={12} y2={21} /></>
    case 'Do Not Bend':  return <><rect x={3} y={6} width={18} height={12} rx={1} /><line x1={3} y1={3} x2={21} y2={21} /></>
  }
}

// ─── LabelLayout ─────────────────────────────────────────────────────────────

interface LabelLayoutProps {
  customer: Customer | null
  transporter: Transporter | null
  transporterOptions: { branch: string; freight: string; lr: string; mode: string }
  fromOn: boolean
  tenant: Tenant
  care: CareSymbol[]
  selContacts: number[]
  selPhones: string[]
  size: LabelSize
  isPrint: boolean
}

function LabelLayout({ customer, transporter, transporterOptions, fromOn, tenant, care, selContacts, selPhones, size, isPrint }: LabelLayoutProps) {
  const sp = SZ[size]
  const [pw, ph] = SIZE_DIMS[size]

  // Unit helpers: preview returns CSS px strings, print returns mm/pt strings
  const mm = isPrint ? (v: number) => `${v}mm` : (v: number) => `${v * MM}px`
  const pt = isPrint ? (v: number) => `${v}pt` : (v: number) => `${v * PT}px`
  const iconSz = isPrint ? `${sp.iconMm}mm` : `${sp.iconMm * MM}px`

  const allPhones = [tenant.phone, ...(tenant.extra_phones ?? [])].filter(Boolean)
  const phones = selPhones.length > 0 ? selPhones : allPhones
  const showFrom = fromOn && !!(tenant?.name || tenant?.address || tenant?.phone || tenant?.logo_url)
  const transporterDetails = [transporterOptions.branch, transporterOptions.freight, transporterOptions.lr, transporterOptions.mode].filter(Boolean)
  const activeContacts = customer?.contacts.filter((_, i) => selContacts.includes(i)) ?? []
  const bottomAddress = [tenant?.address, tenant?.pin, tenant?.state].filter(Boolean).join(', ')

  const containerStyle: React.CSSProperties = isPrint ? {
    display: 'flex', flexDirection: 'column',
    width: '100%', height: '100%',
    fontFamily: 'Arial, Helvetica, sans-serif', color: '#000',
  } : {
    width: pw * MM, height: ph * MM,
    padding: 8 * MM, boxSizing: 'border-box',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden', background: 'white',
    fontFamily: 'Arial, Helvetica, sans-serif', color: '#000',
  }

  return (
    <div style={containerStyle}>
      {/* TOP: transporter bar */}
      {transporter && (
        <div style={{ textAlign: 'center', borderBottom: '1px solid #000', paddingBottom: mm(3), marginBottom: mm(3), flexShrink: 0 }}>
          <div style={{ fontSize: pt(sp.tBarPt), fontWeight: 800, lineHeight: 1.08 }}>{transporter.name}</div>
          {transporterDetails.length > 0 && (
            <div style={{ marginTop: mm(1.5), fontSize: pt(Math.max(6, sp.tBarPt - 4)), fontWeight: 400 }}>
              {transporterDetails.join(' · ')}
            </div>
          )}
        </div>
      )}

      {/* MIDDLE: care chips + To block, vertically centered */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: mm(2.2), paddingLeft: mm(8) }}>
          {care.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: mm(1.6) }}>
              {care.map(s => (
                <div key={s} style={{ border: '0.75px solid #111', padding: `${mm(0.8)} ${mm(2)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: mm(1) }}>
                  <svg viewBox="0 0 24 24" width={iconSz} height={iconSz} fill="none" stroke="#111" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <CareSvgContent s={s} />
                  </svg>
                  <div style={{ fontSize: pt(sp.clPt), fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2 }}>{s}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: pt(Math.max(8, sp.adPt + 1)), fontWeight: 800, textDecoration: 'underline' }}>To:</div>
          {customer && (
            <>
              <div style={{ fontSize: pt(sp.coPt), fontWeight: 800, lineHeight: 1.05, wordBreak: 'break-word' }}>{customer.company_name}</div>
              {customer.address && <div style={{ fontSize: pt(sp.adPt), lineHeight: 1.18, wordBreak: 'break-word' }}>{customer.address}</div>}
              {activeContacts.map((ct, i) => (
                <div key={i} style={{ fontSize: pt(sp.adPt), fontWeight: 600, lineHeight: 1.18 }}>{ct.name}{ct.phone ? ` : ${ct.phone}` : ''}</div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* BOTTOM: From block */}
      {showFrom && (
        <div style={{ borderTop: '1px solid #000', paddingTop: mm(3), marginTop: mm(3), flexShrink: 0 }}>
          <div style={{ fontSize: pt(Math.max(8, sp.fNmPt)), fontWeight: 800, textDecoration: 'underline', marginBottom: mm(1.8) }}>From:</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: mm(2.5) }}>
            {tenant.logo_url && (
              <img src={tenant.logo_url} alt="" style={{ maxHeight: mm(sp.logoMm), maxWidth: mm(28), objectFit: 'contain', flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0, fontSize: pt(sp.fAdPt), lineHeight: 1.2 }}>
              <div style={{ fontSize: pt(sp.fNmPt), fontWeight: 800, lineHeight: 1.15 }}>{tenant.name}</div>
              {bottomAddress && <div style={{ fontWeight: 400 }}>{bottomAddress}</div>}
              {phones.length > 0 && <div style={{ fontWeight: 400, marginTop: mm(0.4) }}>Ph: {phones.join(' / ')}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function PrintSection({ tenant, customers, transporters, defaultCustomer, onPrintDone }: Props) {
  // Customer search
  const [selCustId, setSelCustId] = useState(defaultCustomer?.id ?? '')
  const [custSearch, setCustSearch] = useState(defaultCustomer?.company_name ?? '')
  const [showCustList, setShowCustList] = useState(false)
  const custRef = useRef<HTMLDivElement>(null)

  // Transporter search
  const [selTransId, setSelTransId] = useState('')
  const [transSearch, setTransSearch] = useState('')
  const [showTransList, setShowTransList] = useState(false)
  const transRef = useRef<HTMLDivElement>(null)

  const [selContacts, setSelContacts] = useState<number[]>([])
  const [branch, setBranch] = useState('')
  const [mode, setMode] = useState('')
  const [freight, setFreight] = useState('')
  const [lr, setLr] = useState('')
  const [showFrom, setShowFrom] = useState(true)
  const [selPhones, setSelPhones] = useState<string[]>([])
  const [size, setSize] = useState<LabelSize>('A4')
  const [careSym, setCareSym] = useState<CareSymbol[]>([])
  const [printErr, setPrintErr] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const customer = customers.find(c => c.id === selCustId) ?? null
  const transporter = transporters.find(t => t.id === selTransId) ?? null
  const allPhones = [tenant.phone, ...(tenant.extra_phones ?? [])].filter(Boolean)
  const phones = selPhones.length > 0 ? selPhones : allPhones

  const filteredCusts = useMemo(() => {
    if (selCustId) return customers
    const q = custSearch.toLowerCase().trim()
    return q ? customers.filter(c => c.company_name.toLowerCase().includes(q)) : customers
  }, [customers, custSearch, selCustId])

  const filteredTrans = useMemo(() => {
    if (selTransId) return transporters
    const q = transSearch.toLowerCase().trim()
    return q ? transporters.filter(t => t.name.toLowerCase().includes(q)) : transporters
  }, [transporters, transSearch, selTransId])

  useEffect(() => {
    function h(e: MouseEvent) {
      if (custRef.current && !custRef.current.contains(e.target as Node)) setShowCustList(false)
      if (transRef.current && !transRef.current.contains(e.target as Node)) setShowTransList(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (defaultCustomer) { setSelCustId(defaultCustomer.id); setCustSearch(defaultCustomer.company_name) }
  }, [defaultCustomer?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSelContacts(customer ? customer.contacts.map((_, i) => i) : [])
  }, [selCustId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setBranch(''); setMode(''); setFreight(''); setLr('') }, [selTransId])

  useEffect(() => { if (showFrom) setSelPhones([...allPhones]) }, [showFrom]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSelPhones([...allPhones]) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function pickCust(c: Customer) { setSelCustId(c.id); setCustSearch(c.company_name); setShowCustList(false) }
  function clearCust() { setSelCustId(''); setCustSearch(''); setShowCustList(false) }
  function pickTrans(t: Transporter) { setSelTransId(t.id); setTransSearch(t.name); setShowTransList(false) }
  function clearTrans() { setSelTransId(''); setTransSearch(''); setShowTransList(false) }
  function toggleContact(i: number) { setSelContacts(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i]) }
  function togglePhone(ph: string) { setSelPhones(p => p.includes(ph) ? p.filter(x => x !== ph) : [...p, ph]) }
  function toggleCare(s: CareSymbol) { setCareSym(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]) }

  function handlePrint() {
    if (!customer) { setPrintErr('Please select a customer.'); return }
    setPrintErr(null)
    window.print()
    startTransition(async () => {
      const r = await incrementPrintCount(tenant.id)
      if (r.success) onPrintDone(r.data)
    })
  }

  const [pw, ph] = SIZE_DIMS[size]
  const PREVIEW_W = 320
  const scale = PREVIEW_W / (pw * MM)
  const previewH = Math.round(ph * MM * scale)

  const layoutProps: Omit<LabelLayoutProps, 'isPrint'> = {
    customer,
    transporter,
    transporterOptions: { branch, freight, lr, mode },
    fromOn: showFrom,
    tenant,
    care: careSym,
    selContacts,
    selPhones: phones,
    size,
  }

  // Style helpers
  const inp = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#14B8A6] focus:ring-2 focus:ring-[#14B8A6]/20 bg-white'
  const sec = 'mb-5'
  const hd = 'text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2'
  const dropWrap = 'absolute z-20 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg'
  const dropItem = (active: boolean) => `w-full px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${active ? 'bg-[#f0fdf9] text-[#0F766E] font-semibold' : 'text-slate-700'}`
  const xBtn = <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          @page { size: ${pw}mm ${ph}mm; margin: 8mm; }
        }
        .print-only { display: none; }
      `}</style>

      {/* Print-only label — hidden on screen, shown when printing */}
      <div className="print-only" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%' }}>
        <LabelLayout {...layoutProps} isPrint={true} />
      </div>

      {/* Screen UI */}
      <div className="no-print flex h-full overflow-hidden">

        {/* ── Controls panel ───────────────────────────────────────────── */}
        <div className="w-[420px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-5">

          {/* Customer */}
          <div className={sec}>
            <p className={hd}>Customer *</p>
            <div className="relative" ref={custRef}>
              <div className="relative">
                <input type="text" value={custSearch}
                  onChange={e => { setCustSearch(e.target.value); setSelCustId(''); setShowCustList(true) }}
                  onFocus={() => setShowCustList(true)}
                  placeholder="Search customer…"
                  className={inp + (custSearch ? ' pr-8' : '')} />
                {custSearch && <button onClick={clearCust} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{xBtn}</button>}
              </div>
              {showCustList && (
                <div className={dropWrap}>
                  {filteredCusts.length === 0
                    ? <div className="px-3 py-2 text-sm text-slate-400">No customers found</div>
                    : filteredCusts.map(c => <button key={c.id} onMouseDown={() => pickCust(c)} className={dropItem(c.id === selCustId)}>{c.company_name}</button>)
                  }
                </div>
              )}
            </div>
          </div>

          {/* Contacts */}
          {customer && customer.contacts.length > 0 && (
            <div className={sec}>
              <p className={hd}>Contacts</p>
              <div className="space-y-1.5">
                {customer.contacts.map((ct, i) => (
                  <label key={i} className="flex items-center gap-2.5 cursor-pointer rounded-lg px-2 py-1.5 hover:bg-slate-50">
                    <input type="checkbox" checked={selContacts.includes(i)} onChange={() => toggleContact(i)} className="h-4 w-4 rounded accent-[#0F766E]" />
                    <span className="text-sm text-slate-700">{ct.name}{ct.phone ? ` — ${ct.phone}` : ''}</span>
                    {ct.is_default && <span className="ml-auto text-[10px] font-semibold text-[#0F766E]">Default</span>}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Transporter */}
          <div className={sec}>
            <p className={hd}>Transporter (optional)</p>
            <div className="relative" ref={transRef}>
              <div className="relative">
                <input type="text" value={transSearch}
                  onChange={e => { setTransSearch(e.target.value); setSelTransId(''); setShowTransList(true) }}
                  onFocus={() => setShowTransList(true)}
                  placeholder="Search transporter…"
                  className={inp + (transSearch ? ' pr-8' : '')} />
                {transSearch && <button onClick={clearTrans} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{xBtn}</button>}
              </div>
              {showTransList && (
                <div className={dropWrap}>
                  {filteredTrans.length === 0
                    ? <div className="px-3 py-2 text-sm text-slate-400">No transporters found</div>
                    : filteredTrans.map(t => (
                      <button key={t.id} onMouseDown={() => pickTrans(t)} className={dropItem(t.id === selTransId)}>
                        <span className="font-medium">{t.name}</span>
                        <span className="ml-2 text-xs text-slate-400">{t.type === 'courier' ? 'Courier' : 'Transport'}</span>
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
            {transporter && (
              <div className="mt-3 space-y-2.5 rounded-lg bg-slate-50 p-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Branch</label>
                  <input value={branch} onChange={e => setBranch(e.target.value)} placeholder="To branch — optional" className={inp} />
                </div>
                {transporter.type === 'courier' ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Mode</label>
                    <select value={mode} onChange={e => setMode(e.target.value)} className={inp}>
                      <option value="">— optional —</option>
                      {MODE_OPTS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Freight</label>
                      <select value={freight} onChange={e => setFreight(e.target.value)} className={inp}>
                        <option value="">— optional —</option>
                        {FREIGHT_OPTS.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">LR</label>
                      <select value={lr} onChange={e => setLr(e.target.value)} className={inp}>
                        <option value="">— optional —</option>
                        {LR_OPTS.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* From toggle */}
          <div className={sec}>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={showFrom} onChange={e => setShowFrom(e.target.checked)} className="h-4 w-4 rounded accent-[#0F766E]" />
              <span className="text-sm font-semibold text-slate-700">Include From address</span>
            </label>
            {showFrom && allPhones.length > 0 && (
              <div className="mt-2.5 space-y-1.5 rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500 mb-1.5">From phones</p>
                {allPhones.map(ph => (
                  <label key={ph} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={selPhones.includes(ph)} onChange={() => togglePhone(ph)} className="h-4 w-4 rounded accent-[#0F766E]" />
                    <span className="text-sm text-slate-700">{ph}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Size chips */}
          <div className={sec}>
            <p className={hd}>Paper Size</p>
            <div className="flex flex-wrap gap-1.5">
              {SIZES.map(s => (
                <button key={s} type="button" onClick={() => setSize(s)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${size === s ? 'bg-[#0F766E] text-white' : 'border border-slate-200 text-slate-600 hover:border-[#0F766E] hover:text-[#0F766E]'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Care chips */}
          <div className={sec}>
            <p className={hd}>Handle With Care</p>
            <div className="flex flex-wrap gap-2">
              {CARE_SYMBOLS.map(sym => (
                <button key={sym} type="button" onClick={() => toggleCare(sym)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-2.5 min-w-[80px] transition-all ${careSym.includes(sym) ? 'border-[#0F766E] bg-[#0F766E]/10 text-[#0F766E]' : 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700'}`}>
                  <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <CareSvgContent s={sym} />
                  </svg>
                  <span className="text-[11px] font-semibold text-center leading-tight">{sym}</span>
                </button>
              ))}
            </div>
          </div>

          {printErr && <p className="mb-3 text-sm text-red-500">{printErr}</p>}

          {/* Buttons */}
          <div className="space-y-2 sticky bottom-0 bg-white pt-2 border-t border-slate-100">
            <button onClick={handlePrint} disabled={isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F766E] py-3 text-sm font-bold text-white hover:bg-[#0d6b63] disabled:opacity-60 transition">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a1 1 0 001 1h8a1 1 0 001-1v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1zm2 0h6v3H7V4zm-1 9h8v3H6v-3zm2-4a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" /></svg>
              {isPending ? 'Saving…' : 'Print'}
            </button>
            <button onClick={handlePrint} disabled={isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#0F766E] py-3 text-sm font-bold text-[#0F766E] hover:bg-[#0F766E]/5 disabled:opacity-60 transition">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" /></svg>
              Save as PDF
            </button>
          </div>
        </div>

        {/* ── Preview panel ────────────────────────────────────────────── */}
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
            <div className="shadow-2xl" style={{ width: PREVIEW_W, height: previewH, overflow: 'hidden' }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                <LabelLayout {...layoutProps} isPrint={false} />
              </div>
            </div>
          )}

          <p className="mt-3 text-xs text-slate-400">
            {pw}mm × {ph}mm &nbsp;·&nbsp; Screen preview only — print uses exact paper dimensions
          </p>
        </div>
      </div>
    </>
  )
}
