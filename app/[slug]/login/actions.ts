'use server'

import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { SESSION_COOKIE, encodeSession } from '@/lib/session'

export type LoginState = {
  status: 'idle' | 'error'
  error?: string
}

export async function loginTenant(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const slug = (formData.get('slug') as string)?.trim()
  const password = (formData.get('password') as string) ?? ''

  if (!slug) return { status: 'error', error: 'Something went wrong. Please refresh and try again.' }
  if (!password) return { status: 'error', error: 'Please enter your password.' }

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!tenant) return { status: 'error', error: 'Account not found.' }

  const { data: logins } = await supabaseAdmin
    .from('tenant_logins')
    .select('id, password_hash')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)

  let matchedLoginId: string | null = null
  for (const login of logins ?? []) {
    const isMatch = await bcrypt.compare(password, login.password_hash as string)
    if (isMatch) {
      matchedLoginId = login.id as string
      break
    }
  }

  if (!matchedLoginId) return { status: 'error', error: 'Incorrect password.' }

  // Issue a brand new session ticket. This automatically invalidates whatever
  // ticket was issued before (to this or any other device) for this login.
  const token = randomUUID()

  await supabaseAdmin
    .from('tenant_logins')
    .update({ session_token: token, session_updated_at: new Date().toISOString() })
    .eq('id', matchedLoginId)

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, encodeSession(matchedLoginId, tenant.id, token), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 90, // 90 days
  })

  redirect(`/${slug}`)
}
