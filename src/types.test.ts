import { describe, expect, it } from 'vitest'
import { mapMemoryRow, type MemoryRow } from './types'

describe('mapMemoryRow', () => {
  it('exposes storage files only through the provided public base URL', () => {
    const row: MemoryRow = {
      id: 'abc',
      contributor_name: 'Zara',
      relationship: null,
      title: 'A wonderful day',
      story: 'A long enough memory to make the database happy.',
      location_name: 'Lahore, Pakistan',
      city: 'Lahore',
      region_name: 'Punjab',
      country_code: 'pk',
      latitude: 31.5204,
      longitude: 74.3587,
      happened_at: null,
      thumbnail_path: 'abc/thumbnail.webp',
      image_path: 'abc/image.webp',
      status: 'approved',
      created_at: '2026-09-01T00:00:00Z',
    }

    const memory = mapMemoryRow(row, 'https://storage.example/approved')
    expect(memory.imageUrl).toBe(
      'https://storage.example/approved/abc/image.webp',
    )
    expect(memory.relationship).toBeUndefined()
    expect(memory.countryCode).toBe('PK')
  })
})
