/**
 * Backfill script to fix refused_services data
 *
 * The original import incorrectly mapped both "Refused Services" and "Refused Shelter"
 * to the refused_shelter boolean. This script:
 * 1. Finds encounters with service_subtype = 'Refused Services'
 * 2. Sets refused_services = true, refused_shelter = false for those
 * 3. Finds encounters with service_subtype = 'Refused Shelter'
 * 4. Ensures refused_shelter = true, refused_services = false for those
 *
 * Usage: node scripts/backfill-refused-services.mjs
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function backfillRefusedServices() {
  console.log('=== Backfilling Refused Services Data ===\n')

  // First, check current state
  console.log('Checking current state...')

  const { data: refusedServicesRecords, error: err1 } = await supabase
    .from('encounters')
    .select('id, service_subtype, refused_shelter, refused_services')
    .eq('service_subtype', 'Refused Services')

  const { data: refusedShelterRecords, error: err2 } = await supabase
    .from('encounters')
    .select('id, service_subtype, refused_shelter, refused_services')
    .eq('service_subtype', 'Refused Shelter')

  if (err1 || err2) {
    console.error('Error fetching records:', err1 || err2)
    process.exit(1)
  }

  console.log(`Found ${refusedServicesRecords?.length || 0} encounters with service_subtype = 'Refused Services'`)
  console.log(`Found ${refusedShelterRecords?.length || 0} encounters with service_subtype = 'Refused Shelter'`)

  // Update "Refused Services" records
  if (refusedServicesRecords && refusedServicesRecords.length > 0) {
    console.log('\nUpdating "Refused Services" encounters...')

    const { error: updateErr1 } = await supabase
      .from('encounters')
      .update({
        refused_services: true,
        refused_shelter: false
      })
      .eq('service_subtype', 'Refused Services')

    if (updateErr1) {
      console.error('Error updating Refused Services records:', updateErr1)
    } else {
      console.log(`✓ Updated ${refusedServicesRecords.length} "Refused Services" records`)
      console.log('  - Set refused_services = true')
      console.log('  - Set refused_shelter = false')
    }
  }

  // Update "Refused Shelter" records
  if (refusedShelterRecords && refusedShelterRecords.length > 0) {
    console.log('\nUpdating "Refused Shelter" encounters...')

    const { error: updateErr2 } = await supabase
      .from('encounters')
      .update({
        refused_services: false,
        refused_shelter: true
      })
      .eq('service_subtype', 'Refused Shelter')

    if (updateErr2) {
      console.error('Error updating Refused Shelter records:', updateErr2)
    } else {
      console.log(`✓ Updated ${refusedShelterRecords.length} "Refused Shelter" records`)
      console.log('  - Set refused_shelter = true')
      console.log('  - Set refused_services = false')
    }
  }

  // Verify the changes
  console.log('\n=== Verification ===')

  const { data: verifyServices } = await supabase
    .from('encounters')
    .select('id')
    .eq('refused_services', true)

  const { data: verifyShelter } = await supabase
    .from('encounters')
    .select('id')
    .eq('refused_shelter', true)

  console.log(`Total encounters with refused_services = true: ${verifyServices?.length || 0}`)
  console.log(`Total encounters with refused_shelter = true: ${verifyShelter?.length || 0}`)

  console.log('\n✓ Backfill complete!')
}

backfillRefusedServices().catch(console.error)
