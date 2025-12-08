import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function compareData() {
  // Get all encounters in Nov 2025
  const { data: encounters, error } = await supabase
    .from('encounters')
    .select('*')
    .gte('service_date', '2025-11-01')
    .lt('service_date', '2025-12-01')

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('=== OUR SYSTEM (Nov 1-30, 2025) ===')
  console.log('Total encounters:', encounters.length)

  // Calculate subtypes similar to how the import script mapped them
  const serviceSubtypes = {}

  encounters.forEach(e => {
    // Check other_services field for mapped subtypes
    const otherServices = e.other_services || ''

    if (otherServices.includes('Food/Clothes') || e.support_services?.includes('food_provided')) {
      serviceSubtypes['Basic Needs (Food, Clothes)'] = (serviceSubtypes['Basic Needs (Food, Clothes)'] || 0) + 1
    }
    if (e.placement_location === 'BCNC') {
      serviceSubtypes['BCNC'] = (serviceSubtypes['BCNC'] || 0) + 1
    }
    if (e.placement_location === 'Bridge Housing' || (e.placement_location_other && e.placement_location_other.includes('Bridge'))) {
      serviceSubtypes['Bridge Housing'] = (serviceSubtypes['Bridge Housing'] || 0) + 1
    }
    if (e.high_utilizer_contact) {
      serviceSubtypes['Chronic/High Utilizer'] = (serviceSubtypes['Chronic/High Utilizer'] || 0) + 1
    }
    if (otherServices.includes('Health appointment') || e.co_occurring_mh_sud) {
      serviceSubtypes['Health Appointment'] = (serviceSubtypes['Health Appointment'] || 0) + 1
    }
    if (otherServices.includes('Housing qualification')) {
      serviceSubtypes['In Process for Housing'] = (serviceSubtypes['In Process for Housing'] || 0) + 1
    }
    if (e.shelter_unavailable) {
      serviceSubtypes['No Shelter Available'] = (serviceSubtypes['No Shelter Available'] || 0) + 1
    }
    if (otherServices.includes('Phone assessment')) {
      serviceSubtypes['Phone Assessment'] = (serviceSubtypes['Phone Assessment'] || 0) + 1
    }
    if (otherServices.includes('Phone assistance')) {
      serviceSubtypes['Phone Assistance'] = (serviceSubtypes['Phone Assistance'] || 0) + 1
    }
    if (otherServices.includes('Referral') || e.mat_referral || e.detox_referral) {
      serviceSubtypes['Referral'] = (serviceSubtypes['Referral'] || 0) + 1
    }
    if (e.refused_shelter && !e.shelter_unavailable) {
      serviceSubtypes['Refused Shelter'] = (serviceSubtypes['Refused Shelter'] || 0) + 1
    }
    if (otherServices.includes('Relocation')) {
      serviceSubtypes['Relocate'] = (serviceSubtypes['Relocate'] || 0) + 1
    }
    if (e.placement_made && e.placement_location && !['BCNC', 'Bridge Housing', 'Detox'].includes(e.placement_location)) {
      serviceSubtypes['Shelter'] = (serviceSubtypes['Shelter'] || 0) + 1
    }
    if (e.case_management_notes && !e.placement_made && !e.refused_shelter) {
      serviceSubtypes['Street Case Management'] = (serviceSubtypes['Street Case Management'] || 0) + 1
    }
    if (e.transportation_provided) {
      serviceSubtypes['Transportation'] = (serviceSubtypes['Transportation'] || 0) + 1
    }
    if (otherServices.includes('ID') || otherServices.includes('vital documents') || e.support_services?.includes('birth_certificate') || e.support_services?.includes('ss_card')) {
      serviceSubtypes['Vital Documents'] = (serviceSubtypes['Vital Documents'] || 0) + 1
    }
  })

  console.log('\nService Subtypes from Our System:')
  Object.entries(serviceSubtypes)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([subtype, count]) => {
      console.log(subtype + ':', count)
    })

  // Show sample of raw other_services values
  console.log('\n=== Sample other_services values ===')
  const uniqueOther = new Set()
  encounters.forEach(e => {
    if (e.other_services) uniqueOther.add(e.other_services)
  })
  console.log([...uniqueOther].slice(0, 20))
}

compareData()
