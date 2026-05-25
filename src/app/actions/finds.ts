'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

export async function createFind(formData: FormData): Promise<{ error: string } | never> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'You must be signed in to log a find.' }
  }

  const photoFile = formData.get('photoFile') as File | null
  if (!photoFile || photoFile.size === 0) {
    return { error: 'A photo is required.' }
  }

  const foundAt = formData.get('found_at') as string
  if (!foundAt) {
    return { error: 'Date and time found is required.' }
  }

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

  // Build storage path: {user_id}/{timestamp}-{random}.{ext}
  const ext = photoFile.name.split('.').pop() ?? 'jpg'
  const random = Math.random().toString(36).slice(2, 8)
  const storagePath = `${user.id}/${Date.now()}-${random}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('finds')
    .upload(storagePath, photoFile, { contentType: photoFile.type })

  if (uploadError) {
    return { error: `Couldn't upload photo — ${uploadError.message}` }
  }

  const { data: urlData } = supabase.storage.from('finds').getPublicUrl(storagePath)
  const photoUrl = urlData.publicUrl

  const { data: find, error: findError } = await supabase
    .from('finds')
    .insert({
      user_id: user.id,
      found_at: new Date(foundAt).toISOString(),
      photo_url: photoUrl,
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      location_privacy: locationPrivacy,
      location_name: locationName || null,
      notes: notes || null,
    })
    .select('id')
    .single()

  if (findError || !find) {
    // Clean up the uploaded photo if the find insert failed
    await supabase.storage.from('finds').remove([storagePath])
    return { error: `Couldn't save your find — ${findError?.message ?? 'try again.'}` }
  }

  const cloverRows = leafCounts.map((count, i) => ({
    find_id: find.id,
    leaf_count: count,
    annotation_x: annotations[i]?.x ?? null,
    annotation_y: annotations[i]?.y ?? null,
    annotation_radius: annotations[i]?.radius ?? null,
    annotation_rotation: annotations[i]?.rotation != null
      ? ((annotations[i]!.rotation! % 360) + 360) % 360
      : null,
  }))

  const { error: cloversError } = await supabase.from('clovers').insert(cloverRows)

  if (cloversError) {
    // Find was saved — don't delete it, but surface the error
    return { error: `Find saved, but couldn't record clover details — ${cloversError.message}` }
  }

  redirect('/')
}

export async function updateFind(findId: string, formData: FormData): Promise<{ error: string } | never> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'You must be signed in to edit a find.' }
  }

  const { data: existingFind, error: fetchError } = await supabase
    .from('finds')
    .select('id, user_id, photo_url')
    .eq('id', findId)
    .single()

  if (fetchError || !existingFind) {
    return { error: 'Find not found.' }
  }

  if (existingFind.user_id !== user.id) {
    return { error: 'You do not have permission to edit this find.' }
  }

  const foundAt = formData.get('found_at') as string
  if (!foundAt) {
    return { error: 'Date and time found is required.' }
  }

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
    const storagePath = `${user.id}/${Date.now()}-${random}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('finds')
      .upload(storagePath, photoFile, { contentType: photoFile.type })

    if (uploadError) {
      return { error: `Couldn't upload photo — ${uploadError.message}` }
    }

    const { data: urlData } = supabase.storage.from('finds').getPublicUrl(storagePath)
    photoUrl = urlData.publicUrl

    // Delete old photo from storage
    try {
      const oldPathEncoded = existingFind.photo_url.split('/finds/')[1]
      if (oldPathEncoded) {
        const oldPath = decodeURIComponent(oldPathEncoded)
        await supabase.storage.from('finds').remove([oldPath])
      }
    } catch {
      // Non-fatal: proceed even if old photo deletion fails
    }
  }

  const { error: updateError } = await supabase
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

  if (updateError) {
    return { error: `Couldn't update your find — ${updateError.message}` }
  }

  // Snapshot existing clover IDs before touching anything. If the insert below
  // fails we leave the originals intact; we only delete them after a confirmed insert.
  const { data: existingClovers } = await supabase
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
    annotation_rotation: annotations[i]?.rotation != null
      ? ((annotations[i]!.rotation! % 360) + 360) % 360
      : null,
  }))

  const { error: cloversError } = await supabase.from('clovers').insert(cloverRows)

  if (cloversError) {
    return { error: `Couldn't record clover details — ${cloversError.message}` }
  }

  // Insert succeeded — now it's safe to remove the old rows.
  if (existingIds.length > 0) {
    await supabase.from('clovers').delete().in('id', existingIds)
  }

  redirect(`/finds/${findId}`)
}

export async function deleteFind(findId: string): Promise<{ error: string } | never> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'You must be signed in to delete a find.' }
  }

  const { data: existingFind, error: fetchError } = await supabase
    .from('finds')
    .select('id, user_id, photo_url')
    .eq('id', findId)
    .single()

  if (fetchError || !existingFind) {
    return { error: 'Find not found.' }
  }

  if (existingFind.user_id !== user.id) {
    return { error: 'You do not have permission to delete this find.' }
  }

  const { error: deleteError } = await supabase
    .from('finds')
    .delete()
    .eq('id', findId)

  if (deleteError) {
    return { error: `Couldn't delete find — ${deleteError.message}` }
  }

  try {
    const oldPathEncoded = existingFind.photo_url.split('/finds/')[1]
    if (oldPathEncoded) {
      await supabase.storage.from('finds').remove([decodeURIComponent(oldPathEncoded)])
    }
  } catch {
    // Non-fatal: row is already deleted
  }

  redirect('/')
}
