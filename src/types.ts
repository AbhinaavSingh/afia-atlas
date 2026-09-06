export type MemoryStatus = 'pending' | 'approved' | 'rejected'

export interface Memory {
  id: string
  contributorName: string
  relationship?: string
  title: string
  story: string
  locationName: string
  city?: string
  regionName?: string
  countryCode?: string
  latitude: number
  longitude: number
  happenedAt?: string
  thumbnailUrl?: string
  imageUrl?: string
  status: MemoryStatus
  createdAt: string
}

export interface SiteSettings {
  revealed: boolean
  revealAt: string
  contributionsOpen: boolean
}

export interface MemoryRow {
  id: string
  contributor_name: string
  relationship: string | null
  title: string
  story: string
  location_name: string
  city: string | null
  region_name: string | null
  country_code: string | null
  latitude: number
  longitude: number
  happened_at: string | null
  thumbnail_path: string | null
  image_path: string | null
  status: MemoryStatus
  created_at: string
}

export const mapMemoryRow = (row: MemoryRow, publicStorageUrl?: string): Memory => ({
  id: row.id,
  contributorName: row.contributor_name,
  relationship: row.relationship ?? undefined,
  title: row.title,
  story: row.story,
  locationName: row.location_name,
  city: row.city ?? undefined,
  regionName: row.region_name ?? undefined,
  countryCode: row.country_code?.toUpperCase() ?? undefined,
  latitude: Number(row.latitude),
  longitude: Number(row.longitude),
  happenedAt: row.happened_at ?? undefined,
  thumbnailUrl:
    row.thumbnail_path && publicStorageUrl
      ? `${publicStorageUrl}/${row.thumbnail_path}`
      : undefined,
  imageUrl:
    row.image_path && publicStorageUrl
      ? `${publicStorageUrl}/${row.image_path}`
      : undefined,
  status: row.status,
  createdAt: row.created_at,
})
