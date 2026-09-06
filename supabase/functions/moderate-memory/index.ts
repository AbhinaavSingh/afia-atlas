import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

function headers(request: Request) {
  const origin = request.headers.get('origin') ?? ''
  const allowed =
    allowedOrigins.length === 0 ||
    allowedOrigins.includes(origin) ||
    origin.startsWith('http://localhost:')
  return {
    'Access-Control-Allow-Origin': allowed ? origin || '*' : 'null',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    Vary: 'Origin',
  }
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(request) })
}

async function transfer(paths: string[], source: string, destination: string) {
  for (const path of paths) {
    const { data, error } = await admin.storage.from(source).download(path)
    if (error) throw error
    const { error: uploadError } = await admin.storage
      .from(destination)
      .upload(path, data, {
        contentType: 'image/webp',
        cacheControl: '31536000',
        upsert: true,
      })
    if (uploadError) throw uploadError
  }
  const { error } = await admin.storage.from(source).remove(paths)
  if (error) throw error
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: headers(request) })
  if (request.method !== 'POST') return json(request, { error: 'Not found.' }, 404)

  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return json(request, { error: 'Unauthorized.' }, 401)

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    })
    const { data: userData, error: userError } = await authClient.auth.getUser(token)
    if (userError || !userData.user) return json(request, { error: 'Unauthorized.' }, 401)

    const { data: role } = await admin
      .from('admins')
      .select('user_id')
      .eq('user_id', userData.user.id)
      .maybeSingle()
    if (!role) return json(request, { error: 'Forbidden.' }, 403)

    const body = (await request.json()) as { id?: string; action?: string }
    if (!body.id || !['approve', 'reject'].includes(body.action ?? '')) {
      return json(request, { error: 'Invalid request.' }, 400)
    }

    const { data: memory, error } = await admin
      .from('memories')
      .select('status,image_path,thumbnail_path')
      .eq('id', body.id)
      .single()
    if (error || !memory) return json(request, { error: 'Memory not found.' }, 404)
    const paths = [memory.image_path, memory.thumbnail_path].filter(Boolean) as string[]

    if (body.action === 'approve' && memory.status !== 'approved') {
      await transfer(paths, 'pending-memories', 'approved-memories')
    }
    if (body.action === 'reject' && memory.status === 'approved') {
      await transfer(paths, 'approved-memories', 'pending-memories')
    }

    const approved = body.action === 'approve'
    const { error: updateError } = await admin
      .from('memories')
      .update({
        status: approved ? 'approved' : 'rejected',
        approved_at: approved ? new Date().toISOString() : null,
      })
      .eq('id', body.id)
    if (updateError) throw updateError
    return json(request, { ok: true })
  } catch (error) {
    console.error(error)
    return json(request, { error: 'Moderation failed.' }, 500)
  }
})
