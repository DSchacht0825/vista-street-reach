import { z } from 'zod'

export const encounterFormSchema = z.object({
  // Service details
  service_date: z.string().min(1, 'Service date is required'),
  outreach_location: z.string().min(1, 'Location is required'),
  outreach_worker: z.string().min(1, 'Outreach worker name is required'),
  referral_source: z.string().optional().nullable(),

  // GPS coordinates (required, captured automatically)
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),

  // Language and cultural
  language_preference: z.string().optional().nullable(),
  cultural_notes: z.string().optional().nullable(),

  // Co-occurring (mental health)
  co_occurring_mh_sud: z.boolean(),
  co_occurring_type: z.string().optional().nullable(),

  // Other Services
  transportation_provided: z.boolean(),
  shower_trailer: z.boolean(),
  other_services: z.string().optional().nullable(),

  // Placement
  placement_made: z.boolean(),
  placement_location: z.string().optional().nullable(),
  placement_location_other: z.string().optional().nullable(),
  refused_shelter: z.boolean(),
  shelter_unavailable: z.boolean(),

  // Case Management
  high_utilizer_contact: z.boolean(),
  case_management_notes: z.string().optional().nullable(),
})

export type EncounterFormData = z.infer<typeof encounterFormSchema>

// Co-occurring condition types
export const CO_OCCURRING_TYPES = [
  'Substance Use + Depression',
  'Substance Use + Anxiety',
  'Substance Use + Bipolar',
  'Substance Use + PTSD',
  'Substance Use + Schizophrenia',
  'Multiple Conditions',
  'Other',
] as const

// Outreach workers
export const OUTREACH_WORKERS = [
  'Alex',
  'Marsha',
  'Cindy',
  'Vanessa',
  'Angel',
  'Khaliha',
  'Carolina',
  'Sebastian',
  'Ian',
  'Kaylyn',
  'Deborah',
  'Kenny',
] as const

// Placement locations
export const PLACEMENT_LOCATIONS = [
  'BCNC',
  'La Posada',
  'Vista',
  'Victory Outreach',
  'Set Free Ministries',
  'Teen Challenge',
  'Restoration Ranch',
  'Mission Academy',
  'South County Lighthouse',
  'ONC',
  'Solutions for Change',
  'Operation Hope',
  'Other',
] as const
