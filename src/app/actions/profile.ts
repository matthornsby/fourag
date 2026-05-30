'use server'

import { createClient } from '@/lib/supabase-server'

type ProfileState = { ok: true } | { ok: false; error: string } | null

export async function updateProfile(
  _state: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { ok: false, error: 'You must be signed in.' }
  }

  const bio = (formData.get('bio') as string).trim() || null
  const avatarFile = formData.get('avatarFile') as File | null

  let avatarUrl: string | undefined

  if (avatarFile && avatarFile.size > 0) {
    const { data: existing } = await supabase
      .from('users')
      .select('avatar_url')
      .eq('id', user.id)
      .single()

    const ext = avatarFile.name.split('.').pop() ?? 'jpg'
    const random = Math.random().toString(36).slice(2, 8)
    const storagePath = `${user.id}/${Date.now()}-${random}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(storagePath, avatarFile, { contentType: avatarFile.type })

    if (uploadError) {
      return { ok: false, error: `Couldn't upload photo — ${uploadError.message}` }
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(storagePath)
    avatarUrl = urlData.publicUrl

    if (existing?.avatar_url) {
      try {
        const oldPath = existing.avatar_url.split('/avatars/')[1]
        if (oldPath) {
          await supabase.storage.from('avatars').remove([decodeURIComponent(oldPath)])
        }
      } catch {
        // Non-fatal
      }
    }
  }

  const updates: { bio: string | null; avatar_url?: string } = { bio }
  if (avatarUrl) updates.avatar_url = avatarUrl

  const { error } = await supabase.from('users').update(updates).eq('id', user.id)
  if (error) {
    return { ok: false, error: `Couldn't save profile — ${error.message}` }
  }

  return { ok: true }
}
