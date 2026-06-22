'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import type { Tenant, Customer, Transporter } from './types'
import { logout, checkSessionValid, clearSessionCookie } from './actions'
import DashboardSection from './sections/DashboardSection'
import CustomersSection from './sections/CustomersSection'
import TransportersSection from './sections/TransportersSection'
import PrintSection from './sections/PrintSection'
import ProfileSection from './sections/ProfileSection'

export type Section = 'dashboard' | 'customers' | 'transporters' | 'print' | 'profile'

// Auto-logout after this long with zero clicks/keys/scrolling — framed to customers
// as a data-safety measure, not just a technical session limit.
const IDLE_TIMEOUT_MS = 15 * 60 * 1000

interface Props {
  tenant: Tenant
  initialCustomers: Customer[]
  initialTransporters: Transporter[]
  fontClassName: string
}

const NAV: { id: Section; label: string; icon: React.ReactNode }[] = [
  {
    id: 'dashboard', label: 'Dashboard',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" /></svg>,
  },
  {
    id: 'customers', label: 'Customers',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>,
  },
  {
    id: 'transporters', label: 'Transporters',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" /><path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" /></svg>,
  },
  {
    id: 'print', label: 'Print Address',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a1 1 0 001 1h8a1 1 0 001-1v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1zm2 0h6v3H7V4zm-1 9h8v3H6v-3zm2-4a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" /></svg>,
  },
  {
    id: 'profile', label: 'Company Profile',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" /></svg>,
  },
]

