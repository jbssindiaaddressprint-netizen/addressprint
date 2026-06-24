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
  padMm: number
  gapMm: number
  lineGapPt: number 
  tBarPt: number
  tBarSubPt: number
  toPt: number
  coPt: number
  adPt: number
  fNmPt: number
  fAdPt: number
  iconMm: number
  clPt: number
  logoMm: number
  fromReserveMm: number
}

// Bumped A4 adPt to 24 and coPt to 42 for massive box readability
// fromReserveMm = fixed bottom zone height (envelopes only) reserved for FROM block so TO can never grow into it and cut it off
const SZ: Record<LabelSize, SP> = {
  'A4':     { padMm: 16, gapMm: 16, lineGapPt: 16, tBarPt: 26, tBarSubPt: 16, toPt: 20, coPt: 42, adPt: 24, fNmPt: 18, fAdPt: 16, iconMm: 18, clPt: 6, logoMm: 24, fromReserveMm: 0 },
  'A5':     { padMm: 10, gapMm: 10, lineGapPt: 8,  tBarPt: 18, tBarSubPt: 11, toPt: 14, coPt: 26, adPt: 14, fNmPt: 13, fAdPt: 11, iconMm: 12, clPt: 5, logoMm: 18, fromReserveMm: 0 },
  'A6':     { padMm: 7,  gapMm: 7,  lineGapPt: 4,  tBarPt: 14, tBarSubPt: 9,  toPt: 11, coPt: 20, adPt: 11, fNmPt: 10, fAdPt: 9,  iconMm: 9,  clPt: 4, logoMm: 14, fromReserveMm: 0 },
  'A7':     { padMm: 5,  gapMm: 5,  lineGapPt: 2,  tBarPt: 11, tBarSubPt: 7,  toPt: 9,  coPt: 13, adPt: 9,  fNmPt: 8,  fAdPt: 7,  iconMm: 7,  clPt: 3, logoMm: 10, fromReserveMm: 0 },
  'C4 Env': { padMm: 12, gapMm: 12, lineGapPt: 12, tBarPt: 22, tBarSubPt: 12, toPt: 16, coPt: 30, adPt: 16, fNmPt: 13, fAdPt: 12, iconMm: 14, clPt: 5, logoMm: 20, fromReserveMm: 60 },
  'C5 Env': { padMm: 10, gapMm: 10, lineGapPt: 6,  tBarPt: 16, tBarSubPt: 10, toPt: 12, coPt: 24, adPt: 12, fNmPt: 10, fAdPt: 10, iconMm: 10, clPt: 4, logoMm: 16, fromReserveMm: 48 },
  'DL Env': { padMm: 8,  gapMm: 8,  lineGapPt: 4,  tBarPt: 10, tBarSubPt: 8,  toPt: 10, coPt: 16, adPt: 10, fNmPt: 8,  fAdPt: 8,  iconMm: 8,  clPt: 4, logoMm: 11, fromReserveMm: 40 },
}

const ENV: LabelSize[] = ['DL Env', 'C5 Env', 'C4 Env']

type PrintSize = 'A4' | 'A5' | 'A6' | 'A7' | 'DL' | 'C5' | 'C4'
type CareKey = 'fragile' | 'glass' | 'dry' | 'up' | 'nobend'
type TransporterOptions = { branch: string; freight: string; lr: string; mode?: string }

const SIZE_KEY_MAP: Record<LabelSize, PrintSize> = {
  'A4': 'A4', 'A5': 'A5', 'A6': 'A6', 'A7': 'A7',
  'DL Env': 'DL', 'C5 Env': 'C5', 'C4 Env': 'C4',
}

const CARE_KEY_MAP: Record<CareSymbol, CareKey> = {
  'Fragile': 'fragile', 'Glass': 'glass', 'Keep Dry': 'dry',
  'This Side Up': 'up', 'Do Not Bend': 'nobend',
}

