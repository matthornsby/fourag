import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { NewFindForm } from '@/components/new-find-form'

export default async function NewFindPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/sign-in')
  }

  return (
    <main className="flex-1 px-4 py-8 sm:px-6">
      <div className="max-w-[680px] mx-auto">
        <h1 className="text-2xl font-semibold mb-1">Log a find</h1>
        <p className="text-sm text-text-secondary mb-8">
          Record a clover you&apos;ve found — photo, date, and leaf count.
        </p>
        <NewFindForm />
      </div>
    </main>
  )
}
