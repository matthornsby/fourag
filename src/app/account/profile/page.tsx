import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { ProfileForm } from './profile-form'
import type { UserProfile } from '@/types'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/sign-in')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/sign-in')

  return (
    <main className="flex-1 px-4 py-8 sm:px-6">
      <div className="max-w-[680px] mx-auto">
        <h1 className="text-2xl font-semibold mb-8">Profile</h1>
        <ProfileForm profile={profile as UserProfile} />
      </div>
    </main>
  )
}