const CARE_SVG_HTML: Record<CareKey, string> = {
  'fragile': '<path d="M9 2 7 6h2v6l-2 3v5h8v-5l-2-3V6h2z"/>',
  'glass':   '<path d="M6 3 7 21h10L18 3z"/><line x1="6" y1="10" x2="18" y2="10"/>',
  'dry':     '<path d="M12 3v8a6 6 0 1 0 0 0z"/><line x1="3" y1="3" x2="21" y2="21"/>',
  'up':      '<polyline points="6 9 12 3 18 9"/><line x1="12" y1="3" x2="12" y2="21"/>',
  'nobend':  '<rect x="3" y="6" width="18" height="12" rx="1"/><line x1="3" y1="3" x2="21" y2="21"/>',
}

const MM = 3.78
const PT = (25.4 / 72) * MM

function CareSvgContent({ c }: { c: CareKey }) {
  return <g dangerouslySetInnerHTML={{ __html: CARE_SVG_HTML[c] }} />
}

function CareBox({ c, label, sp, inkSaver }: { c: CareKey; label: string; sp: SP; inkSaver: boolean }) {
  return (
    <div style={{ border: `0.75px solid ${inkSaver ? '#666' : '#111'}`, padding: 2 * PT, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 * PT }}>
      <svg viewBox="0 0 24 24" width={sp.iconMm * MM} height={sp.iconMm * MM} fill="none" stroke={inkSaver ? '#666' : '#111'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <CareSvgContent c={c} />
      </svg>
      <div style={{ fontSize: sp.clPt * PT, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2, color: inkSaver ? '#555' : '#000' }}>{label}</div>
    </div>
  )
}

function CareRow({ careKeys, sp, isEnv, inkSaver }: { careKeys: CareKey[]; sp: SP; isEnv: boolean; inkSaver: boolean }) {
  if (!careKeys.length) return null
  const careLabels: Record<CareKey, string> = { fragile: 'FRAGILE', glass: 'GLASS', dry: 'KEEP DRY', up: 'THIS SIDE UP', nobend: 'NO BEND' }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 * MM, marginBottom: 2 * MM, justifyContent: isEnv ? 'flex-start' : 'center' }}>
      {careKeys.map(c => <CareBox key={c} c={c} label={careLabels[c]} sp={sp} inkSaver={inkSaver} />)}
    </div>
  )
}

