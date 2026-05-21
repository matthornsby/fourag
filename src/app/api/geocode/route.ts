import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const lat = request.nextUrl.searchParams.get('lat')
  const lng = request.nextUrl.searchParams.get('lng')

  if (!lat || !lng) {
    return Response.json({ error: 'lat and lng are required' }, { status: 400 })
  }

  const latNum = parseFloat(lat)
  const lngNum = parseFloat(lng)
  if (isNaN(latNum) || isNaN(lngNum)) {
    return Response.json({ error: 'Invalid coordinates' }, { status: 400 })
  }

  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${latNum}&lon=${lngNum}&format=json&zoom=14&accept-language=en`,
    { headers: { 'User-Agent': 'fourag/1.0 (clover find tracker)' } }
  )

  if (!res.ok) {
    return Response.json({ error: 'Geocoding failed' }, { status: 502 })
  }

  const data = await res.json()
  const privacy = request.nextUrl.searchParams.get('privacy')
  const addr = data.address ?? {}
  const local = privacy === 'public'
    ? addr.road || addr.quarter || addr.neighbourhood || addr.suburb || addr.city_district || null
    : addr.quarter || addr.neighbourhood || addr.suburb || addr.city_district || null
  const city = addr.city || addr.town || addr.village || addr.municipality || null
  const state = addr.state || addr.county || null
  const country = addr.country_code ? (addr.country_code as string).toUpperCase() : null
  const name = [local, city, state, country].filter(Boolean).join(', ') || null

  return Response.json({ name })
}
