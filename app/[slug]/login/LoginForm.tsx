'use client'

import { useActionState, useState } from 'react'
import { loginTenant, type LoginState } from './actions'

const initialState: LoginState = { status: 'idle' }

export default function LoginForm({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState(loginTenant, initialState)
  const [showPassword, setShowPassword] = useState(false)

  const inputBase =
    'w-full rounded-xl border border-[#334155] bg-[#1E293B] px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:ring-2 focus:ring-[#14B8A6] disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-300">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoFocus
            disabled={pending}
            placeholder="Enter your password"
            className={`${inputBase} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute inset-y-0 right-0 flex items-center px-4 text-xs font-medium text-slate-500 hover:text-slate-300"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {state.status === 'error' && (
        <div className="rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-400">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-[#0F766E] py-3.5 text-sm font-semibold text-white transition hover:bg-[#0d6b63] focus:outline-none focus:ring-2 focus:ring-[#14B8A6] focus:ring-offset-2 focus:ring-offset-[#0F172A] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Logging in…' : 'Log In'}
      </button>

      <a href={`/${slug}/forgot-password`} className="block text-center text-sm text-slate-400 hover:text-slate-300">
        Forgot password?
      </a>
    </form>
  )
}
