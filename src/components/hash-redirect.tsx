'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Detects Supabase hash-based auth tokens (e.g. password recovery) and
// redirects to the appropriate handler page before they're lost on navigation.
export function HashRedirect() {
  const router = useRouter()

  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return
    if (hash.includes('type=recovery')) {
      router.replace('/auth/reset-password' + hash)
    }
  }, [router])

  return null
}
