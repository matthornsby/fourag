import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { EditFindForm } from '@/components/edit-find-form'
import type { Find, Clover } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditFindPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/sign-in')
  }

  const { data: find } = await supabase
    .from('finds')
    .select('*, clovers(*)')
    .eq('id', id)
    .single()

  if (!find) redirect('/')

  const typedFind = find as Find & { clovers: Clover[] }

  if (typedFind.user_id !== user.id) {
    redirect('/')
  }

  return (
    <main className="flex-1">
      <div className="max-w-[680px] mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-semibold mb-8">Edit find</h1>
        <EditFindForm find={typedFind} />
      </div>
    </main>
  )
}
