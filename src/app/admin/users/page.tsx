import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { UsersPanel, type AdminUser } from './users-panel'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) notFound()

  const { data: profile } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) notFound()

  const admin = createAdminClient()
  const { data: users } = await admin
    .from('users')
    .select('id, username, is_admin, trusted, created_at')
    .order('created_at', { ascending: true })

  const typedUsers = (users ?? []) as AdminUser[]

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Users
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              {typedUsers.length} total users
            </p>
          </div>
          <Link
            href="/admin"
            className="text-sm font-medium hover:opacity-70 transition-opacity shrink-0 mt-1"
            style={{ color: 'var(--color-accent)' }}
          >
            ← Finds
          </Link>
        </div>
        <UsersPanel users={typedUsers} currentUserId={user.id} />
      </div>
    </main>
  )
}
