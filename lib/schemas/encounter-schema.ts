import { z } from 'zod'

export const encounterFormSchema = z.object({
  // Service details
  service_date: z.string().min(1, 'Service date is required'),
  outreach_location: z.string().min(1, 'Location is required'),
  outreach_worker: z.string().min(1, 'Outreach worker name is required'),
  referral_source: z.string().optional().nullable(),
  service_subtype: z.string().optional().nullable(),

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

  // Support Services (multi-select)
  support_services: z.array(z.string()).default([]),

  // Placement
  placement_made: z.boolean(),
  placement_location: z.string().optional().nullable(),
  placement_location_other: z.string().optional().nullable(),
  placement_detox_name: z.string().optional().nullable(),
  refused_shelter: z.boolean(),
  shelter_unavailable: z.boolean(),

  // Case Management
  high_utilizer_contact: z.boolean(),
  case_management_notes: z.string().optional().nullable(),

  // Photos
  photo_urls: z.array(z.string()).optional().nullable(),
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

// Outreach workers (full names)
export const OUTREACH_WORKERS = [
  'Alex Barragan',
  'Angel Lopez',
  'Carolina Portales',
  'Cindy Ibanez',
  'Deborah Grinstaff',
  'Ian Raniey',
  'Kaylyn Jason',
  'Kenneth Tolbert',
  'Khaliah Norman',
  'Mario Moreno',
  'Marsha Duka',
  'Sebastian De La Torre',
  'Vanessa Alvarez',
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
  'Bridge Housing',
  'Family Reunification',
  'Detox',
  'Other',
] as const

// Support services (multi-select options)
export const SUPPORT_SERVICES = [
  { value: 'birth_certificate', label: 'Birth Certificate Assistance' },
  { value: 'ss_card', label: 'Social Security Card Assistance' },
  { value: 'food_stamps', label: 'CalFresh/Food Stamps Enrollment' },
  { value: 'medi_cal', label: 'Medi-Cal Enrollment' },
  { value: 'food_provided', label: 'Food/Meals Provided' },
  { value: 'phone_assistance', label: 'Phone Assistance' },
] as const

// Service subtypes from Vista/Eponic system
export const SERVICE_SUBTYPES = [
  'Basic Needs (Food, Clothes)',
  'BCNC',
  'Bridge Housing',
  'Chronic/High Utilizer',
  'Health Appointment',
  'In Process for Housing',
  'No Shelter Available',
  'Phone Assessment',
  'Phone Assistance',
  'Referral',
  'Refused Services',
  'Refused Shelter',
  'Relocate',
  'Shelter',
  'Street Case Management',
  'Transportation',
  'Vital Documents',
] as const
