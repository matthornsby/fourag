'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const supabase = createClient()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setReady(true)
      }
    })

    // Also check for an existing recovery session (e.g. page refresh)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) { setError('Passwords do not match.'); return }
    startTransition(async () => {
      const { error } = await createClient().auth.updateUser({ password })
      if (error) setError(error.message)
      else router.replace('/')
    })
  }

  const inputClass = 'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'
  const labelClass = 'block text-sm font-medium text-text-primary mb-1.5'

  if (!ready) {
    return (
      <main className="flex-1 flex items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Loading…</p>
      </main>
    )
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <h1 className="text-2xl font-semibold text-text-primary">Set new password</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="password" className={labelClass}>New password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="confirm" className={labelClass}>Confirm password</label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
            />
          </div>
          {error && <p role="alert" className="text-sm text-error">{error}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-md bg-accent text-contrast text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity duration-150 disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Set password'}
          </button>
        </form>
      </div>
    </main>
  )
}
