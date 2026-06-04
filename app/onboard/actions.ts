'use server'

import { supabaseAdmin } from '@/lib/supabase'

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
  const logo = formData.get('logo') as File | null

  if (!companyName) return { status: 'error', error: 'Company name is required.' }
  if (!address) return { status: 'error', error: 'Address is required.' }
  if (!pin || !/^\d{6}$/.test(pin)) return { status: 'error', error: 'A valid 6-digit PIN code is required.' }
  if (!state) return { status: 'error', error: 'State is required.' }
  if (!phone) return { status: 'error', error: 'Phone number is required.' }

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

  const { error: dbError } = await supabaseAdmin.from('tenants').insert({
    name: companyName,
    address,
    pin,
    state,
    country,
    phone,
    slug,
    logo_url: logoUrl,
  })

  if (dbError) return { status: 'error', error: dbError.message }

  return { status: 'success', slug }
}
