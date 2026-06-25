'use client'

import { useActionState, useRef, useState } from 'react'
import { onboardTenant, verifySignupOtp, resendSignupOtp, type OnboardState } from './actions'

const initialState: OnboardState = { status: 'idle' }

// Map first 2 digits of PIN → Indian state
function getStateFromPin(pin: string): string {
  if (pin.length < 2) return ''
  const p = parseInt(pin.slice(0, 2), 10)
  if (p === 11) return 'Delhi'
  if (p === 12 || p === 13) return 'Haryana'
  if (p >= 14 && p <= 16) return 'Punjab'
  if (p === 17) return 'Himachal Pradesh'
  if (p === 18 || p === 19) return 'Jammu & Kashmir'
  if (p >= 20 && p <= 28) return 'Uttar Pradesh'
  if (p >= 30 && p <= 34) return 'Rajasthan'
  if (p >= 36 && p <= 39) return 'Gujarat'
  if (p >= 40 && p <= 44) return 'Maharashtra'
  if (p >= 45 && p <= 48) return 'Madhya Pradesh'
  if (p === 49) return 'Chhattisgarh'
  if (p === 50) return 'Telangana'
  if (p >= 51 && p <= 53) return 'Andhra Pradesh'
  if (p >= 56 && p <= 59) return 'Karnataka'
  if (p >= 60 && p <= 65) return 'Tamil Nadu'
  if (p >= 66 && p <= 69) return 'Kerala'
  if (p >= 70 && p <= 74) return 'West Bengal'
  if (p === 75 || p === 76) return 'Odisha'
  if (p >= 77 && p <= 79) return 'Assam / North East'
  if (p === 80 || p === 81 || p >= 84) return 'Bihar'
  if (p === 82 || p === 83) return 'Jharkhand'
  return ''
}

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2 MB

