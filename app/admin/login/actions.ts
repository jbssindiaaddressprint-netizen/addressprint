'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_SESSION_COOKIE } from '@/lib/admin-session'

export type AdminLoginState = {
  status: 'idle' | 'error'
  error?: string
}

export async function loginAdmin(
  _prev: AdminLoginState,
  formData: FormData
): Promise<AdminLoginState> {
  const password = (formData.get('password') as string) ?? ''
  const expectedPassword = process.env.ADMIN_PASSWORD
  const sessionToken = process.env.ADMIN_SESSION_TOKEN

  if (!expectedPassword || !sessionToken) {
    return { status: 'error', error: 'Admin login is not configured yet. Contact the developer.' }
  }

  if (!password || password !== expectedPassword) {
    return { status: 'error', error: 'Incorrect password.' }
  }

  const cookieStore = await cookies()
  cookieStore.set(ADMIN_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })

  redirect('/admin')
}

export async function logoutAdmin() {
  const cookieStore = await cookies()
  cookieStore.delete(ADMIN_SESSION_COOKIE)
  redirect('/admin/login')
}
