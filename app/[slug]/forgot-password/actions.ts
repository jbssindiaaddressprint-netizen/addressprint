'use server'

import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { sendBrevoEmail } from '@/lib/brevo'
import { sendWhatsAppTemplate } from '@/lib/whatsapp'

export type RequestOtpState = {
  status: 'idle' | 'sent' | 'error'
  error?: string
}

export type ResetPasswordState = {
  status: 'idle' | 'success' | 'error'
  error?: string
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function requestPasswordReset(
  _prev: RequestOtpState,
  formData: FormData
): Promise<RequestOtpState> {
  const slug = (formData.get('slug') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()

  if (!slug) return { status: 'error', error: 'Something went wrong. Please refresh and try again.' }
  if (!email) return { status: 'error', error: 'Please enter your email address.' }

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id, email, phone, name')
    .eq('slug', slug)
    .single()

  if (!tenant || !tenant.email || tenant.email.toLowerCase() !== email) {
    return {
      status: 'error',
      error: "That email doesn't match our records for this account. Contact support@jbssindia.com if you're unsure.",
    }
  }

  const otp = generateOtp()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const { error: updateError } = await supabaseAdmin
    .from('tenants')
    .update({ reset_otp: otp, reset_otp_expires_at: expiresAt })
    .eq('id', tenant.id)

  if (updateError) return { status: 'error', error: 'Could not generate a reset code. Please try again.' }

  const emailResult = await sendBrevoEmail(
    tenant.email,
    'Your AddressPrint password reset code',
    `<div style="font-family: sans-serif; max-width: 480px;">
      <p>Hi,</p>
      <p>Your password reset code for <strong>${tenant.name}</strong> on AddressPrint is:</p>
      <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px; margin: 16px 0;">${otp}</p>
      <p>This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
      <p style="color: #888; font-size: 12px; margin-top: 24px;">JBSS AddressPrint &middot; support@jbssindia.com</p>
    </div>`
  )

  if (!emailResult.success) {
    console.error(`Reset-code email failed for ${tenant.id}:`, emailResult.error)
    return { status: 'error', error: 'Could not send the reset code email. Please try again or contact support.' }
  }

  if (tenant.phone) {
    const whatsappResult = await sendWhatsAppTemplate(tenant.phone, 'ap_otp_code', [otp], { buttonCode: otp })
    if (!whatsappResult.success) console.error(`Reset-code WhatsApp failed for ${tenant.id}:`, whatsappResult.error)
  }

  return { status: 'sent' }
}

export async function resetPasswordWithOtp(
  _prev: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const slug = (formData.get('slug') as string)?.trim()
  const otp = (formData.get('otp') as string)?.trim()
  const password = (formData.get('password') as string) ?? ''
  const confirmPassword = (formData.get('confirmPassword') as string) ?? ''

  if (!slug || !otp) return { status: 'error', error: 'Please enter the code sent to your email.' }
  if (!password || password.length < 6) return { status: 'error', error: 'Password must be at least 6 characters.' }
  if (password !== confirmPassword) return { status: 'error', error: 'Passwords do not match.' }

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id, reset_otp, reset_otp_expires_at')
    .eq('slug', slug)
    .single()

  if (!tenant || !tenant.reset_otp || !tenant.reset_otp_expires_at) {
    return { status: 'error', error: 'No reset code found. Please request a new one.' }
  }

  if (tenant.reset_otp !== otp) {
    return { status: 'error', error: 'Incorrect code. Please check and try again.' }
  }

  if (new Date(tenant.reset_otp_expires_at).getTime() < Date.now()) {
    return { status: 'error', error: 'This code has expired. Please request a new one.' }
  }

  const passwordHash = await bcrypt.hash(password, 10)

  // Reset the Owner login's password and force any existing session to log out.
  const { error: pwError } = await supabaseAdmin
    .from('tenant_logins')
    .update({ password_hash: passwordHash, session_token: null })
    .eq('tenant_id', tenant.id)
    .eq('label', 'Owner')

  if (pwError) return { status: 'error', error: 'Could not reset your password. Please try again.' }

  // Clear the OTP so it can't be reused.
  await supabaseAdmin
    .from('tenants')
    .update({ reset_otp: null, reset_otp_expires_at: null })
    .eq('id', tenant.id)

  return { status: 'success' }
}
