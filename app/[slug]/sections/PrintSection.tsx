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
  tBarPt: number   // transporter bar font
  toPt:   number   // "To:" label font
  coPt:   number   // company name font
  adPt:   number   // address / contact font
  fNmPt:  number   // FROM name font
  fAdPt:  number   // FROM address font
  iconMm: number   // care icon size (mm)
  clPt:   number   // care label font
  logoMm: number   // FROM logo max-height (mm)
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

const ENV: LabelSize[] = ['DL Env', 'C5 Env', 'C4 Env']

type PrintSize = 'A4' | 'A5' | 'A6' | 'A7' | 'DL' | 'C5' | 'C4'
type CareKey = 'fragile' | 'glass' | 'dry' | 'up' | 'nobend'
type TransporterOptions = { branch: string; freight: string; lr: string }

const SIZE_KEY_MAP: Record<LabelSize, PrintSize> = {
  'A4': 'A4', 'A5': 'A5', 'A6': 'A6', 'A7': 'A7',
  'DL Env': 'DL', 'C5 Env': 'C5', 'C4 Env': 'C4',
}

const CARE_KEY_MAP: Record<CareSymbol, CareKey> = {
  'Fragile': 'fragile', 'Glass': 'glass', 'Keep Dry': 'dry',
  'This Side Up': 'up', 'Do Not Bend': 'nobend',
}

// Inner SVG content per care symbol — for print HTML
const CARE_SVG_HTML: Record<CareSymbol, string> = {
  'Fragile':      '<path d="M9 2 7 6h2v6l-2 3v5h8v-5l-2-3V6h2z"/>',
  'Glass':        '<path d="M6 3 7 21h10L18 3z"/><line x1="6" y1="10" x2="18" y2="10"/>',
  'Keep Dry':     '<path d="M12 3v8a6 6 0 1 0 0 0z"/><line x1="3" y1="3" x2="21" y2="21"/>',
  'This Side Up': '<polyline points="6 9 12 3 18 9"/><line x1="12" y1="3" x2="12" y2="21"/>',
  'Do Not Bend':  '<rect x="3" y="6" width="18" height="12" rx="1"/><line x1="3" y1="3" x2="21" y2="21"/>',
}

const MM = 3.78                 // mm → preview px at 96 dpi
const PT = (25.4 / 72) * MM    // pt → preview px ≈ 1.334

// ─── Preview sub-components (module-level to avoid remount) ─────────────────

function CareSvgContent({ s }: { s: CareSymbol }) {
  switch (s) {
    case 'Fragile':
      return <path d="M9 2 7 6h2v6l-2 3v5h8v-5l-2-3V6h2z" />
    case 'Glass':
      return <><path d="M6 3 7 21h10L18 3z" /><line x1={6} y1={10} x2={18} y2={10} /></>
    case 'Keep Dry':
      return <><path d="M12 3v8a6 6 0 1 0 0 0z" /><line x1={3} y1={3} x2={21} y2={21} /></>
    case 'This Side Up':
      return <><polyline points="6 9 12 3 18 9" /><line x1={12} y1={3} x2={12} y2={21} /></>
    case 'Do Not Bend':
      return <><rect x={3} y={6} width={18} height={12} rx={1} /><line x1={3} y1={3} x2={21} y2={21} /></>
  }
}

function CareBox({ s, sp }: { s: CareSymbol; sp: SP }) {
  return (
    <div style={{ border: '0.75px solid #111', padding: 2 * PT, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 * PT }}>
      <svg viewBox="0 0 24 24" width={sp.iconMm * MM} height={sp.iconMm * MM} fill="none" stroke="#111" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <CareSvgContent s={s} />
      </svg>
      <div style={{ fontSize: sp.clPt * PT, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2 }}>{s}</div>
    </div>
  )
}

function CareRow({ syms, sp }: { syms: CareSymbol[]; sp: SP }) {
  if (!syms.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: 3 * MM, flexShrink: 0, paddingBottom: 2 * MM }}>
      {syms.map(s => <CareBox key={s} s={s} sp={sp} />)}
    </div>
  )
}

// ─── Print HTML builder ──────────────────────────────────────────────────────

function careBoxHtml(s: CareSymbol, sp: SP): string {
  return (
    `<div style="border:.75pt solid #111;padding:2pt;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2pt;">` +
    `<svg viewBox="0 0 24 24" width="${sp.iconMm}mm" height="${sp.iconMm}mm" fill="none" stroke="#111" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${CARE_SVG_HTML[s]}</svg>` +
    `<div style="font-size:${sp.clPt}pt;font-weight:700;text-transform:uppercase;letter-spacing:.04em;line-height:1.2;">${s}</div>` +
    `</div>`
  )
}

