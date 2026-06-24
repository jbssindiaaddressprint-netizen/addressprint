'use server'

import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { SESSION_COOKIE, encodeSession } from '@/lib/session'

export type UniversalLoginState = {
  status: 'idle' | 'error'
  error?: string
}

export async function universalLogin(
  _prev: UniversalLoginState,
  formData: FormData
): Promise<UniversalLoginState> {
  const phoneRaw = (formData.get('phone') as string) ?? ''
  const password = (formData.get('password') as string) ?? ''
  const phoneDigits = phoneRaw.replace(/\D/g, '').slice(-10)

  if (phoneDigits.length < 10) return { status: 'error', error: 'Please enter a valid 10-digit mobile number.' }
  if (!password) return { status: 'error', error: 'Please enter your password.' }

  const genericError: UniversalLoginState = { status: 'error', error: 'Incorrect mobile number or password.' }

  // Phone numbers aren't guaranteed unique across tenants (a few old test accounts
  // share one), so check every tenant whose number ends in these digits, not just
  // the first match — and try every active login on each, same as the per-slug flow.
  const { data: tenants } = await supabaseAdmin
    .from('tenants')
    .select('id, slug, is_active')
    .ilike('phone', `%${phoneDigits}`)

  if (!tenants || tenants.length === 0) return genericError

  for (const tenant of tenants) {
    if (tenant.is_active === false) continue

    const { data: logins } = await supabaseAdmin
      .from('tenant_logins')
      .select('id, password_hash')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)

    for (const login of logins ?? []) {
      const isMatch = await bcrypt.compare(password, login.password_hash as string)
      if (!isMatch) continue

      // Found it — issue a session ticket exactly like the per-slug login does,
      // so the existing middleware, single-session enforcement, etc. all just work.
      const token = randomUUID()

      await supabaseAdmin
        .from('tenant_logins')
        .update({ session_token: token, session_updated_at: new Date().toISOString() })
        .eq('id', login.id)

      const cookieStore = await cookies()
      cookieStore.set(SESSION_COOKIE, encodeSession(login.id as string, tenant.id as string, token), {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 90, // 90 days
      })

      redirect(`/${tenant.slug}`)
    }
  }

  return genericError
}
