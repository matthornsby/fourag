'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function createFind(formData: FormData): Promise<{ error: string } | never> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'You must be signed in to share a find.' }
  }

  const photoFile = formData.get('photoFile') as File | null
  if (!photoFile || photoFile.size === 0) {
    return { error: 'A photo is required.' }
  }

  const foundAt = formData.get('found_at') as string
  if (!foundAt) {
    return { error: 'Date and time found is required.' }
  }
  if (new Date(foundAt) > new Date()) {
    return { error: 'Date found cannot be in the future.' }
  }

  const lat = formData.get('lat') as string | null
  const lng = formData.get('lng') as string | null
  const locationPrivacy = (formData.get('location_privacy') as string) || 'public'
  const locationName = formData.get('location_name') as string | null
  const notes = (formData.get('notes') as string | null)?.trim() || null
  if (notes && notes.length > 500) {
    return { error: 'Notes must be 500 characters or fewer.' }
  }
  const leafCountsRaw = formData.get('leaf_counts') as string

  let leafCounts: number[]
  let annotations: ({ x: number; y: number; radius?: number; rotation?: number } | null)[]
  try {
    leafCounts = JSON.parse(leafCountsRaw)
    if (!Array.isArray(leafCounts) || leafCounts.length === 0) {
      return { error: 'At least one clover is required.' }
    }
    if (leafCounts.some((n) => !Number.isInteger(n) || n < 3 || n > 21)) {
      return { error: 'Leaf count must be between 3 and 21.' }
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

  const { data: userProfile } = await supabase
    .from('users')
    .select('trusted')
    .eq('id', user.id)
    .single()

  const status = userProfile?.trusted ? 'approved' : 'pending'

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
      status,
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

  const returnTo = formData.get('return_to') as string | null
  redirect(returnTo && returnTo.startsWith('/') ? returnTo : '/')
}

export async function updateFind(findId: string, formData: FormData): Promise<{ error: string } | never> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'You must be signed in to edit a find.' }
  }

  const { data: existingFind, error: fetchError } = await supabase
    .from('finds')
    .select('id, user_id, photo_url, users(username)')
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
  if (new Date(foundAt) > new Date()) {
    return { error: 'Date found cannot be in the future.' }
  }

  const lat = formData.get('lat') as string | null
  const lng = formData.get('lng') as string | null
  const locationPrivacy = (formData.get('location_privacy') as string) || 'public'
  const locationName = formData.get('location_name') as string | null
  const notes = (formData.get('notes') as string | null)?.trim() || null
  if (notes && notes.length > 500) {
    return { error: 'Notes must be 500 characters or fewer.' }
  }
  const leafCountsRaw = formData.get('leaf_counts') as string

  let leafCounts: number[]
  let annotations: ({ x: number; y: number; radius?: number; rotation?: number } | null)[]
  try {
    leafCounts = JSON.parse(leafCountsRaw)
    if (!Array.isArray(leafCounts) || leafCounts.length === 0) {
      return { error: 'At least one clover is required.' }
    }
    if (leafCounts.some((n) => !Number.isInteger(n) || n < 3 || n > 21)) {
      return { error: 'Leaf count must be between 3 and 21.' }
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

  const usersData = existingFind.users as unknown as { username: string } | { username: string }[] | null
  const username = Array.isArray(usersData) ? usersData[0]?.username : usersData?.username
  redirect(username ? `/${username}/finds/${findId}` : `/find/${findId}`)
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

function parseFindFormData(formData: FormData) {
  const foundAt = formData.get('found_at') as string
  const lat = formData.get('lat') as string | null
  const lng = formData.get('lng') as string | null
  const locationPrivacy = (formData.get('location_privacy') as string) || 'public'
  const locationName = formData.get('location_name') as string | null
  const notes = formData.get('notes') as string | null
  const leafCountsRaw = formData.get('leaf_counts') as string
  const annotationsRaw = formData.get('annotations') as string | null

  const leafCounts: number[] = JSON.parse(leafCountsRaw)
  const annotations: ({ x: number; y: number; radius?: number; rotation?: number } | null)[] =
    annotationsRaw ? JSON.parse(annotationsRaw) : leafCounts.map(() => null)

  return { foundAt, lat, lng, locationPrivacy, locationName, notes, leafCounts, annotations }
}

async function uploadFindPhoto(
  storage: { from: (bucket: string) => { upload: (path: string, file: File, opts: object) => Promise<{ error: { message: string } | null }>; getPublicUrl: (path: string) => { data: { publicUrl: string } }; remove: (paths: string[]) => Promise<unknown> } },
  folder: string,
  file: File
): Promise<{ url: string; path: string } | { error: string }> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const random = Math.random().toString(36).slice(2, 8)
  const storagePath = `${folder}/${Date.now()}-${random}.${ext}`
  const { error } = await storage.from('finds').upload(storagePath, file, { contentType: file.type })
  if (error) return { error: `Couldn't upload photo — ${error.message}` }
  const { data } = storage.from('finds').getPublicUrl(storagePath)
  return { url: data.publicUrl, path: storagePath }
}

export async function createAnonymousFind(formData: FormData): Promise<{ error: string } | never> {
  const supabase = await createClient()

  const photoFile = formData.get('photoFile') as File | null
  if (!photoFile || photoFile.size === 0) return { error: 'A photo is required.' }

  const foundAt = formData.get('found_at') as string
  if (!foundAt) return { error: 'Date and time found is required.' }
  if (new Date(foundAt) > new Date()) return { error: 'Date found cannot be in the future.' }

  const notesRaw = (formData.get('notes') as string | null)?.trim() || null
  if (notesRaw && notesRaw.length > 500) return { error: 'Notes must be 500 characters or fewer.' }

  let parsed: ReturnType<typeof parseFindFormData>
  try {
    parsed = parseFindFormData(formData)
    if (parsed.leafCounts.some((n) => !Number.isInteger(n) || n < 3 || n > 21)) {
      return { error: 'Leaf count must be between 3 and 21.' }
    }
  } catch {
    return { error: 'Invalid clover data.' }
  }

  const upload = await uploadFindPhoto(supabase.storage, 'anonymous', photoFile)
  if ('error' in upload) return upload

  // Generate ID client-side so we can insert clovers without needing a RETURNING clause.
  // RETURNING is filtered by the SELECT policy (pending rows aren't visible), which causes
  // a spurious RLS error when using .select().single() after insert.
  const findId = crypto.randomUUID()

  const { error: findError } = await supabase
    .from('finds')
    .insert({
      id: findId,
      user_id: null,
      found_at: new Date(parsed.foundAt).toISOString(),
      photo_url: upload.url,
      lat: parsed.lat ? parseFloat(parsed.lat) : null,
      lng: parsed.lng ? parseFloat(parsed.lng) : null,
      location_privacy: parsed.locationPrivacy,
      location_name: parsed.locationName || null,
      notes: parsed.notes || null,
      status: 'pending',
    })

  if (findError) {
    await supabase.storage.from('finds').remove([upload.path])
    return { error: `Couldn't save your find — ${findError.message}` }
  }

  const cloverRows = parsed.leafCounts.map((count, i) => ({
    find_id: findId,
    leaf_count: count,
    annotation_x: parsed.annotations[i]?.x ?? null,
    annotation_y: parsed.annotations[i]?.y ?? null,
    annotation_radius: parsed.annotations[i]?.radius ?? null,
    annotation_rotation: parsed.annotations[i]?.rotation != null
      ? ((parsed.annotations[i]!.rotation! % 360) + 360) % 360
      : null,
  }))

  const admin = createAdminClient()
  const { error: cloversError } = await admin.from('clovers').insert(cloverRows)

  if (cloversError) {
    return { error: `Couldn't record clover details — ${cloversError.message}` }
  }

  redirect('/find/submitted')
}

export async function createFindAndRequestAccount(formData: FormData): Promise<{ error: string } | never> {
  const supabase = await createClient()
  const admin = createAdminClient()

  const username = (formData.get('username') as string).trim()
  const email = (formData.get('email') as string).trim()
  const password = formData.get('password') as string

  if (!username) return { error: 'Username is required.' }
  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
    return { error: 'Username must be 3–20 characters and contain only letters, numbers, hyphens, or underscores.' }
  }
  if (!email) return { error: 'Email is required.' }
  if (!password) return { error: 'Password is required.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }

  const photoFile = formData.get('photoFile') as File | null
  if (!photoFile || photoFile.size === 0) return { error: 'A photo is required.' }

  const foundAt = formData.get('found_at') as string
  if (!foundAt) return { error: 'Date and time found is required.' }
  if (new Date(foundAt) > new Date()) return { error: 'Date found cannot be in the future.' }

  const notesRaw2 = (formData.get('notes') as string | null)?.trim() || null
  if (notesRaw2 && notesRaw2.length > 500) return { error: 'Notes must be 500 characters or fewer.' }

  let parsed: ReturnType<typeof parseFindFormData>
  try {
    parsed = parseFindFormData(formData)
    if (parsed.leafCounts.some((n) => !Number.isInteger(n) || n < 3 || n > 21)) {
      return { error: 'Leaf count must be between 3 and 21.' }
    }
  } catch {
    return { error: 'Invalid clover data.' }
  }

  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .maybeSingle()
  if (existingUser) return { error: 'Username is already taken.' }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  })

  if (authError || !authData.user) {
    return { error: authError?.message ?? 'Could not create account.' }
  }

  const userId = authData.user.id

  const upload = await uploadFindPhoto(admin.storage, userId, photoFile)
  if ('error' in upload) return upload

  const findId = crypto.randomUUID()

  const { error: findError } = await admin
    .from('finds')
    .insert({
      id: findId,
      user_id: userId,
      found_at: new Date(parsed.foundAt).toISOString(),
      photo_url: upload.url,
      lat: parsed.lat ? parseFloat(parsed.lat) : null,
      lng: parsed.lng ? parseFloat(parsed.lng) : null,
      location_privacy: parsed.locationPrivacy,
      location_name: parsed.locationName || null,
      notes: parsed.notes || null,
      status: 'pending',
    })

  if (findError) {
    await admin.storage.from('finds').remove([upload.path])
    return { error: `Couldn't save your find — ${findError.message}` }
  }

  const cloverRows = parsed.leafCounts.map((count, i) => ({
    find_id: findId,
    leaf_count: count,
    annotation_x: parsed.annotations[i]?.x ?? null,
    annotation_y: parsed.annotations[i]?.y ?? null,
    annotation_radius: parsed.annotations[i]?.radius ?? null,
    annotation_rotation: parsed.annotations[i]?.rotation != null
      ? ((parsed.annotations[i]!.rotation! % 360) + 360) % 360
      : null,
  }))

  await admin.from('clovers').insert(cloverRows)

  redirect('/auth/confirm')
}
