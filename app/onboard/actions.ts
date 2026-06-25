'use server'

import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { sendBrevoEmail } from '@/lib/brevo'
import { sendWhatsAppTemplate } from '@/lib/whatsapp'

export type OnboardState = {
  status: 'idle' | 'verify' | 'success' | 'error'
  slug?: string
  error?: string
  pendingId?: string
  email?: string
  phone?: string
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

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// ============================================================
// Step 1 — collect signup details, verify email + phone really
// belong to the person before any account is created.
// ============================================================
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

  const passwordHash = await bcrypt.hash(password, 10)
  const emailOtp = generateOtp()
  const phoneOtp = generateOtp()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const { data: pending, error: pendingError } = await supabaseAdmin
    .from('pending_signups')
    .insert({
      company_name: companyName,
      address,
      pin,
      state,
      country,
      phone,
      email,
      password_hash: passwordHash,
      logo_url: logoUrl,
      email_otp: emailOtp,
      phone_otp: phoneOtp,
      expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (pendingError || !pending) return { status: 'error', error: pendingError?.message ?? 'Could not start signup. Please try again.' }

  const emailResult = await sendBrevoEmail(
    email,
    'Your AddressPrint verification code',
    `<div style="font-family: sans-serif; max-width: 480px;">
      <p>Hi ${companyName},</p>
      <p>Your email verification code for AddressPrint is:</p>
      <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px; margin: 16px 0;">${emailOtp}</p>
      <p>Enter this along with the code sent to your WhatsApp to finish creating your account. This code expires in 10 minutes.</p>
      <p style="color: #888; font-size: 12px; margin-top: 24px;">JBSS AddressPrint &middot; support@jbssindia.com</p>
    </div>`
  )

  const whatsappResult = await sendWhatsAppTemplate(phone, 'ap_otp_code', [phoneOtp], { buttonCode: phoneOtp })

  if (!emailResult.success || !whatsappResult.success) {
    // Clean up the pending row — no point leaving an unverifiable signup behind.
    await supabaseAdmin.from('pending_signups').delete().eq('id', pending.id)
    const failedChannel = !emailResult.success ? 'email' : 'WhatsApp'
    return {
      status: 'error',
      error: `Could not send the verification code to your ${failedChannel}. Please check your ${failedChannel === 'email' ? 'email address' : 'phone number'} and try again.`,
    }
  }

  return { status: 'verify', pendingId: pending.id, email, phone }
}

// ============================================================
// Step 2 — confirm both codes, then actually create the account.
// ============================================================
export async function verifySignupOtp(
  _prev: OnboardState,
  formData: FormData
): Promise<OnboardState> {
  const pendingId = (formData.get('pendingId') as string)?.trim()
  const emailOtp = (formData.get('emailOtp') as string)?.trim()
  const phoneOtp = (formData.get('phoneOtp') as string)?.trim()

  if (!pendingId) return { status: 'error', error: 'Something went wrong. Please refresh and start signup again.' }
  if (!emailOtp || !phoneOtp) return { status: 'error', error: 'Please enter both codes.' }

  const { data: pending } = await supabaseAdmin
    .from('pending_signups')
    .select('*')
    .eq('id', pendingId)
    .single()

  if (!pending) {
    return { status: 'error', error: 'This verification session was not found. Please start signup again.' }
  }

  if (new Date(pending.expires_at).getTime() < Date.now()) {
    return {
      status: 'verify',
      pendingId,
      email: pending.email,
      phone: pending.phone,
      error: 'Your codes have expired. Click "Resend codes" below and try again.',
    }
  }

  if (pending.email_otp !== emailOtp) {
    return { status: 'verify', pendingId, email: pending.email, phone: pending.phone, error: 'Incorrect email code. Please check and try again.' }
  }

  if (pending.phone_otp !== phoneOtp) {
    return { status: 'verify', pendingId, email: pending.email, phone: pending.phone, error: 'Incorrect WhatsApp code. Please check and try again.' }
  }

  const slug = await generateUniqueSlug(toSlug(pending.company_name))
  const trialEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()

  const { data: newTenant, error: dbError } = await supabaseAdmin
    .from('tenants')
    .insert({
      name: pending.company_name,
      address: pending.address,
      pin: pending.pin,
      state: pending.state,
      country: pending.country,
      phone: pending.phone,
      email: pending.email,
      slug,
      logo_url: pending.logo_url,
      subscription_status: 'trial',
      trial_ends_at: trialEndsAt,
    })
    .select('id')
    .single()

  if (dbError || !newTenant) return { status: 'error', error: dbError?.message ?? 'Could not create account.' }

  const { error: loginError } = await supabaseAdmin.from('tenant_logins').insert({
    tenant_id: newTenant.id,
    label: 'Owner',
    password_hash: pending.password_hash,
  })

  if (loginError) {
    await supabaseAdmin.from('tenants').delete().eq('id', newTenant.id)
    return { status: 'error', error: 'Could not set up your login. Please try again.' }
  }

  // Best-effort welcome + internal notify — signup still succeeds even if these fail.
  const emailResult = await sendBrevoEmail(
    pending.email,
    'Welcome to AddressPrint!',
    `<div style="font-family: sans-serif; max-width: 480px;">
      <p>Hi ${pending.company_name},</p>
      <p>Your AddressPrint account is ready! You can log in and start printing address labels right away:</p>
      <p style="margin: 16px 0;">
        <a href="https://ap.jbssindia.com/${slug}" style="background:#0F766E;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">Open AddressPrint</a>
      </p>
      <p>Your dashboard URL: <strong>ap.jbssindia.com/${slug}</strong></p>
      <p>Forgot to bookmark it? No problem — just go to <strong>ap.jbssindia.com</strong> anytime and log in with your mobile number and password.</p>
      <p>If you ever need help, reach us at support@jbssindia.com.</p>
      <p style="color: #888; font-size: 12px; margin-top: 24px;">JBSS AddressPrint &middot; support@jbssindia.com</p>
    </div>`
  )
  if (!emailResult.success) console.error(`Welcome email failed for new tenant ${newTenant.id}:`, emailResult.error)

  const trialEndDateText = new Date(trialEndsAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const adminNotifyResult = await sendBrevoEmail(
    'info@jbssindia.com',
    `New AddressPrint trial signup: ${pending.company_name}`,
    `<div style="font-family: sans-serif; max-width: 480px;">
      <p>A new AddressPrint trial account just signed up (email + phone verified).</p>
      <table style="font-size: 14px; border-collapse: collapse;">
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Company</td><td>${pending.company_name}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Slug</td><td>ap.jbssindia.com/${slug}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Email</td><td>${pending.email}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Phone</td><td>${pending.phone}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Trial ends</td><td>${trialEndDateText}</td></tr>
      </table>
    </div>`
  )
  if (!adminNotifyResult.success) console.error(`Admin signup-notify email failed for new tenant ${newTenant.id}:`, adminNotifyResult.error)

  const whatsappResult = await sendWhatsAppTemplate(pending.phone, 'ap_welcome', [pending.company_name])
  if (!whatsappResult.success) console.error(`Welcome WhatsApp failed for new tenant ${newTenant.id}:`, whatsappResult.error)

  const trialResult = await sendWhatsAppTemplate(pending.phone, 'ap_trial_started', [pending.company_name, trialEndDateText])
  if (!trialResult.success) console.error(`Trial-started WhatsApp failed for new tenant ${newTenant.id}:`, trialResult.error)

  // Clean up — best-effort, signup has already succeeded at this point.
  await supabaseAdmin.from('pending_signups').delete().eq('id', pending.id)

  return { status: 'success', slug }
}

// ============================================================
// Resend both codes — same pending row, fresh codes + expiry.
// ============================================================
export async function resendSignupOtp(pendingId: string): Promise<{ success: boolean; error?: string }> {
  const { data: pending } = await supabaseAdmin
    .from('pending_signups')
    .select('id, company_name, email, phone')
    .eq('id', pendingId)
    .single()

  if (!pending) return { success: false, error: 'This verification session was not found. Please start signup again.' }

  const emailOtp = generateOtp()
  const phoneOtp = generateOtp()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  await supabaseAdmin
    .from('pending_signups')
    .update({ email_otp: emailOtp, phone_otp: phoneOtp, expires_at: expiresAt })
    .eq('id', pending.id)

  const emailResult = await sendBrevoEmail(
    pending.email,
    'Your AddressPrint verification code',
    `<div style="font-family: sans-serif; max-width: 480px;">
      <p>Hi ${pending.company_name},</p>
      <p>Your new email verification code for AddressPrint is:</p>
      <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px; margin: 16px 0;">${emailOtp}</p>
      <p>Enter this along with the code sent to your WhatsApp to finish creating your account. This code expires in 10 minutes.</p>
      <p style="color: #888; font-size: 12px; margin-top: 24px;">JBSS AddressPrint &middot; support@jbssindia.com</p>
    </div>`
  )
  const whatsappResult = await sendWhatsAppTemplate(pending.phone, 'ap_otp_code', [phoneOtp], { buttonCode: phoneOtp })

  if (!emailResult.success || !whatsappResult.success) {
    const failedChannel = !emailResult.success ? 'email' : 'WhatsApp'
    return { success: false, error: `Could not resend the code to your ${failedChannel}. Please try again.` }
  }

  return { success: true }
}
