'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import type { FindStatus } from '@/types'
import { isAdminUsername } from '@/lib/constants'

async function requireAdmin(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: profile } = await supabase
    .from('users')
    .select('username')
    .eq('id', user.id)
    .single()
  if (!isAdminUsername(profile?.username)) throw new Error('Not authorized')
}

export async function updateFindStatus(
  findId: string,
  status: FindStatus,
): Promise<{ error: string } | { ok: true }> {
  try {
    await requireAdmin()
  } catch (e) {
    return { error: (e as Error).message }
  }

  const admin = createAdminClient()

  const { data: find, error: fetchError } = await admin
    .from('finds')
    .select('id, user_id')
    .eq('id', findId)
    .single()

  if (fetchError || !find) return { error: 'Find not found.' }

  const { error: updateError } = await admin
    .from('finds')
    .update({ status })
    .eq('id', findId)

  if (updateError) return { error: updateError.message }

  // Approving a non-anonymous find → trust the creator
  if (status === 'approved' && find.user_id) {
    await admin.from('users').update({ trusted: true }).eq('id', find.user_id)
  }

  revalidatePath('/admin')
  return { ok: true }
}

export async function adminUpdateFind(
  findId: string,
  formData: FormData,
): Promise<{ error: string } | never> {
  try {
    await requireAdmin()
  } catch (e) {
    return { error: (e as Error).message }
  }

  const admin = createAdminClient()

  const { data: existingFind, error: fetchError } = await admin
    .from('finds')
    .select('id, photo_url')
    .eq('id', findId)
    .single()

  if (fetchError || !existingFind) return { error: 'Find not found.' }

  const foundAt = formData.get('found_at') as string
  if (!foundAt) return { error: 'Date and time found is required.' }

  const lat = formData.get('lat') as string | null
  const lng = formData.get('lng') as string | null
  const locationPrivacy = (formData.get('location_privacy') as string) || 'public'
  const locationName = formData.get('location_name') as string | null
  const notes = formData.get('notes') as string | null
  const leafCountsRaw = formData.get('leaf_counts') as string

  let leafCounts: number[]
  let annotations: ({ x: number; y: number; radius?: number; rotation?: number } | null)[]
  try {
    leafCounts = JSON.parse(leafCountsRaw)
    if (!Array.isArray(leafCounts) || leafCounts.length === 0) {
      return { error: 'At least one clover is required.' }
    }
    const annotationsRaw = formData.get('annotations') as string
    annotations = annotationsRaw ? JSON.parse(annotationsRaw) : leafCounts.map(() => null)
  } catch {
    return { error: 'Invalid clover data.' }
  }

  const photoFile = formData.get('photoFile') as File | null
  let photoUrl = existingFind.photo_url

  if (photoFile && photoFile.size > 0) {
    const ext = photoFile.name.split('.').pop() ?? 'jpg'
    const random = Math.random().toString(36).slice(2, 8)
    const storagePath = `admin-edits/${Date.now()}-${random}.${ext}`

    const { error: uploadError } = await admin.storage
      .from('finds')
      .upload(storagePath, photoFile, { contentType: photoFile.type })

    if (uploadError) return { error: `Couldn't upload photo — ${uploadError.message}` }

    const { data: urlData } = admin.storage.from('finds').getPublicUrl(storagePath)
    photoUrl = urlData.publicUrl

    try {
      const oldPathEncoded = existingFind.photo_url.split('/finds/')[1]
      if (oldPathEncoded) {
        await admin.storage.from('finds').remove([decodeURIComponent(oldPathEncoded)])
      }
    } catch {
      // Non-fatal
    }
  }

  const { error: updateError } = await admin
    .from('finds')
    .update({
      found_at: new Date(foundAt).toISOString(),
      photo_url: photoUrl,
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      location_privacy: locationPrivacy,
      location_name: locationName || null,
      notes: notes || null,
    })
    .eq('id', findId)

  if (updateError) return { error: `Couldn't update find — ${updateError.message}` }

  const { data: existingClovers } = await admin
    .from('clovers')
    .select('id')
    .eq('find_id', findId)

  const existingIds = (existingClovers ?? []).map((c) => c.id as string)

  const cloverRows = leafCounts.map((count, i) => ({
    find_id: findId,
    leaf_count: count,
    annotation_x: annotations[i]?.x ?? null,
    annotation_y: annotations[i]?.y ?? null,
    annotation_radius: annotations[i]?.radius ?? null,
    annotation_rotation:
      annotations[i]?.rotation != null
        ? ((annotations[i]!.rotation! % 360) + 360) % 360
        : null,
  }))

  const { error: cloversError } = await admin.from('clovers').insert(cloverRows)
  if (cloversError) return { error: `Couldn't update clovers — ${cloversError.message}` }

  if (existingIds.length > 0) {
    await admin.from('clovers').delete().in('id', existingIds)
  }

  revalidatePath('/admin')
  redirect('/admin')
}
