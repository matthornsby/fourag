'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const { error } = await createClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/auth/reset-password`,
      })
      if (error) setError(error.message)
      else setSent(true)
    })
  }

  const inputClass = 'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'
  const labelClass = 'block text-sm font-medium text-text-primary mb-1.5'

  if (sent) {
    return (
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm flex flex-col gap-3 text-center">
          <h1 className="text-2xl font-semibold text-text-primary">Check your email</h1>
          <p className="text-sm text-text-secondary">
            We sent a password reset link to <span className="text-text-primary">{email}</span>.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <h1 className="text-2xl font-semibold text-text-primary">Reset password</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className={labelClass}>Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          {error && <p role="alert" className="text-sm text-error">{error}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-md bg-accent text-contrast text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity duration-150 disabled:opacity-50"
          >
            {isPending ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
        <p className="text-sm text-text-secondary text-center">
          <a href="/auth/sign-in" className="text-accent hover:underline underline-offset-2">Back to sign in</a>
        </p>
      </div>
    </main>
  )
}