function careRowHtml(syms: CareSymbol[], sp: SP): string {
  if (!syms.length) return ''
  return `<div style="display:flex;flex-direction:row;justify-content:center;gap:3mm;flex-shrink:0;padding-bottom:2mm;">${syms.map(s => careBoxHtml(s, sp)).join('')}</div>`
}

export function buildPrintHTML(
  size: PrintSize,
  customer: Customer,
  transporter: Transporter,
  transporterOptions: TransporterOptions,
  fromOn: boolean,
  tenant: Tenant,
  care: string[]
): string {
  const sizes: Record<PrintSize, { w: number; h: number; transporterPt: number; toCompanyPt: number; toAddressPt: number; bottomNamePt: number; bottomRestPt: number; logoMaxH: string }> = {
    A4: { w: 210, h: 297, transporterPt: 16, toCompanyPt: 34, toAddressPt: 13, bottomNamePt: 11, bottomRestPt: 9,  logoMaxH: '18mm' },
    A5: { w: 148, h: 210, transporterPt: 13, toCompanyPt: 26, toAddressPt: 11, bottomNamePt: 10, bottomRestPt: 8,  logoMaxH: '15mm' },
    A6: { w: 105, h: 148, transporterPt: 10, toCompanyPt: 18, toAddressPt: 8,  bottomNamePt: 8,  bottomRestPt: 6,  logoMaxH: '12mm' },
    A7: { w: 74,  h: 105, transporterPt: 8,  toCompanyPt: 12, toAddressPt: 6,  bottomNamePt: 6,  bottomRestPt: 5,  logoMaxH: '9mm'  },
    DL: { w: 220, h: 110, transporterPt: 11, toCompanyPt: 16, toAddressPt: 9,  bottomNamePt: 9,  bottomRestPt: 7,  logoMaxH: '12mm' },
    C5: { w: 229, h: 162, transporterPt: 11, toCompanyPt: 16, toAddressPt: 9,  bottomNamePt: 9,  bottomRestPt: 7,  logoMaxH: '12mm' },
    C4: { w: 324, h: 229, transporterPt: 9,  toCompanyPt: 12, toAddressPt: 7,  bottomNamePt: 9,  bottomRestPt: 7,  logoMaxH: '12mm' },
  }

  const page = sizes[size] ?? sizes.A4

  const esc = (value: unknown) =>
    String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

  const nl2br = (value: unknown) => esc(value).replace(/\n/g, '<br>')

  const joinNonEmpty = (items: Array<string | undefined | null>, separator = ' · ') =>
    items.map(v => String(v ?? '').trim()).filter(Boolean).join(separator)

  const careMap: Record<CareKey, { label: string; symbol: string }> = {
    fragile: { label: 'FRAGILE',      symbol: '⚠' },
    glass:   { label: 'GLASS',        symbol: '◻' },
    dry:     { label: 'KEEP DRY',     symbol: '☔' },
    up:      { label: 'THIS SIDE UP', symbol: '↑' },
    nobend:  { label: 'NO BEND',      symbol: '⟂' },
  }

  const selectedCare = (care ?? [])
    .map(c => String(c).trim().toLowerCase() as CareKey)
    .filter((c): c is CareKey => c in careMap)

  const careHtml = selectedCare.length
    ? `<div class="care-row">${selectedCare.map(c => `<div class="care-chip"><span class="care-symbol">${esc(careMap[c].symbol)}</span><span class="care-label">${esc(careMap[c].label)}</span></div>`).join('')}</div>`
    : ''

  const transporterName = esc(transporter?.name || '')
  const transporterLine = joinNonEmpty([transporterOptions.branch, transporterOptions.freight, transporterOptions.lr])

  const customerName = esc(customer?.company_name || '')
  const customerAddress = nl2br(customer?.address || '')
  const customerContacts = (customer?.contacts ?? [])
    .map(c => {
      const name = String(c?.name ?? '').trim()
      const phone = String(c?.phone ?? '').trim()
      if (!name && !phone) return ''
      return `${esc(name)}${name && phone ? ' : ' : ''}${esc(phone)}`
    })
    .filter(Boolean)

  const bottomPhones = joinNonEmpty([tenant?.phone, ...(tenant?.extra_phones ?? [])], ' / ')
  const bottomAddress = joinNonEmpty([tenant?.address, tenant?.pin ? tenant.pin : '', tenant?.state], ', ')
  const bottomLogo = tenant?.logo_url ? `<img class="logo" src="${esc(tenant.logo_url)}" alt="Logo" />` : ''
  const showFrom = fromOn !== false && !!(tenant?.name || tenant?.address || tenant?.phone || (tenant?.extra_phones?.length ?? 0))

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: ${page.w}mm ${page.h}mm; margin: 8mm; }
    html {
      margin: 0;
      padding: 0;
      height: 100%;
    }
    body {
      margin: 0;
      padding: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
      font-family: Arial, Helvetica, sans-serif;
      color: #000;
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      width: 100%;
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .top { text-align: center; padding-bottom: 3mm; margin-bottom: 3mm; border-bottom: 1px solid #000; flex: 0 0 auto; }
    .transporter-name { font-size: ${page.transporterPt}pt; font-weight: 800; line-height: 1.08; margin: 0; }
    .transporter-line { margin-top: 1.5mm; font-size: ${Math.max(6, page.transporterPt - 4)}pt; font-weight: 400; }
    .middle { flex: 1 1 auto; display: flex; align-items: center; justify-content: center; min-height: 0; }
    .middle-inner { width: 100%; display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-start; text-align: left; gap: 2.2mm; padding-left: 8mm; }
    .care-row { display: flex; flex-wrap: wrap; justify-content: flex-start; gap: 1.6mm; margin: 0; }
    .care-chip { display: inline-flex; align-items: center; gap: 1mm; border: 1px solid #000; border-radius: 999px; padding: 0.8mm 2mm; font-size: 8pt; font-weight: 700; }
    .to-label { font-size: ${Math.max(8, page.toAddressPt + 1)}pt; font-weight: 800; text-decoration: underline; margin: 0; text-align: left; }
    .to-company { font-size: ${page.toCompanyPt}pt; font-weight: 800; line-height: 1.05; margin: 0; word-break: break-word; }
    .to-address, .to-contact { font-size: ${page.toAddressPt}pt; line-height: 1.18; margin: 0; word-break: break-word; }
    .to-contact { font-weight: 600; }
    .bottom { flex: 0 0 auto; border-top: 1px solid #000; padding-top: 3mm; margin-top: 3mm; }
    .from-label { font-size: ${Math.max(8, page.bottomNamePt)}pt; font-weight: 800; text-decoration: underline; margin: 0 0 1.8mm 0; }
    .from-row { display: flex; align-items: flex-start; gap: 2.5mm; width: 100%; }
    .logo { max-height: ${page.logoMaxH}; max-width: 28mm; width: auto; height: auto; object-fit: contain; flex: 0 0 auto; }
    .from-text { min-width: 0; flex: 1 1 auto; font-size: ${page.bottomRestPt}pt; line-height: 1.2; }
    .from-name { font-size: ${page.bottomNamePt}pt; font-weight: 800; line-height: 1.15; margin: 0; }
    .from-address, .from-phone { font-size: ${page.bottomRestPt}pt; font-weight: 400; line-height: 1.2; margin: 0; }
    .from-phone { margin-top: 0.4mm; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="top">
      <div class="transporter-name">${transporterName}</div>
      ${transporterLine ? `<div class="transporter-line">${esc(transporterLine)}</div>` : ''}
    </div>
    <div class="middle">
      <div class="middle-inner">
        ${careHtml}
        <div class="to-label">To:</div>
        <div class="to-company">${customerName}</div>
        <div class="to-address">${customerAddress}</div>
        ${customerContacts.map(c => `<div class="to-contact">${c}</div>`).join('')}
      </div>
    </div>
    ${showFrom ? `<div class="bottom"><div class="from-label">From:</div><div class="from-row">${bottomLogo}<div class="from-text"><div class="from-name">${esc(tenant?.name || '')}</div><div class="from-address">${esc(bottomAddress)}</div><div class="from-phone">Ph: ${esc(bottomPhones)}</div></div></div></div>` : ''}
  </div>
  <script>
    window.addEventListener('load', () => { setTimeout(() => { window.focus(); window.print(); }, 50); });
    window.onafterprint = () => { try { window.close(); } catch(e) {} };
  <\/script>
</body>
</html>`
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

  // Close dropdowns on outside click
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
    const html = buildPrintHTML(
      SIZE_KEY_MAP[size],
      customer,
      transporter as Transporter,
      { branch, freight, lr },
      showFrom,
      tenant,
      careSym.map(s => CARE_KEY_MAP[s])
    )
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) { setPrintErr('Popup blocked. Please allow popups for this site.'); return }
    win.document.write(html); win.document.close()
    startTransition(async () => {
      const r = await incrementPrintCount(tenant.id)
      if (r.success) onPrintDone(r.data)
    })
  }

  const [pw, ph] = SIZE_DIMS[size]
  const sp = SZ[size]
  const isEnv = ENV.includes(size)
  const PREVIEW_W = 320
  const scale = PREVIEW_W / (pw * MM)
  const previewH = Math.round(ph * MM * scale)

  // Style helpers
  const inp = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#14B8A6] focus:ring-2 focus:ring-[#14B8A6]/20 bg-white'
  const sec = 'mb-5'
  const hd = 'text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2'
  const dropWrap = 'absolute z-20 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg'
  const dropItem = (active: boolean) => `w-full px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${active ? 'bg-[#f0fdf9] text-[#0F766E] font-semibold' : 'text-slate-700'}`
  const xBtn = <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>

  // ── Preview building blocks ───────────────────────────────────────────────

  // Transporter bar
  const pvTBar = transporter ? (() => {
    const details = [branch, freight, lr, mode].filter(Boolean)
    return (
      <div style={{ textAlign: 'center', borderBottom: `${2 * PT}px solid #000`, paddingBottom: 2 * PT, marginBottom: 3 * MM, flexShrink: 0, fontSize: sp.tBarPt * PT, fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <span style={{ fontWeight: 700 }}>{transporter.name}</span>
        {details.length > 0 && <span style={{ fontWeight: 400, color: '#444' }}> &nbsp;·&nbsp; {details.join(' · ')}</span>}
      </div>
    )
  })() : null

  // Care row
  const pvCareRow = careSym.length > 0 ? <CareRow syms={careSym} sp={sp} /> : null

  // TO block
  const pvToBlock = customer ? (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
      <div style={isEnv ? { marginLeft: '40%' } : {}}>
        <div style={{ fontSize: sp.toPt * PT, fontWeight: 700, textDecoration: 'underline', marginBottom: sp.toPt * PT * 0.4 }}>To:</div>
        <div style={{ fontSize: sp.coPt * PT, fontWeight: 900, lineHeight: 1.05, marginLeft: 6 * MM, wordBreak: 'break-word' }}>{customer.company_name}</div>
        {customer.contacts.filter((_, i) => selContacts.includes(i)).map((ct, i) => (
          <div key={i} style={{ fontSize: sp.adPt * PT, color: '#555', marginTop: sp.adPt * PT * 0.3 }}>{ct.name}{ct.phone ? ` — ${ct.phone}` : ''}</div>
        ))}
        <div style={{ fontSize: sp.adPt * PT, fontWeight: 500, color: '#222', lineHeight: 1.5, marginTop: sp.adPt * PT * 0.5 }}>{customer.address}</div>
        <div style={{ fontSize: sp.adPt * PT, color: '#555', marginTop: sp.adPt * PT * 0.3 }}>{customer.pin} — {customer.state}, {customer.country}</div>
      </div>
    </div>
  ) : null

  // FROM logo + text helper
  const pvFromInner = showFrom ? (
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
      {tenant.logo_url && (
        <img src={tenant.logo_url} alt="" style={{ height: sp.logoMm * MM, maxWidth: sp.logoMm * 2 * MM, objectFit: 'contain', display: 'block', flexShrink: 0, marginRight: 3 * MM }} />
      )}
      <div>
        <div style={{ fontSize: sp.fNmPt * PT, fontWeight: 700, lineHeight: 1.3 }}>{tenant.name}</div>
        <div style={{ fontSize: sp.fAdPt * PT, color: '#555', lineHeight: 1.4, marginTop: sp.fAdPt * PT * 0.3 }}>{tenant.address}, {tenant.pin} — {tenant.state}</div>
        <div style={{ fontSize: sp.fAdPt * PT, color: '#555', marginTop: sp.fAdPt * PT * 0.2 }}>{phones.join(' / ')}</div>
      </div>
    </div>
  ) : null

  // FROM block — portrait: border-top at bottom; envelope: absolute left column
  const pvFromPortrait = showFrom ? (
    <div style={{ borderTop: `${2 * PT}px solid #000`, paddingTop: 3 * MM, flexShrink: 0 }}>
      {pvFromInner}
    </div>
  ) : null

  const pvFromEnv = showFrom ? (
    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '36%', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingRight: 3 * MM }}>
      {pvFromInner}
    </div>
  ) : null

  return (
    <div className="flex h-full overflow-hidden">

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
          <div className="shadow-2xl" style={{ width: PREVIEW_W, height: previewH, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              width: pw * MM, height: ph * MM,
              transform: `scale(${scale})`, transformOrigin: 'top left',
              background: 'white', fontFamily: 'Arial, Helvetica, sans-serif',
              display: 'flex', flexDirection: 'column',
              padding: 8 * MM * scale, boxSizing: 'border-box', overflow: 'hidden',
              position: 'relative',
            }}>
              {pvTBar}
              {pvCareRow}
              {pvToBlock}
              {isEnv ? pvFromEnv : pvFromPortrait}
              <div style={{ fontSize: 5 * PT, textAlign: 'right', color: '#ccc', paddingTop: 2 * PT, flexShrink: 0 }}>
                AddressPrint — BizKit by JBSS India
              </div>
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
