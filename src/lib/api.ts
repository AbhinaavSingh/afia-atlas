import type { Memory, MemoryRow, SiteSettings } from '../types'
import { mapMemoryRow } from '../types'
import {
  approvedStorageUrl,
  functionsUrl,
  isSupabaseConfigured,
  supabase,
} from './supabase'

const sampleMemories: Memory[] = [
  {
    id: 'sample-bangalore-one',
    contributorName: 'Maya',
    relationship: 'Friend since university',
    title: 'The rooftop where five minutes became five hours',
    story:
      'We went upstairs for “just five minutes” and somehow watched the whole city turn gold. You made us laugh until our faces hurt, then listened with that rare, generous attention that makes a person feel like the only one in the world. I remember thinking: this is what home feels like.',
    locationName: 'Bangalore, Karnataka, India',
    city: 'Bangalore',
    regionName: 'Karnataka',
    countryCode: 'IN',
    latitude: 12.9716,
    longitude: 77.5946,
    thumbnailUrl: '/images/sample-bangalore-rooftop.webp',
    imageUrl: '/images/sample-bangalore-rooftop.webp',
    status: 'approved',
    createdAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'sample-bangalore-two',
    contributorName: 'Rhea',
    relationship: 'Partner in crime',
    title: 'The birthday cake rescue mission',
    story:
      'The bakery had closed, the rain had started, and any sensible person would have given up. You absolutely did not. Two autos, one soaked dress, and a wildly misspelled cake later, we arrived like heroes. That ridiculous night is still one of my happiest memories.',
    locationName: 'Bangalore, Karnataka, India',
    city: 'Bangalore',
    regionName: 'Karnataka',
    countryCode: 'IN',
    latitude: 12.9716,
    longitude: 77.5946,
    status: 'approved',
    createdAt: '2026-09-02T00:00:00Z',
  },
  {
    id: 'sample-delhi',
    contributorName: 'Sana',
    relationship: 'Childhood friend',
    title: 'Chai, old stories, and no sense of time',
    story:
      'We promised it would be one quick cup of chai. Three hours later, the staff were stacking chairs around us while we were still retelling the same school story for the hundredth time. You have always had the gift of making an ordinary afternoon feel important.',
    locationName: 'New Delhi, Delhi, India',
    city: 'New Delhi',
    regionName: 'Delhi',
    countryCode: 'IN',
    latitude: 28.6139,
    longitude: 77.209,
    thumbnailUrl: '/images/sample-delhi-cafe.webp',
    imageUrl: '/images/sample-delhi-cafe.webp',
    status: 'approved',
    createdAt: '2026-09-03T00:00:00Z',
  },
  {
    id: 'sample-london',
    contributorName: 'Leila',
    relationship: 'London family',
    title: 'Rain, laughter, and one last train',
    story:
      'It was pouring, our phones were dying, and we had missed the last sensible train home. You tucked us both under one tiny umbrella and declared it an adventure. We sang badly all the way to the night bus, and somehow the rain became the best part.',
    locationName: 'London, United Kingdom',
    city: 'London',
    regionName: 'England',
    countryCode: 'GB',
    latitude: 51.5072,
    longitude: -0.1276,
    thumbnailUrl: '/images/sample-london-rain.webp',
    imageUrl: '/images/sample-london-rain.webp',
    status: 'approved',
    createdAt: '2026-09-04T00:00:00Z',
  },
  {
    id: 'sample-new-york',
    contributorName: 'Nadia',
    relationship: 'Friend across the ocean',
    title: 'A New York minute that stayed forever',
    story:
      'You had been in New York for less than a day and already turned a simple picnic into a table full of strangers sharing food and stories. By sunset, everyone felt like an old friend. That is your magic: wherever you arrive, a little community appears.',
    locationName: 'New York, New York, United States',
    city: 'New York',
    regionName: 'New York',
    countryCode: 'US',
    latitude: 40.7128,
    longitude: -74.006,
    thumbnailUrl: '/images/sample-new-york-picnic.webp',
    imageUrl: '/images/sample-new-york-picnic.webp',
    status: 'approved',
    createdAt: '2026-09-05T00:00:00Z',
  },
  {
    id: 'sample-austin',
    contributorName: 'Aaliyah',
    relationship: 'Road-trip co-pilot',
    title: 'Under a wide Texas sky',
    story:
      'We took the wrong exit and added two hours to the drive. You rolled down the windows, found the perfect song, and insisted the detour was the whole point. Watching that impossible Texas sunset beside you, I knew you were right.',
    locationName: 'Austin, Texas, United States',
    city: 'Austin',
    regionName: 'Texas',
    countryCode: 'US',
    latitude: 30.2672,
    longitude: -97.7431,
    thumbnailUrl: '/images/sample-texas-roadtrip.webp',
    imageUrl: '/images/sample-texas-roadtrip.webp',
    status: 'approved',
    createdAt: '2026-09-06T00:00:00Z',
  },
]

