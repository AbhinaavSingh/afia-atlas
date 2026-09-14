import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY')
const rateLimitSalt = Deno.env.get('RATE_LIMIT_SALT') ?? serviceRoleKey.slice(-24)
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') ?? ''
  const allowed =
    allowedOrigins.length === 0 ||
    allowedOrigins.includes(origin) ||
    origin.startsWith('http://localhost:')
  return {
    'Access-Control-Allow-Origin': allowed ? origin || '*' : 'null',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
  })
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function text(form: FormData, key: string, min: number, max: number) {
  const value = String(form.get(key) ?? '').trim()
  if (value.length < min || value.length > max) {
    throw new Error(`${key} is invalid.`)
  }
  return value
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(request) })
  }
  if (request.method !== 'POST') return json(request, { error: 'Not found.' }, 404)

  const origin = request.headers.get('origin') ?? ''
  if (
    allowedOrigins.length > 0 &&
    !allowedOrigins.includes(origin) &&
    !origin.startsWith('http://localhost:')
  ) {
    return json(request, { error: 'Origin not allowed.' }, 403)
  }

  let uploadedPaths: string[] = []
  try {
    const [{ data: settings }, form] = await Promise.all([
      admin.from('site_settings').select('contributions_open').eq('id', 1).single(),
      request.formData(),
    ])
    if (!settings?.contributions_open) {
      return json(request, { error: 'Contributions are now closed.' }, 403)
    }

    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]
    const ip = request.headers.get('cf-connecting-ip') ?? forwarded ?? 'unknown'
    const ipHash = await sha256(`${rateLimitSalt}:${ip}`)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await admin
      .from('submission_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', oneHourAgo)
    // Generous backstop only: Turnstile already blocks bots, and mobile
    // carriers put many people behind one shared IP address.
    if ((count ?? 0) >= 30) {
      return json(
        request,
        { error: 'A lot of moments are arriving from this network right now. Please try again in an hour.' },
        429,
      )
    }

    if (turnstileSecret) {
      const token = String(form.get('turnstileToken') ?? '')
      const verifyBody = new FormData()
      verifyBody.set('secret', turnstileSecret)
      verifyBody.set('response', token)
      verifyBody.set('remoteip', ip)
      const verification = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        { method: 'POST', body: verifyBody },
      )
      const result = (await verification.json()) as { success: boolean }
      if (!result.success) {
        return json(request, { error: 'Please complete the security check.' }, 400)
      }
    }

    const contributorName = text(form, 'contributorName', 2, 80)
    const relationship = text(form, 'relationship', 0, 80)
    const title = text(form, 'title', 3, 120)
    const story = text(form, 'story', 20, 1800)
    const locationName = text(form, 'locationName', 2, 140)
    const city = text(form, 'city', 0, 100)
    const regionName = text(form, 'regionName', 0, 100)
    const countryCode = text(form, 'countryCode', 0, 2).toUpperCase()
    if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
      throw new Error('Country is invalid.')
    }
    const happenedAt = text(form, 'happenedAt', 0, 40)
    const latitude = Number(form.get('latitude'))
    const longitude = Number(form.get('longitude'))
    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new Error('Location is invalid.')
    }

    const image = form.get('image')
    const thumbnail = form.get('thumbnail')
    if (!(image instanceof File) || !(thumbnail instanceof File)) {
      throw new Error('A photograph is required.')
    }
    // Safari cannot encode WebP, so the client sends JPEG from those devices.
    const extensions: Record<string, string> = {
      'image/webp': 'webp',
      'image/jpeg': 'jpg',
    }
    if (
      !extensions[image.type] ||
      !extensions[thumbnail.type] ||
      image.size > 1_200_000 ||
      thumbnail.size > 250_000
    ) {
      throw new Error('The processed photograph is invalid or too large.')
    }

    const submissionId = crypto.randomUUID()
    const imagePath = `${submissionId}/image.${extensions[image.type]}`
    const thumbnailPath = `${submissionId}/thumbnail.${extensions[thumbnail.type]}`
    uploadedPaths = [imagePath, thumbnailPath]
    const [imageUpload, thumbnailUpload] = await Promise.all([
      admin.storage.from('approved-memories').upload(imagePath, image, {
        contentType: image.type,
        cacheControl: '31536000',
      }),
      admin.storage.from('approved-memories').upload(thumbnailPath, thumbnail, {
        contentType: thumbnail.type,
        cacheControl: '31536000',
      }),
    ])
    if (imageUpload.error || thumbnailUpload.error) {
      throw imageUpload.error ?? thumbnailUpload.error
    }

    const { error } = await admin.from('memories').insert({
      id: submissionId,
      contributor_name: contributorName,
      relationship: relationship || null,
      title,
      story,
      location_name: locationName,
      city: city || null,
      region_name: regionName || null,
      country_code: countryCode || null,
      latitude,
      longitude,
      happened_at: happenedAt || null,
      image_path: imagePath,
      thumbnail_path: thumbnailPath,
      status: 'approved',
      approved_at: new Date().toISOString(),
      submitter_ip_hash: ipHash,
    })
    if (error) throw error

    await admin.from('submission_attempts').insert({ ip_hash: ipHash })
    return json(request, { id: submissionId }, 201)
  } catch (error) {
    if (uploadedPaths.length) {
      await admin.storage.from('approved-memories').remove(uploadedPaths)
    }
    console.error(error)
    return json(
      request,
      { error: error instanceof Error ? error.message : 'Submission failed.' },
      400,
    )
  }
})
