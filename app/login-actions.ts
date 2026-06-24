'use server'

import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { SESSION_COOKIE, encodeSession } from '@/lib/session'
import { findTenantsByIdentifier } from '@/lib/identifyTenant'

export type UniversalLoginState = {
  status: 'idle' | 'error'
  error?: string
}

export async function universalLogin(
  _prev: UniversalLoginState,
  formData: FormData
): Promise<UniversalLoginState> {
  const identifier = (formData.get('identifier') as string) ?? ''
  const password = (formData.get('password') as string) ?? ''

  if (!identifier.trim()) return { status: 'error', error: 'Please enter your mobile number or email.' }
  if (!password) return { status: 'error', error: 'Please enter your password.' }

  const genericError: UniversalLoginState = { status: 'error', error: 'Incorrect mobile number/email or password.' }

  const tenants = await findTenantsByIdentifier(identifier)
  if (tenants.length === 0) return genericError

  for (const tenant of tenants) {
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
      cookieStore.set(SESSION_COOKIE, encodeSession(login.id as string, tenant.id, token), {
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
