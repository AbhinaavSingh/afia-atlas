import { z } from 'zod'

export const contributionSchema = z.object({
  contributorName: z.string().trim().min(2).max(80),
  relationship: z.string().trim().max(80),
  title: z.string().trim().min(3).max(120),
  story: z.string().trim().min(20).max(1800),
  locationName: z.string().trim().min(2).max(140),
  city: z.string().trim().max(100),
  regionName: z.string().trim().max(100),
  countryCode: z.string().trim().length(2).toUpperCase().or(z.literal('')),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  happenedAt: z.string().max(40),
})
