'use server'

import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { sendBrevoEmail } from '@/lib/brevo'

export type OnboardState = {
  status: 'idle' | 'success' | 'error'
  slug?: string
  error?: string
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

async function generateUniqueSlug(base: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('tenants')
    .select('slug')
    .or(`slug.eq.${base},slug.like.${base}-%`)

  if (!data || data.length === 0) return base

  const existing = new Set(data.map((r: { slug: string }) => r.slug))
  if (!existing.has(base)) return base

  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}-${i}`
    if (!existing.has(candidate)) return candidate
  }

  return `${base}-${Date.now()}`
}

export async function onboardTenant(
  _prev: OnboardState,
  formData: FormData
): Promise<OnboardState> {
  const companyName = (formData.get('companyName') as string)?.trim()
  const address = (formData.get('address') as string)?.trim()
  const pin = (formData.get('pin') as string)?.trim()
  const state = (formData.get('state') as string)?.trim()
  const country = ((formData.get('country') as string)?.trim()) || 'India'
  const phone = (formData.get('phone') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = (formData.get('password') as string) ?? ''
  const confirmPassword = (formData.get('confirmPassword') as string) ?? ''
  const logo = formData.get('logo') as File | null

  if (!companyName) return { status: 'error', error: 'Company name is required.' }
  if (!address) return { status: 'error', error: 'Address is required.' }
  if (!pin || !/^\d{6}$/.test(pin)) return { status: 'error', error: 'A valid 6-digit PIN code is required.' }
  if (!state) return { status: 'error', error: 'State is required.' }
  if (!phone) return { status: 'error', error: 'Phone number is required.' }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: 'error', error: 'A valid email address is required.' }
  if (!password || password.length < 6) return { status: 'error', error: 'Password must be at least 6 characters.' }
  if (password !== confirmPassword) return { status: 'error', error: 'Passwords do not match.' }

  let logoUrl: string | null = null

  if (logo && logo.size > 0) {
    const allowed = ['image/png', 'image/jpeg']
    if (!allowed.includes(logo.type)) {
      return { status: 'error', error: 'Logo must be a PNG or JPG image.' }
    }
    if (logo.size > 2 * 1024 * 1024) {
      return { status: 'error', error: 'Logo must be under 2 MB.' }
    }

    const ext = logo.type === 'image/png' ? 'png' : 'jpg'
    const basePath = toSlug(companyName)
    const path = `${basePath}-${Date.now()}.${ext}`
    const bytes = await logo.arrayBuffer()

    const { error: uploadError } = await supabaseAdmin.storage
      .from('logos')
      .upload(path, bytes, { contentType: logo.type, upsert: false })

    if (uploadError) {
      return { status: 'error', error: `Logo upload failed: ${uploadError.message}` }
    }

    const { data: urlData } = supabaseAdmin.storage.from('logos').getPublicUrl(path)
    logoUrl = urlData.publicUrl
  }

  const slug = await generateUniqueSlug(toSlug(companyName))

  const { data: newTenant, error: dbError } = await supabaseAdmin
    .from('tenants')
    .insert({
      name: companyName,
      address,
      pin,
      state,
      country,
      phone,
      email,
      slug,
      logo_url: logoUrl,
    })
    .select('id')
    .single()

  if (dbError || !newTenant) return { status: 'error', error: dbError?.message ?? 'Could not create account.' }

  const passwordHash = await bcrypt.hash(password, 10)

  const { error: loginError } = await supabaseAdmin.from('tenant_logins').insert({
    tenant_id: newTenant.id,
    label: 'Owner',
    password_hash: passwordHash,
  })

  if (loginError) {
    // Roll back the tenant row so we don't leave a login-less account behind
    await supabaseAdmin.from('tenants').delete().eq('id', newTenant.id)
    return { status: 'error', error: 'Could not set up your login. Please try again.' }
  }

  // Best-effort welcome email — signup still succeeds even if this fails.
  try {
    await sendBrevoEmail(
      email,
      'Welcome to AddressPrint!',
      `<div style="font-family: sans-serif; max-width: 480px;">
        <p>Hi ${companyName},</p>
        <p>Your AddressPrint account is ready! You can log in and start printing address labels right away:</p>
        <p style="margin: 16px 0;">
          <a href="https://addressprint.vercel.app/${slug}" style="background:#0F766E;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">Open AddressPrint</a>
        </p>
        <p>Your dashboard URL: <strong>addressprint.vercel.app/${slug}</strong></p>
        <p>If you ever need help, reach us at support@jbssindia.com.</p>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">JBSS AddressPrint &middot; support@jbssindia.com</p>
      </div>`
    )
  } catch {
    // Ignore email failures — account creation has already succeeded.
  }

  return { status: 'success', slug }
}
