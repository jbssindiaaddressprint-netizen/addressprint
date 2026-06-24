'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { requestPasswordReset, resetPasswordWithOtp, type RequestOtpState, type ResetPasswordState } from './forgot-password-actions'

const requestInitial: RequestOtpState = { status: 'idle' }
const resetInitial: ResetPasswordState = { status: 'idle' }

export default function ForgotPasswordForm() {
  const [requestState, requestAction, requestPending] = useActionState(requestPasswordReset, requestInitial)
  const [resetState, resetAction, resetPending] = useActionState(resetPasswordWithOtp, resetInitial)
  const [showPassword, setShowPassword] = useState(false)

  const inputBase =
    'w-full rounded-xl border border-[#334155] bg-[#1E293B] px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:ring-2 focus:ring-[#14B8A6] disabled:cursor-not-allowed disabled:opacity-50'

  // Step 2: code sent, show OTP + new password form.
  if (requestState.status === 'sent' && resetState.status !== 'success') {
    return (
      <form action={resetAction} className="space-y-4">
        <input type="hidden" name="tenantId" value={requestState.tenantId ?? ''} />

        <div className="rounded-xl border border-[#0F766E]/40 bg-[#0F766E]/10 px-4 py-3 text-sm text-[#14B8A6]">
          If that account exists, we&apos;ve sent a 6-digit code to its registered email and WhatsApp number. Enter it below along with your new password.
        </div>

        <div>
          <label htmlFor="otp" className="mb-1.5 block text-sm font-medium text-slate-300">Reset Code</label>
          <input
            id="otp"
            name="otp"
            type="text"
            inputMode="numeric"
            maxLength={6}
            required
            autoFocus
            disabled={resetPending}
            placeholder="123456"
            className={`${inputBase} text-center text-lg tracking-[0.3em]`}
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-300">New Password</label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              disabled={resetPending}
              placeholder="At least 6 characters"
              className={`${inputBase} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              className="absolute inset-y-0 right-0 flex items-center px-4 text-xs font-medium text-slate-500 hover:text-slate-300"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-slate-300">Confirm New Password</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            required
            disabled={resetPending}
            placeholder="Re-enter new password"
            className={inputBase}
          />
        </div>

        {resetState.status === 'error' && (
          <div className="rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-400">
            {resetState.error}
          </div>
        )}

        <button
          type="submit"
          disabled={resetPending}
          className="w-full rounded-xl bg-[#0F766E] py-3.5 text-sm font-semibold text-white transition hover:bg-[#0d6b63] focus:outline-none focus:ring-2 focus:ring-[#14B8A6] focus:ring-offset-2 focus:ring-offset-[#0F172A] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resetPending ? 'Resetting…' : 'Reset Password'}
        </button>
      </form>
    )
  }

  // Step 3: success.
  if (resetState.status === 'success') {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-xl border border-[#0F766E]/40 bg-[#0F766E]/10 px-5 py-4 text-sm text-[#14B8A6]">
          Your password has been reset successfully.
        </div>
        <Link
          href="/"
          className="inline-block w-full rounded-xl bg-[#0F766E] py-3.5 text-sm font-semibold text-white transition hover:bg-[#0d6b63]"
        >
          Go to Login
        </Link>
      </div>
    )
  }

  // Step 1: enter mobile or email.
  return (
    <form action={requestAction} className="space-y-4">
      <div>
        <label htmlFor="identifier" className="mb-1.5 block text-sm font-medium text-slate-300">
          Mobile Number or Email
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          required
          autoFocus
          disabled={requestPending}
          placeholder="98765 43210 or you@company.com"
          className={inputBase}
        />
        <p className="mt-1.5 text-xs text-slate-500">
          Enter whichever is registered to your AddressPrint account. We&apos;ll send you a reset code.
        </p>
      </div>

      {requestState.status === 'error' && (
        <div className="rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-400">
          {requestState.error}
        </div>
      )}

      <button
        type="submit"
        disabled={requestPending}
        className="w-full rounded-xl bg-[#0F766E] py-3.5 text-sm font-semibold text-white transition hover:bg-[#0d6b63] focus:outline-none focus:ring-2 focus:ring-[#14B8A6] focus:ring-offset-2 focus:ring-offset-[#0F172A] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {requestPending ? 'Sending…' : 'Send Reset Code'}
      </button>

      <Link href="/" className="block text-center text-sm text-slate-400 hover:text-slate-300">
        Back to Login
      </Link>
    </form>
  )
}
