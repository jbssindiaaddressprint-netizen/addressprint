import { NextResponse, type NextRequest } from 'next/server'
import { decodeSession, SESSION_COOKIE } from '@/lib/session'

// Top-level paths that are NOT tenant dashboards and should never be password-protected.
const RESERVED_PATHS = new Set(['onboard', 'admin', 'api'])

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const segments = pathname.split('/').filter(Boolean)

  // The tenant dashboard always lives at exactly one segment, e.g. "/max-machine-tools".
  // Anything else (root "/", "/onboard", "/some-slug/login", etc.) passes through untouched.
  if (segments.length !== 1) return NextResponse.next()

  const slug = segments[0]
  if (RESERVED_PATHS.has(slug)) return NextResponse.next()

  const loginUrl = new URL(`/${slug}/login`, request.url)

  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value)
  if (!session) return NextResponse.redirect(loginUrl)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SECRET_KEY!
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }

  // Confirm the slug in the URL actually belongs to the tenant recorded in the cookie.
  const tenantRes = await fetch(
    `${supabaseUrl}/rest/v1/tenants?slug=eq.${encodeURIComponent(slug)}&select=id`,
    { headers }
  )
  const tenantRows = (await tenantRes.json()) as { id: string }[]
  const tenantId = tenantRows?.[0]?.id
  if (!tenantId || tenantId !== session.tenantId) return NextResponse.redirect(loginUrl)

  // Confirm the session ticket still matches what's stored in the database.
  // If someone logged in elsewhere since, this won't match anymore — single-session enforcement.
  const loginRes = await fetch(
    `${supabaseUrl}/rest/v1/tenant_logins?id=eq.${session.loginId}&select=session_token,is_active,tenant_id`,
    { headers }
  )
  const loginRows = (await loginRes.json()) as
    { session_token: string | null; is_active: boolean; tenant_id: string }[]
  const login = loginRows?.[0]

  const valid =
    login &&
    login.is_active &&
    login.tenant_id === tenantId &&
    login.session_token === session.token

  if (!valid) return NextResponse.redirect(loginUrl)

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
