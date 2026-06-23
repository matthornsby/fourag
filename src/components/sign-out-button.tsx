'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export function SignOutButton({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  async function handleSignOut() {
    await createClient().auth.signOut()
    router.push('/auth/sign-in')
    router.refresh()
  }

  return (
    <button id="signout" type="button" onClick={handleSignOut} className="nav-link nav-link-circle p-0 flex justify-center items-center">
      {children}
    </button>
  )
}
