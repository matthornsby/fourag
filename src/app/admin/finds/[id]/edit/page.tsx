import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { FindForm } from '@/components/find-form'
import { adminUpdateFind } from '@/app/actions/admin'
import type { Find, Clover } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminEditFindPage({ params }: PageProps) {
  const { id } = await params
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
  const { data: find } = await admin
    .from('finds')
    .select('*, clovers(*)')
    .eq('id', id)
    .single()

  if (!find) notFound()

  const typedFind = find as Find & { clovers: Clover[] }

  return (
    <main className="flex-1">
      <div className="max-w-[680px] mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <a
            href="/admin"
            className="text-sm hover:opacity-70 transition-opacity"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            ← Admin
          </a>
          <span style={{ color: 'var(--color-text-secondary)' }}>/</span>
          <h1 className="text-2xl font-semibold">Edit find</h1>
        </div>
        <FindForm find={typedFind} updateAction={adminUpdateFind} />
      </div>
    </main>
  )
}