export default function OnboardForm() {
  const [state, formAction, pending] = useActionState(onboardTenant, initialState)
  const [verifyState, verifyAction, verifyPending] = useActionState(verifySignupOtp, initialState)
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [pin, setPin] = useState('')
  const [stateVal, setStateVal] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const passwordTooShort = password.length > 0 && password.length < 6
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword

  const locked = state.status === 'success'

  function handlePinChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    setPin(val)
    if (val.length >= 2) {
      const derived = getStateFromPin(val)
      if (derived) setStateVal(derived)
    }
    if (val.length === 0) setStateVal('')
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null)
    const file = e.target.files?.[0]
    if (!file) { setPreview(null); return }
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setFileError('Only PNG or JPG files are allowed.')
      e.target.value = ''
      setPreview(null)
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError('File must be under 2 MB.')
      e.target.value = ''
      setPreview(null)
      return
    }
    setPreview(URL.createObjectURL(file))
  }

  async function handleResend(pendingId: string) {
    setResendStatus('sending')
    const result = await resendSignupOtp(pendingId)
    setResendStatus(result.success ? 'sent' : 'error')
  }

  const inputBase =
    'w-full rounded-xl border bg-[#1E293B] px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:ring-2 focus:ring-[#14B8A6] disabled:cursor-not-allowed disabled:opacity-50'
  const inputNormal = `${inputBase} border-[#334155]`
  const labelCls = 'block text-sm font-medium text-slate-300 mb-1.5'

  // Step 3 — verified, account created.
  if (verifyState.status === 'success' && verifyState.slug) {
    const url = `ap.jbssindia.com/${verifyState.slug}`
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-[#0F766E]/40 bg-[#0F766E]/10 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0F766E]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-[#14B8A6]">Account created successfully!</p>
              <p className="mt-1 text-sm text-slate-400">Your AddressPrint page is live at:</p>
              <a
                href={`https://${url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block break-all font-mono text-sm text-[#14B8A6] underline underline-offset-2 hover:text-white transition"
              >
                {url}
              </a>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#334155] bg-[#1E293B]/50 px-5 py-4 text-sm text-slate-400">
          <span className="mr-1">🔒</span>
          Your details are now locked. To change them, email{' '}
          <a href="mailto:support@jbssindia.com" className="text-[#14B8A6] hover:underline">
            support@jbssindia.com
          </a>
        </div>

        <div className="rounded-xl border border-[#334155] bg-[#1E293B]/50 px-5 py-4 text-sm text-slate-400">
          <span className="mr-1">💡</span>
          Don&apos;t want to remember this link? Just visit <strong className="text-slate-300">ap.jbssindia.com</strong> anytime and log in with your mobile number and password.
        </div>
      </div>
    )
  }

  // Step 2 — enter the codes sent to email and WhatsApp.
  if (state.status === 'verify' && state.pendingId) {
    return (
      <form action={verifyAction} className="space-y-5">
        <input type="hidden" name="pendingId" value={state.pendingId} />

        <div className="rounded-xl border border-[#0F766E]/40 bg-[#0F766E]/10 px-4 py-3 text-sm text-[#0F766E]">
          We sent two codes to make sure these details really are yours — one to{' '}
          <strong>{state.email}</strong>, one by WhatsApp to <strong>{state.phone}</strong>. Enter both below.
        </div>

        <div>
          <label htmlFor="emailOtp" className={labelCls}>Code from Email <Required /></label>
          <input
            id="emailOtp"
            name="emailOtp"
            type="text"
            inputMode="numeric"
            maxLength={6}
            required
            placeholder="6-digit code"
            className={inputNormal}
          />
        </div>

        <div>
          <label htmlFor="phoneOtp" className={labelCls}>Code from WhatsApp <Required /></label>
          <input
            id="phoneOtp"
            name="phoneOtp"
            type="text"
            inputMode="numeric"
            maxLength={6}
            required
            placeholder="6-digit code"
            className={inputNormal}
          />
        </div>

        {verifyState.status === 'error' && (
          <div className="rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-400">
            {verifyState.error}
          </div>
        )}

        <button
          type="submit"
          disabled={verifyPending}
          className="w-full rounded-xl bg-[#0F766E] py-3.5 text-sm font-semibold text-white transition hover:bg-[#0d6b63] focus:outline-none focus:ring-2 focus:ring-[#14B8A6] focus:ring-offset-2 focus:ring-offset-[#0F172A] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {verifyPending ? 'Verifying…' : 'Verify & Create My Account'}
        </button>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => handleResend(state.pendingId as string)}
            disabled={resendStatus === 'sending'}
            className="font-medium text-[#14B8A6] hover:text-white transition disabled:opacity-50"
          >
            {resendStatus === 'sending' ? 'Resending…' : 'Resend both codes'}
          </button>
          {resendStatus === 'sent' && <span className="text-xs text-[#14B8A6]">Codes resent ✓</span>}
          {resendStatus === 'error' && <span className="text-xs text-red-400">Could not resend — try again</span>}
        </div>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="block w-full text-center text-xs text-slate-500 hover:text-slate-300 transition"
        >
          Wrong email or phone? Start over
        </button>
      </form>
    )
  }

  return (
    <form action={formAction} className="space-y-5">
      {/* Heads up: these become the printed "From" details and aren't editable later */}
      <div className="rounded-xl border border-[#0F766E]/40 bg-[#0F766E]/10 px-4 py-3 text-sm text-[#0F766E]">
        These details will be printed on your shipping labels exactly as you type them, and can&apos;t be edited after signup — please double-check before continuing.
      </div>

      {/* Company Name */}
      <div>
        <label htmlFor="companyName" className={labelCls}>Company Name <Required /></label>
        <input
          id="companyName"
          name="companyName"
          type="text"
          required
          disabled={locked}
          placeholder="Your Company Name"
          className={inputNormal}
        />
      </div>

      {/* Address */}
      <div>
        <label htmlFor="address" className={labelCls}>
          Address <span className="text-slate-500 font-normal">(street, area, city)</span> <Required />
        </label>
        <input
          id="address"
          name="address"
          type="text"
          required
          disabled={locked}
          placeholder="Your full business address"
          className={inputNormal}
        />
      </div>

      {/* PIN + State row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="pin" className={labelCls}>PIN Code <Required /></label>
          <input
            id="pin"
            name="pin"
            type="text"
            inputMode="numeric"
            required
            disabled={locked}
            value={pin}
            onChange={handlePinChange}
            maxLength={6}
            placeholder="360001"
            className={inputNormal}
          />
        </div>
        <div>
          <label htmlFor="state" className={labelCls}>
            State{' '}
            {stateVal && (
              <span className="text-[#14B8A6] text-xs font-normal">auto-filled</span>
            )}
          </label>
          <input
            id="state"
            name="state"
            type="text"
            required
            disabled={locked}
            value={stateVal}
            onChange={(e) => setStateVal(e.target.value)}
            placeholder="Gujarat"
            className={inputNormal}
          />
        </div>
      </div>

      {/* Country */}
      <div>
        <label htmlFor="country" className={labelCls}>Country</label>
        <input
          id="country"
          name="country"
          type="text"
          disabled={locked}
          defaultValue="India"
          className={inputNormal}
        />
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="phone" className={labelCls}>Primary Phone <Required /></label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          disabled={locked}
          placeholder="+91 98765 43210"
          className={inputNormal}
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className={labelCls}>Email Address <Required /></label>
        <input
          id="email"
          name="email"
          type="email"
          required
          disabled={locked}
          placeholder="you@company.com"
          className={inputNormal}
        />
        <p className="mt-1.5 text-xs text-slate-500">
          We&apos;ll use this for password resets and important account updates.
        </p>
      </div>

      {/* Logo Upload */}
      <div>
        <label className={labelCls}>Company Logo <span className="text-slate-500 font-normal">(PNG or JPG, max 2 MB)</span></label>
        <div
          className={`flex items-center gap-4 rounded-xl border border-dashed border-[#334155] bg-[#1E293B] p-4 transition ${locked ? 'opacity-50' : 'hover:border-[#14B8A6]/60'}`}
        >
          {preview ? (
            <img src={preview} alt="Logo preview" className="h-14 w-14 rounded-lg object-contain bg-white/5" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-[#334155] bg-[#0F172A]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 19.5h18a.75.75 0 00.75-.75V6.75A.75.75 0 0021 6H3a.75.75 0 00-.75.75v12c0 .414.336.75.75.75z" />
              </svg>
            </div>
          )}
          <div className="flex-1 min-w-0">
            {fileError ? (
              <p className="text-sm text-red-400">{fileError}</p>
            ) : (
              <p className="text-sm text-slate-400 truncate">
                {preview ? 'Logo ready to upload' : 'No file chosen'}
              </p>
            )}
            <button
              type="button"
              disabled={locked}
              onClick={() => fileRef.current?.click()}
              className="mt-1.5 text-sm font-medium text-[#14B8A6] hover:text-white disabled:pointer-events-none transition"
            >
              {preview ? 'Change file' : 'Choose file'}
            </button>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          name="logo"
          accept="image/png,image/jpeg"
          disabled={locked}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className={labelCls}>Create a Password <Required /></label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            disabled={locked}
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            className={`${inputNormal} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute inset-y-0 right-0 flex items-center px-4 text-xs font-medium text-slate-500 hover:text-slate-300"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        {passwordTooShort && (
          <p className="mt-1.5 text-xs text-red-400">Password must be at least 6 characters.</p>
        )}
        <p className="mt-1.5 text-xs text-slate-500">
          This is what you&apos;ll use to log in to your dashboard. Keep it safe — contact support if you ever need to reset it.
        </p>
      </div>

      {/* Confirm Password */}
      <div>
        <label htmlFor="confirmPassword" className={labelCls}>Confirm Password <Required /></label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type={showPassword ? 'text' : 'password'}
          required
          disabled={locked}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter your password"
          className={inputNormal}
        />
        {passwordMismatch && (
          <p className="mt-1.5 text-xs text-red-400">Passwords don&apos;t match.</p>
        )}
      </div>

      {/* Server error */}
      {state.status === 'error' && (
        <div className="rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-400">
          {state.error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={pending || locked}
        className="w-full rounded-xl bg-[#0F766E] py-3.5 text-sm font-semibold text-white transition hover:bg-[#0d6b63] focus:outline-none focus:ring-2 focus:ring-[#14B8A6] focus:ring-offset-2 focus:ring-offset-[#0F172A] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Setting up your account…
          </span>
        ) : (
          'Create my AddressPrint account'
        )}
      </button>
    </form>
  )
}

function Required() {
  return <span className="text-[#14B8A6]">*</span>
}