const demoSettings: SiteSettings = {
  revealed: true,
  revealAt: '2026-09-19T09:00:00-07:00',
  contributionsOpen: true,
}

export async function getPublicExperience() {
  if (!supabase) {
    return {
      settings: demoSettings,
      memories: sampleMemories,
      demo: true,
      canPreview: true,
    }
  }

  const [{ data: settings, error: settingsError }, { data: rows, error }, { data: user }] =
    await Promise.all([
      supabase.from('site_settings').select('*').eq('id', 1).single(),
      supabase
        .from('memories')
        .select('*')
        .eq('status', 'approved')
        .order('created_at'),
      supabase.auth.getUser(),
    ])

  if (settingsError) throw settingsError
  if (error) throw error

  const { data: adminRole } = user.user
    ? await supabase
        .from('admins')
        .select('user_id')
        .eq('user_id', user.user.id)
        .maybeSingle()
    : { data: null }

  return {
    settings: {
      revealed: settings.revealed,
      revealAt: settings.reveal_at,
      contributionsOpen: settings.contributions_open,
    } satisfies SiteSettings,
    memories: ((rows ?? []) as MemoryRow[]).map((row) =>
      mapMemoryRow(row, approvedStorageUrl),
    ),
    demo: false,
    canPreview: Boolean(adminRole),
  }
}

export async function submitMemory(formData: FormData, turnstileToken?: string) {
  if (!isSupabaseConfigured || !functionsUrl) {
    await new Promise((resolve) => window.setTimeout(resolve, 700))
    return { id: 'demo-submission', demo: true }
  }

  if (turnstileToken) formData.set('turnstileToken', turnstileToken)
  const response = await fetch(`${functionsUrl}/submit-memory`, {
    method: 'POST',
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as {
      error?: string
    } | null
    throw new Error(result?.error ?? 'We could not send this memory.')
  }
  return response.json()
}

export async function getAdminMemories() {
  if (!supabase) return sampleMemories
  const client = supabase
  const { data, error } = await client
    .from('memories')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return Promise.all(
    ((data ?? []) as MemoryRow[]).map(async (row) => {
      const memory = mapMemoryRow(
        row,
        row.status === 'approved' ? approvedStorageUrl : undefined,
      )
      if (row.status === 'approved') return memory
      const [image, thumbnail] = await Promise.all([
        row.image_path
          ? client.storage
              .from('pending-memories')
              .createSignedUrl(row.image_path, 3600)
          : null,
        row.thumbnail_path
          ? client.storage
              .from('pending-memories')
              .createSignedUrl(row.thumbnail_path, 3600)
          : null,
      ])
      return {
        ...memory,
        imageUrl: image?.data?.signedUrl,
        thumbnailUrl: thumbnail?.data?.signedUrl,
      }
    }),
  )
}

export async function setMemoryVisibility(
  id: string,
  visible: boolean,
) {
  if (!supabase || !functionsUrl) return
  const { data } = await supabase.auth.getSession()
  const response = await fetch(`${functionsUrl}/moderate-memory`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session?.access_token}`,
    },
    body: JSON.stringify({ id, action: visible ? 'approve' : 'reject' }),
  })
  if (!response.ok) throw new Error('Visibility update failed.')
}

export async function updateMemory(
  id: string,
  changes: Pick<
    Memory,
    | 'contributorName'
    | 'relationship'
    | 'title'
    | 'story'
    | 'locationName'
    | 'city'
    | 'regionName'
    | 'countryCode'
    | 'latitude'
    | 'longitude'
    | 'happenedAt'
  >,
) {
  if (!supabase) return
  const { error } = await supabase
    .from('memories')
    .update({
      contributor_name: changes.contributorName,
      relationship: changes.relationship || null,
      title: changes.title,
      story: changes.story,
      location_name: changes.locationName,
      city: changes.city || null,
      region_name: changes.regionName || null,
      country_code: changes.countryCode?.toUpperCase() || null,
      latitude: changes.latitude,
      longitude: changes.longitude,
      happened_at: changes.happenedAt || null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function updateReveal(revealed: boolean) {
  if (!supabase) return
  const { error } = await supabase
    .from('site_settings')
    .update({ revealed })
    .eq('id', 1)
  if (error) throw error
}
