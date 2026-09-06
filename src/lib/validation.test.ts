import { describe, expect, it } from 'vitest'
import { contributionSchema } from './validation'

const valid = {
  contributorName: 'Maya',
  relationship: 'Friend',
  title: 'The longest walk home',
  story: 'A vivid and heartfelt memory with more than twenty characters.',
  locationName: 'London, United Kingdom',
  city: 'London',
  regionName: 'England',
  countryCode: 'GB',
  latitude: 51.5072,
  longitude: -0.1276,
  happenedAt: 'Summer 2019',
}

describe('contributionSchema', () => {
  it('accepts a complete memory and coerces coordinates', () => {
    const result = contributionSchema.parse({
      ...valid,
      latitude: '51.5072',
      longitude: '-0.1276',
    })
    expect(result.latitude).toBe(51.5072)
  })

  it('rejects an empty or low-effort story', () => {
    const result = contributionSchema.safeParse({ ...valid, story: 'Too short' })
    expect(result.success).toBe(false)
  })

  it('rejects coordinates outside the globe', () => {
    const result = contributionSchema.safeParse({ ...valid, latitude: 100 })
    expect(result.success).toBe(false)
  })
})