export default function DashboardShell({ tenant, initialCustomers, initialTransporters, fontClassName }: Props) {
  const router = useRouter()
  const [section, setSection] = useState<Section>('dashboard')
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers)
  const [transporters, setTransporters] = useState<Transporter[]>(initialTransporters)
  const [tenantData, setTenantData] = useState<Tenant>(tenant)
  const [printDefaultCustomer, setPrintDefaultCustomer] = useState<Customer | undefined>()
  const [loggingOut, setLoggingOut] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
    router.push(`/${tenant.slug}/login`)
  }

  const lastActivityRef = useRef<number>(0)

  async function bounceToLogin(reason: 'kicked' | 'idle') {
    if (reason === 'idle') {
      // Real logout — also nulls the DB token, since nobody else has taken over this session.
      await logout()
    } else {
      // Cookie only — the DB token now belongs to whichever login kicked this one out.
      await clearSessionCookie()
    }
    router.push(`/${tenant.slug}/login?reason=${reason}`)
  }

  async function runPeriodicCheck() {
    if (Date.now() - lastActivityRef.current >= IDLE_TIMEOUT_MS) {
      await bounceToLogin('idle')
      return
    }
    const valid = await checkSessionValid()
    if (!valid) await bounceToLogin('kicked')
  }

  // Background check — catches both (a) someone leaves the dashboard open
  // without touching it for 15+ minutes (auto-logout for data safety), and
  // (b) this session got kicked out by a login elsewhere. Also re-checks the
  // instant the tab becomes visible/focused again, since browsers throttle
  // timers in background tabs and a fixed interval alone can be unreliable
  // for "switched away and back".
  useEffect(() => {
    lastActivityRef.current = Date.now()

    function markActive() {
      lastActivityRef.current = Date.now()
    }
    const activityEvents: (keyof WindowEventMap)[] = ['mousedown', 'keydown', 'touchstart', 'scroll']
    activityEvents.forEach((evt) => window.addEventListener(evt, markActive, { passive: true }))

    const interval = setInterval(() => {
      runPeriodicCheck()
    }, 15000)

    function handleVisible() {
      if (document.visibilityState === 'visible') runPeriodicCheck()
    }
    document.addEventListener('visibilitychange', handleVisible)
    window.addEventListener('focus', handleVisible)

    return () => {
      activityEvents.forEach((evt) => window.removeEventListener(evt, markActive))
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisible)
      window.removeEventListener('focus', handleVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function navigate(s: Section, customer?: Customer) {
    if (s === 'print' && customer) setPrintDefaultCustomer(customer)
    else if (s !== 'print') setPrintDefaultCustomer(undefined)
    setSection(s)
  }

  const onCustomerAdded = (c: Customer) =>
    setCustomers(p => [...p, c].sort((a, b) => a.company_name.localeCompare(b.company_name)))
  const onCustomerUpdated = (c: Customer) =>
    setCustomers(p => p.map(x => (x.id === c.id ? c : x)))
  const onCustomerDeleted = (id: string) =>
    setCustomers(p => p.filter(x => x.id !== id))

  const onTransporterAdded = (t: Transporter) =>
    setTransporters(p => [...p, t].sort((a, b) => a.name.localeCompare(b.name)))
  const onTransporterUpdated = (t: Transporter) =>
    setTransporters(p => p.map(x => (x.id === t.id ? t : x)))
  const onTransporterDeleted = (id: string) =>
    setTransporters(p => p.filter(x => x.id !== id))

  const onPrintDone = (counts: { prints_month: number; prints_lifetime: number }) =>
    setTenantData(p => ({ ...p, ...counts }))

  const onExtraPhonesUpdated = (phones: string[]) =>
    setTenantData(p => ({ ...p, extra_phones: phones }))

  return (
    <div className={`${fontClassName} flex h-screen flex-col overflow-hidden bg-slate-100`}>
      {/* Navbar */}
      <header className="flex h-14 shrink-0 items-center justify-between bg-[#0F172A] px-5 shadow-md z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileNavOpen((v) => !v)}
            className="-ml-1.5 flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-white/5 md:hidden"
            aria-label="Toggle menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0F766E]">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-white">
              <path d="M13 2L3 14h8.5l-1.5 8L20 10h-8.5L13 2z" />
            </svg>
          </div>
          <span className="text-[15px] font-bold tracking-tight text-white">AddressPrint</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-400 sm:block">{tenantData.name}</span>
          {tenantData.logo_url ? (
            <Image
              src={tenantData.logo_url}
              alt={tenantData.name}
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-contain ring-1 ring-white/20"
              unoptimized
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0F766E] text-sm font-bold text-white">
              {tenantData.name.charAt(0).toUpperCase()}
            </div>
          )}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white disabled:opacity-50"
          >
            {loggingOut ? 'Logging out…' : 'Logout'}
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Backdrop — mobile only, shown while the drawer is open */}
        {mobileNavOpen && (
          <div
            onClick={() => setMobileNavOpen(false)}
            className="fixed inset-0 top-14 z-20 bg-black/40 md:hidden"
          />
        )}

        {/* Sidebar — slide-in drawer on mobile, static column on desktop */}
        <aside
          className={`fixed inset-y-0 left-0 top-14 z-30 flex w-[200px] -translate-x-full flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out md:static md:top-0 md:z-auto md:w-[174px] md:translate-x-0 md:shrink-0 ${
            mobileNavOpen ? 'translate-x-0' : ''
          }`}
        >
          <nav className="flex-1 overflow-y-auto py-2">
            {NAV.map(item => (
              <button
                key={item.id}
                onClick={() => { navigate(item.id); setMobileNavOpen(false) }}
                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-medium transition-colors ${
                  section === item.id
                    ? 'border-r-[3px] border-[#0F766E] bg-[#f0fdf9] text-[#0F766E]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <span className={section === item.id ? 'text-[#0F766E]' : 'text-slate-400'}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="border-t border-slate-100 px-4 py-3">
            <p className="text-[10px] leading-tight text-slate-400">BizKit by JBSS India</p>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          {section === 'dashboard' && (
            <DashboardSection
              tenant={tenantData}
              customers={customers}
              transporters={transporters}
              onNavigate={navigate}
            />
          )}
          {section === 'customers' && (
            <CustomersSection
              tenantId={tenant.id}
              tenantName={tenantData.name}
              customers={customers}
              onAdded={onCustomerAdded}
              onUpdated={onCustomerUpdated}
              onDeleted={onCustomerDeleted}
              onPrintCustomer={(c) => navigate('print', c)}
            />
          )}
          {section === 'transporters' && (
            <TransportersSection
              tenantId={tenant.id}
              transporters={transporters}
              onAdded={onTransporterAdded}
              onUpdated={onTransporterUpdated}
              onDeleted={onTransporterDeleted}
            />
          )}
          {section === 'print' && (
            <PrintSection
              tenant={tenantData}
              customers={customers}
              transporters={transporters}
              defaultCustomer={printDefaultCustomer}
              onPrintDone={onPrintDone}
            />
          )}
          {section === 'profile' && (
            <ProfileSection
              tenant={tenantData}
              onExtraPhonesUpdated={onExtraPhonesUpdated}
            />
          )}
        </main>
      </div>
    </div>
  )
}