export function buildPrintHTML(
  size: PrintSize,
  customer: Customer,
  transporter: Transporter,
  transporterOptions: TransporterOptions,
  fromOn: boolean,
  tenant: Tenant,
  care: string[],
  inkSaver: boolean = false
): string {
  const labelSizeKey = (Object.keys(SIZE_KEY_MAP) as LabelSize[]).find(k => SIZE_KEY_MAP[k] === size) || 'A4'
  const sp = SZ[labelSizeKey]
  const pw = SIZE_DIMS[labelSizeKey][0]
  const ph = SIZE_DIMS[labelSizeKey][1]
  const isEnv = ['DL', 'C5', 'C4'].includes(size)
  const bodyColor = inkSaver ? '#555' : '#000'

  // A5 prints 2-up on one A4 sheet (rotated to landscape, stacked, cut in half) to halve paper use.
  // Every other size keeps the original single-label-pinned-in-the-corner behaviour.
  const isA5TwoUp = size === 'A5'
  const tileW = isA5TwoUp ? ph : pw
  const tileH = isA5TwoUp ? pw : ph

  const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  const nl2br = (v: unknown) => esc(v).replace(/\n/g, '<br>')
  
  const selectedCare = (care ?? []).map(c => String(c).trim().toLowerCase() as CareKey).filter(c => Object.keys(CARE_SVG_HTML).includes(c))
  const careLabels: Record<string, string> = { fragile: 'FRAGILE', glass: 'GLASS', dry: 'KEEP DRY', up: 'THIS SIDE UP', nobend: 'NO BEND' }
  
  const careHtml = selectedCare.length
    ? `<div style="display: flex; flex-wrap: wrap; gap: 3mm; margin-bottom: 2mm; ${isEnv ? '' : 'justify-content: center;'}">
        ${selectedCare.map(c => 
          `<div style="border: 0.75px solid ${inkSaver ? '#666' : '#111'}; padding: 2pt; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2pt;">
            <svg viewBox="0 0 24 24" width="${sp.iconMm}mm" height="${sp.iconMm}mm" fill="none" stroke="${inkSaver ? '#666' : '#111'}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${CARE_SVG_HTML[c]}</svg>
            <div style="font-size: ${sp.clPt}pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; line-height: 1.2; color: ${bodyColor};">${careLabels[c]}</div>
          </div>`
        ).join('')}
       </div>`
    : ''

  const transporterName = esc(transporter?.name || '')
  const transporterLine = [transporterOptions.branch, transporterOptions.freight, transporterOptions.lr, transporterOptions.mode].filter(Boolean).join(' · ')
  
  const customerName = esc(customer?.company_name || '')
  const customerAddress = nl2br(customer?.address || '')
  const customerPinState = esc([customer?.pin, customer?.state, customer?.country].filter(Boolean).join(', '))
  
  const contacts = (customer?.contacts ?? []).map(c => `${esc(c?.name)}${c?.phone ? ` : ${esc(c.phone)}` : ''}`).filter(Boolean)
  const contactsHtml = contacts.length 
    ? `<div>${contacts.map(c => `<div style="font-size: ${sp.adPt}pt; font-weight: 800; margin-top: 4pt; color: ${bodyColor};">${c}</div>`).join('')}</div>`
    : ''
  
  const bottomPhones = [tenant?.phone, ...(tenant?.extra_phones ?? [])].filter(Boolean).join(' / ')
  const bottomAddress = [tenant?.address, tenant?.pin, tenant?.state].filter(Boolean).join(', ')
  const bottomLogo = tenant?.logo_url ? `<img src="${esc(tenant.logo_url)}" alt="Logo" style="max-height: ${sp.logoMm}mm; max-width: 28mm; object-fit: contain; flex-shrink: 0; filter: ${inkSaver ? 'grayscale(100%)' : 'none'};" />` : ''
  const showFrom = fromOn && !!(tenant?.name || tenant?.address || tenant?.phone || bottomLogo)

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    /* KEY FIX 1: By using size: auto vs landscape, we trick the browser into 
       not shrinking or auto-centering our canvas on A4 paper */
    @page { 
      margin: 0; 
      size: ${isEnv ? 'landscape' : 'auto'};
    }
    html, body { 
      margin: 0 !important; padding: 0 !important; 
      /* DO NOT restrict body width/height. Let it span the physical page so it doesn't auto-center */
      width: 100%; height: 100%;
      background: white;
      font-family: Arial, Helvetica, sans-serif; color: #000; box-sizing: border-box; 
      -webkit-print-color-adjust: exact; print-color-adjust: exact; 
    }
    .sheet { 
      position: absolute;
      top: 0; 
      /* KEY FIX: If it's an envelope, pin it to the RIGHT side of the browser's print canvas 
         so it perfectly aligns with the right-aligned physical feed tray of the printer! */
      ${isEnv ? 'right: 0; left: auto;' : 'left: 0; right: auto;'}
      
      width: ${tileW}mm !important; height: ${tileH}mm !important; 
      padding: ${sp.padMm}mm; 
      display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;
    }
    .top { 
      text-align: center; border-bottom: 2pt solid #000; 
      padding-bottom: 2.5mm; margin-bottom: ${sp.gapMm}mm; flex-shrink: 0; 
    }
    
    .middle { flex-grow: 1; display: flex; flex-direction: column; min-height: 0; }
    .middle-inner { display: flex; flex-direction: column; }
    
    .bottom { 
      border-top: 2pt solid #000; padding-top: 2.5mm; 
      margin-top: ${sp.gapMm}mm; flex-shrink: 0; 
    }

    ${isEnv ? `
      /* ENVELOPES: TO block stays right-aligned (matches envelope window).
         FROM block sits on the LEFT side, pinned to the BOTTOM (not centered). */
      .middle { justify-content: center; max-height: 100%; overflow: hidden; }
      .middle-inner { margin-left: 55%; width: calc(45% - ${sp.padMm}mm); gap: ${sp.lineGapPt}pt; max-height: 100%; overflow: hidden; }
      
      .bottom {
        position: absolute; left: ${sp.padMm}mm; bottom: ${sp.padMm}mm;
        width: calc(50% - ${sp.padMm * 2}mm);
        border-top: none; padding-top: 0; margin-top: 0;
        display: flex; flex-direction: column; justify-content: flex-end;
        overflow: hidden;
      }
    ` : `
      /* A4/PORTRAIT LABELS: Space-evenly distributes the blocks to cover empty space! */
      .middle { justify-content: flex-start; }
      .middle-inner { flex-grow: 1; justify-content: space-evenly; width: 100%; padding-top: 5mm; padding-bottom: 5mm; }
    `}
  </style>
</head>
<body>
  ${(() => {
    const labelContent = `
    ${transporterName ? `
    <div class="top">
      <div style="font-size: ${sp.tBarPt}pt; font-weight: 800; color: ${bodyColor};">${transporterName}</div>
      ${transporterLine ? `<div style="margin-top: 1mm; font-size: ${sp.tBarSubPt}pt; font-weight: 400; color: ${inkSaver ? '#666' : '#444'};">${esc(transporterLine)}</div>` : ''}
    </div>` : ''}
    
    <div class="middle">
      <div class="middle-inner">
        ${careHtml}
        <div>
          <div style="font-size: ${sp.toPt}pt; font-weight: 800; text-decoration: underline; color: ${bodyColor};">To:</div>
          <div style="font-size: ${sp.coPt}pt; font-weight: 900; line-height: 1.05; word-break: break-word; margin-top: 4pt; color: ${bodyColor};">${customerName}</div>
        </div>
        <div style="font-size: ${sp.adPt}pt; line-height: 1.4; white-space: pre-wrap; color: ${bodyColor};">${customerAddress}</div>
        ${customerPinState ? `<div style="font-size: ${sp.adPt}pt; color: ${inkSaver ? '#666' : '#333'};">${customerPinState}</div>` : ''}
        ${contactsHtml}
      </div>
    </div>
    
    ${showFrom ? `
    <div class="bottom">
      ${!isEnv ? `<div style="font-size: ${sp.fNmPt}pt; font-weight: 800; text-decoration: underline; margin-bottom: 1.5mm; color: ${bodyColor};">From:</div>` : ''}
      <div style="display: flex; align-items: flex-start; gap: 2.5mm;">
        ${bottomLogo}
        <div style="flex: 1; font-size: ${sp.fAdPt}pt; line-height: 1.4; color: ${bodyColor};">
          <div style="font-size: ${sp.fNmPt}pt; font-weight: 800; margin-bottom: 0.5mm; color: ${bodyColor};">${esc(tenant?.name || '')}</div>
          <div>${esc(bottomAddress)}</div>
          <div>Ph: ${esc(bottomPhones)}</div>
        </div>
      </div>
    </div>` : ''}`

    if (isA5TwoUp) {
      // Two identical landscape tiles stacked on one A4 sheet (148mm x2 = 296mm, fits the
      // 297mm page height), plus a dashed guide line at the midpoint to cut along.
      return `
      <div class="sheet">${labelContent}</div>
      <div class="sheet" style="top: ${tileH}mm;">${labelContent}</div>
      <div style="position: absolute; top: ${tileH}mm; left: 0; width: 100%; border-top: 1px dashed #999;"></div>`
    }

    return `<div class="sheet">${labelContent}</div>`
  })()}
  <script>window.addEventListener('load',()=>{setTimeout(()=>{window.focus();window.print();},250);});window.onafterprint=()=>{try{window.close();}catch(e){};};</script>
</body>
</html>`
}

export default function PrintSection({ tenant, customers, transporters, defaultCustomer, onPrintDone }: Props) {
  const [selCustId, setSelCustId] = useState(defaultCustomer?.id ?? '')
  const [custSearch, setCustSearch] = useState(defaultCustomer?.company_name ?? '')
  const [showCustList, setShowCustList] = useState(false)
  const custRef = useRef<HTMLDivElement>(null)

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
  const [inkSaver, setInkSaver] = useState(false)
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
  }, [defaultCustomer?.id])

  useEffect(() => {
    setSelContacts(customer ? customer.contacts.map((_, i) => i) : [])
  }, [selCustId])

  useEffect(() => { setBranch(''); setMode(''); setFreight(''); setLr('') }, [selTransId])
  useEffect(() => { if (showFrom) setSelPhones([...allPhones]) }, [showFrom])
  useEffect(() => { setSelPhones([...allPhones]) }, [])

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
    
    const filteredCustomer = {
      ...customer,
      contacts: customer.contacts.filter((_, i) => selContacts.includes(i))
    }
    
    const filteredTenant = {
      ...tenant,
      phone: selPhones[0] || '',
      extra_phones: selPhones.slice(1)
    }

    const html = buildPrintHTML(
      SIZE_KEY_MAP[size],
      filteredCustomer,
      transporter as Transporter,
      { branch, freight, lr, mode },
      showFrom,
      filteredTenant,
      careSym.map(s => CARE_KEY_MAP[s]),
      inkSaver
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

  // Mirrors buildPrintHTML: A5 renders as two landscape tiles stacked on one A4 sheet.
  const isA5TwoUp = size === 'A5'
  const tileW = isA5TwoUp ? ph : pw
  const tileH = isA5TwoUp ? pw : ph
  const canvasW = tileW
  const canvasH = isA5TwoUp ? tileH * 2 : tileH

  const PREVIEW_W = 320
  const scale = PREVIEW_W / (canvasW * MM)
  const previewH = Math.round(canvasH * MM * scale)

  const pvCareRow = careSym.length > 0 ? <CareRow careKeys={careSym.map(s => CARE_KEY_MAP[s])} sp={sp} isEnv={isEnv} inkSaver={inkSaver} /> : null

  const pvTBar = transporter ? (
    <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 2.5 * MM, marginBottom: sp.gapMm * MM, flexShrink: 0 }}>
      <div style={{ fontSize: sp.tBarPt * PT, fontWeight: 800, color: inkSaver ? '#555' : '#000' }}>{transporter.name}</div>
      {[branch, freight, lr, mode].filter(Boolean).length > 0 && (
        <div style={{ marginTop: 1 * MM, fontSize: sp.tBarSubPt * PT, fontWeight: 400, color: inkSaver ? '#666' : '#444' }}>
          {[branch, freight, lr, mode].filter(Boolean).join(' · ')}
        </div>
      )}
    </div>
  ) : null

  const customerPinState = [customer?.pin, customer?.state, customer?.country].filter(Boolean).join(', ')
  const activeContacts = customer?.contacts.filter((_, i) => selContacts.includes(i)) || []

  const pvToBlock = customer ? (
    <div style={{ 
      ...(isEnv ? { marginLeft: '55%', width: `calc(45% - ${sp.padMm * MM}px)`, maxHeight: '100%', overflow: 'hidden' } : { width: '100%', flexGrow: 1 }), 
      display: 'flex', flexDirection: 'column', 
      ...(isEnv ? { gap: `${sp.lineGapPt}pt`, justifyContent: 'center' } : { justifyContent: 'space-evenly', paddingTop: '5mm', paddingBottom: '5mm' }) 
    }}>
      {pvCareRow}
      <div>
        <div style={{ fontSize: sp.toPt * PT, fontWeight: 800, textDecoration: 'underline', color: inkSaver ? '#555' : '#000' }}>To:</div>
        <div style={{ fontSize: sp.coPt * PT, fontWeight: 900, lineHeight: 1.05, wordBreak: 'break-word', marginTop: 4 * PT, color: inkSaver ? '#555' : '#000' }}>{customer.company_name}</div>
      </div>
      <div style={{ fontSize: sp.adPt * PT, lineHeight: 1.4, whiteSpace: 'pre-wrap', color: inkSaver ? '#555' : '#000' }}>{customer.address}</div>
      {customerPinState && <div style={{ fontSize: sp.adPt * PT, color: inkSaver ? '#666' : '#333' }}>{customerPinState}</div>}
      {activeContacts.length > 0 && (
        <div>
          {activeContacts.map((ct, i) => (
            <div key={i} style={{ fontSize: sp.adPt * PT, fontWeight: 800, marginTop: 4 * PT, color: inkSaver ? '#555' : '#000' }}>{ct.name}{ct.phone ? ` : ${ct.phone}` : ''}</div>
          ))}
        </div>
      )}
    </div>
  ) : null

  const pvFromInner = showFrom ? (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 2.5 * MM }}>
      {tenant.logo_url && (
        <img src={tenant.logo_url} alt="" style={{ maxHeight: sp.logoMm * MM, maxWidth: 28 * MM, objectFit: 'contain', flexShrink: 0, filter: inkSaver ? 'grayscale(100%)' : 'none' }} />
      )}
      <div style={{ flex: 1, fontSize: sp.fAdPt * PT, lineHeight: 1.4, color: inkSaver ? '#555' : '#000' }}>
        <div style={{ fontSize: sp.fNmPt * PT, fontWeight: 800, marginBottom: 0.5 * MM, color: inkSaver ? '#555' : '#000' }}>{tenant.name}</div>
        <div>{[tenant.address, tenant.pin, tenant.state].filter(Boolean).join(', ')}</div>
        <div>Ph: {phones.join(' / ')}</div>
      </div>
    </div>
  ) : null

  const pvFromPortrait = showFrom ? (
    <div style={{ borderTop: '2px solid #000', paddingTop: 2.5 * MM, marginTop: sp.gapMm * MM, flexShrink: 0 }}>
      <div style={{ fontSize: sp.fNmPt * PT, fontWeight: 800, textDecoration: 'underline', marginBottom: 1.5 * MM, color: inkSaver ? '#555' : '#000' }}>From:</div>
      {pvFromInner}
    </div>
  ) : null

  const pvFromEnv = showFrom ? (
    <div style={{ position: 'absolute', left: sp.padMm * MM, bottom: sp.padMm * MM, width: `calc(50% - ${sp.padMm * 2 * MM}px)`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', overflow: 'hidden' }}>
      {pvFromInner}
    </div>
  ) : null

  const inp = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#14B8A6] focus:ring-2 focus:ring-[#14B8A6]/20 bg-white'
  const sec = 'mb-5'
  const hd = 'text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2'
  const dropWrap = 'absolute z-20 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg'
  const dropItem = (active: boolean) => `w-full px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${active ? 'bg-[#f0fdf9] text-[#0F766E] font-semibold' : 'text-slate-700'}`
  const xBtn = <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-[420px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-5">
        <div className={sec}>
          <p className={hd}>Customer *</p>
          <div className="relative" ref={custRef}>
            <div className="relative">
              <input type="text" value={custSearch} onChange={e => { setCustSearch(e.target.value); setSelCustId(''); setShowCustList(true) }} onFocus={() => setShowCustList(true)} placeholder="Search customer…" className={inp + (custSearch ? ' pr-8' : '')} />
              {custSearch && <button onClick={clearCust} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{xBtn}</button>}
            </div>
            {showCustList && (
              <div className={dropWrap}>
                {filteredCusts.length === 0 ? <div className="px-3 py-2 text-sm text-slate-400">No customers found</div> : filteredCusts.map(c => <button key={c.id} onMouseDown={() => pickCust(c)} className={dropItem(c.id === selCustId)}>{c.company_name}</button>)}
              </div>
            )}
          </div>
        </div>

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

        <div className={sec}>
          <p className={hd}>Transporter (optional)</p>
          <div className="relative" ref={transRef}>
            <div className="relative">
              <input type="text" value={transSearch} onChange={e => { setTransSearch(e.target.value); setSelTransId(''); setShowTransList(true) }} onFocus={() => setShowTransList(true)} placeholder="Search transporter…" className={inp + (transSearch ? ' pr-8' : '')} />
              {transSearch && <button onClick={clearTrans} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{xBtn}</button>}
            </div>
            {showTransList && (
              <div className={dropWrap}>
                {filteredTrans.length === 0 ? <div className="px-3 py-2 text-sm text-slate-400">No transporters found</div> : filteredTrans.map(t => (
                    <button key={t.id} onMouseDown={() => pickTrans(t)} className={dropItem(t.id === selTransId)}>
                      <span className="font-medium">{t.name}</span>
                      <span className="ml-2 text-xs text-slate-400">{t.type === 'courier' ? 'Courier' : 'Transport'}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>
          {transporter && (
            <div className="mt-3 space-y-2.5 rounded-lg bg-slate-50 p-3">
              <div><label className="block text-xs font-medium text-slate-500 mb-1">Branch</label><input value={branch} onChange={e => setBranch(e.target.value)} placeholder="To branch — optional" className={inp} /></div>
              {transporter.type === 'courier' ? (
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Mode</label><select value={mode} onChange={e => setMode(e.target.value)} className={inp}><option value="">— optional —</option>{MODE_OPTS.map(o => <option key={o}>{o}</option>)}</select></div>
              ) : (
                <>
                  <div><label className="block text-xs font-medium text-slate-500 mb-1">Freight</label><select value={freight} onChange={e => setFreight(e.target.value)} className={inp}><option value="">— optional —</option>{FREIGHT_OPTS.map(o => <option key={o}>{o}</option>)}</select></div>
                  <div><label className="block text-xs font-medium text-slate-500 mb-1">LR</label><select value={lr} onChange={e => setLr(e.target.value)} className={inp}><option value="">— optional —</option>{LR_OPTS.map(o => <option key={o}>{o}</option>)}</select></div>
                </>
              )}
            </div>
          )}
        </div>

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

        <div className={sec}>
          <p className={hd}>Paper Size</p>
          <div className="flex flex-wrap gap-1.5">
            {SIZES.map(s => <button key={s} type="button" onClick={() => setSize(s)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${size === s ? 'bg-[#0F766E] text-white' : 'border border-slate-200 text-slate-600 hover:border-[#0F766E] hover:text-[#0F766E]'}`}>{s}</button>)}
          </div>
        </div>

        <div className={sec}>
          <p className={hd}>Ink Mode</p>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setInkSaver(false)} className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${!inkSaver ? 'bg-[#0F766E] text-white' : 'border border-slate-200 text-slate-600 hover:border-[#0F766E] hover:text-[#0F766E]'}`}>⬛ Standard (Black)</button>
            <button type="button" onClick={() => setInkSaver(true)} className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${inkSaver ? 'bg-[#0F766E] text-white' : 'border border-slate-200 text-slate-600 hover:border-[#0F766E] hover:text-[#0F766E]'}`}>◽ Ink Saver (Grey)</button>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">Ink Saver lightens address and detail text to use less ink on high-volume prints. Headings stay black for readability.</p>
        </div>

        <div className={sec}>
          <div className="flex items-center justify-between">
            <p className={hd}>Handle With Care</p>
            <button
              type="button"
              onClick={() => setCareSym(careSym.length === CARE_SYMBOLS.length ? [] : [...CARE_SYMBOLS])}
              className="text-xs font-semibold text-[#0F766E] hover:underline"
            >
              {careSym.length === CARE_SYMBOLS.length ? 'Clear all' : 'Select all'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {CARE_SYMBOLS.map(sym => (
              <button key={sym} type="button" onClick={() => toggleCare(sym)} className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-2.5 min-w-[80px] transition-all ${careSym.includes(sym) ? 'border-[#0F766E] bg-[#0F766E]/10 text-[#0F766E]' : 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700'}`}>
                <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><CareSvgContent c={CARE_KEY_MAP[sym]} /></svg>
                <span className="text-[11px] font-semibold text-center leading-tight">{sym}</span>
              </button>
            ))}
          </div>
        </div>

        {printErr && <p className="mb-3 text-sm text-red-500">{printErr}</p>}

        <div className="space-y-2 sticky bottom-0 bg-white pt-2 border-t border-slate-100">
          <button onClick={handlePrint} disabled={isPending} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F766E] py-3 text-sm font-bold text-white hover:bg-[#0d6b63] disabled:opacity-60 transition">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a1 1 0 001 1h8a1 1 0 001-1v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1zm2 0h6v3H7V4zm-1 9h8v3H6v-3zm2-4a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" /></svg>
            {isPending ? 'Saving…' : 'Print Label'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-100 p-6 flex flex-col items-center">
        <p className="mb-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Live Preview — {size}</p>
        {!customer ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white px-8 py-16 text-center" style={{ width: PREVIEW_W }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <p className="text-sm text-slate-400">Select a customer to preview the label</p>
          </div>
        ) : (
          <div className="shadow-2xl" style={{ width: PREVIEW_W, height: previewH, overflow: 'hidden', position: 'relative' }}>
            {(() => {
              const tileStyle = {
                width: tileW * MM, height: tileH * MM,
                background: 'white', fontFamily: 'Arial, Helvetica, sans-serif', color: '#000',
                display: 'flex', flexDirection: 'column' as const,
                padding: sp.padMm * MM, boxSizing: 'border-box' as const, overflow: 'hidden',
                position: 'absolute' as const, left: 0,
              }
              const tileBody = (
                <>
                  {pvTBar}
                  <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', ...(isEnv ? { justifyContent: 'center', maxHeight: '100%', overflow: 'hidden' } : { justifyContent: 'space-evenly', paddingTop: '5mm', paddingBottom: '5mm' }), minHeight: 0 }}>
                    {pvToBlock}
                  </div>
                  {isEnv ? pvFromEnv : pvFromPortrait}
                </>
              )

              if (isA5TwoUp) {
                return (
                  <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: canvasW * MM, height: canvasH * MM, position: 'relative' }}>
                    <div style={{ ...tileStyle, top: 0 }}>{tileBody}</div>
                    <div style={{ ...tileStyle, top: tileH * MM }}>{tileBody}</div>
                    <div style={{ position: 'absolute', top: tileH * MM, left: 0, width: '100%', borderTop: '1px dashed #999' }} />
                  </div>
                )
              }

              return (
                <div style={{ ...tileStyle, position: 'relative', transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                  {tileBody}
                </div>
              )
            })()}
          </div>
        )}
        <p className="mt-3 text-xs text-slate-400">
          {isA5TwoUp ? `2× ${tileW}mm × ${tileH}mm on one A4 sheet — cut in half` : `${pw}mm × ${ph}mm`} &nbsp;·&nbsp; Screen preview exactly matches print dimensions
        </p>
      </div>
    </div>
  )
}