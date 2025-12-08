import { z } from 'zod'

export const intakeFormSchema = z.object({
  // Personal Information - Core Vista Fields
  first_name: z.string().min(1, 'First name is required').max(100),
  middle_name: z.string().max(100).optional().nullable(),
  last_name: z.string().max(100).optional().nullable(),
  aka: z.string().max(200).optional().nullable(), // AKA/Nicknames
  gender: z.string().optional().nullable(),
  ethnicity: z.string().optional().nullable(),
  age: z.number().int().min(0).max(120).optional().nullable(),

  // Physical Description (Vista-specific)
  height: z.string().max(50).optional().nullable(),
  weight: z.string().max(50).optional().nullable(),
  hair_color: z.string().max(50).optional().nullable(),
  eye_color: z.string().max(50).optional().nullable(),

  // Contact & Notes
  notes: z.string().optional().nullable(),
  photo_url: z.string().optional().nullable(),

  // Optional Extended Fields (for compatibility with Encinitas features)
  phone_number: z.string().optional().nullable(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').or(z.literal('')).optional().nullable(),
  race: z.string().optional().nullable(),
  sexual_orientation: z.string().optional().nullable(),
  preferred_language: z.string().optional().nullable(),

  // Status Information (optional)
  veteran_status: z.boolean().optional().default(false),
  disability_status: z.boolean().optional().default(false),
  disability_types: z.array(z.string()).optional().transform(val => val ?? []),
  chronic_homeless: z.boolean().optional().default(false),
  domestic_violence_victim: z.boolean().optional().default(false),
  chronic_health: z.boolean().optional().default(false),
  mental_health: z.boolean().optional().default(false),
  addictions: z.array(z.string()).optional().transform(val => val ?? []),
  living_situation: z.string().optional().nullable(),
  length_of_time_homeless: z.string().optional().nullable(),
  evictions: z.number().int().min(0).optional().nullable(),
  income: z.string().optional().nullable(),
  income_amount: z.number().min(0).optional().nullable(),
  support_system: z.string().optional().nullable(),

  // Program Information
  enrollment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional().nullable(),
  case_manager: z.string().optional().nullable(),
  referral_source: z.string().optional().nullable(),
  referral_source_other: z.string().optional().nullable(),
  release_of_information: z.boolean().optional().default(false),
})

export type IntakeFormData = z.infer<typeof intakeFormSchema>

// Gender options
export const GENDER_OPTIONS = [
  'Male',
  'Female',
  'Transgender',
  'Non-binary',
  'Prefer not to say',
  'Other',
] as const

// Ethnicity options
export const ETHNICITY_OPTIONS = [
  'White',
  'Black or African American',
  'Hispanic or Latino',
  'Asian',
  'American Indian or Alaska Native',
  'Native Hawaiian or Other Pacific Islander',
  'Multiple',
  'Other',
  'Unknown',
] as const

// Hair color options
export const HAIR_COLOR_OPTIONS = [
  'Black',
  'Brown',
  'Blonde',
  'Red',
  'Gray',
  'White',
  'Bald',
  'Other',
] as const

// Eye color options
export const EYE_COLOR_OPTIONS = [
  'Brown',
  'Blue',
  'Green',
  'Hazel',
  'Gray',
  'Other',
] as const

// HUD Standard Living Situations
export const LIVING_SITUATIONS = [
  'Place not meant for habitation',
  'Emergency shelter',
  'Transitional housing',
  'Safe Haven',
  'Hotel/motel paid by organization',
  'Staying with family/friends (temporary)',
  'Staying with family/friends (permanent)',
  'Vehicle',
  'Other',
] as const

// Race options (for extended form)
export const RACE_OPTIONS = [
  'American Indian or Alaska Native',
  'Asian',
  'Black or African American',
  'Hispanic or Latino',
  'Native Hawaiian or Other Pacific Islander',
  'White',
  'Multiple Races',
  'Prefer not to say',
] as const

export const DISABILITY_TYPES = [
  'Physical',
  'Mental Health',
  'Substance Use',
  'Developmental',
  'Chronic Health Condition',
  'Multiple',
  'Other',
] as const

export const REFERRAL_SOURCES = [
  'Sheriffs',
  'County',
  'SDRM',
  'Other',
] as const

// Team members for case manager dropdown (full names)
export const TEAM_MEMBERS = [
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

export const TIME_HOMELESS_OPTIONS = [
  'Less than 1 month',
  '1-3 months',
  '3-6 months',
  '6-12 months',
  '1-2 years',
  '2-5 years',
  '5-10 years',
  'More than 10 years',
  'Unknown',
] as const

export const SEXUAL_ORIENTATION_OPTIONS = [
  'Heterosexual/Straight',
  'Gay',
  'Lesbian',
  'Bisexual',
  'Queer',
  'Questioning',
  'Prefer not to say',
  'Other',
] as const

export const ADDICTION_OPTIONS = [
  'Alcohol',
  'Cocaine',
  'Opioids',
  'Meth',
  'Fentanyl',
  'Inhalants',
  'Other',
] as const
