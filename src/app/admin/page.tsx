import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { AdminPanel } from './admin-panel'
import { isAdminUsername } from '@/lib/constants'
import type { Find, Clover } from '@/types'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) notFound()

  const { data: profile } = await supabase
    .from('users')
    .select('username')
    .eq('id', user.id)
    .single()

  if (!isAdminUsername(profile?.username)) notFound()

  const admin = createAdminClient()
  const { data: finds } = await admin
    .from('finds')
    .select('*, clovers(*), users(username)')
    .order('created_at', { ascending: false })

  type AdminFind = Find & { clovers: Clover[]; users: { username: string } | null }
  const typedFinds = (finds ?? []) as AdminFind[]

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Admin
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {typedFinds.length} total finds
          </p>
        </div>
        <AdminPanel finds={typedFinds} adminUserId={user.id} />
      </div>
    </main>
  )
}
