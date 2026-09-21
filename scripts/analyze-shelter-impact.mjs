import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function analyze() {
  // Get all active persons (no exit_date)
  const { data: activePersons, error: personsError } = await supabase
    .from('persons')
    .select('id, first_name, last_name, client_id, last_contact, enrollment_date')
    .is('exit_date', null)

  if (personsError) {
    console.error('Error fetching persons:', personsError)
    return
  }

  console.log('=== BY-NAME-LIST IMPACT ANALYSIS ===\n')
  console.log(`Total active persons on by-name-list: ${activePersons.length}`)

  // Get all encounters with placement_made = true
  const { data: placements, error: placementsError } = await supabase
    .from('encounters')
    .select('person_id, placement_made, placement_location, service_date')
    .eq('placement_made', true)

  if (placementsError) {
    console.error('Error fetching placements:', placementsError)
    return
  }

  // Get unique person IDs who have ever had a shelter placement
  const personsWithPlacement = new Set(placements.map(p => p.person_id))

  // Filter to only active persons who have placements
  const activePersonsWithPlacement = activePersons.filter(p => personsWithPlacement.has(p.id))

  console.log(`\nPersons with shelter placement (ever): ${personsWithPlacement.size}`)
  console.log(`Active persons with shelter placement: ${activePersonsWithPlacement.length}`)

  // Calculate what the list would look like
  const newListSize = activePersons.length - activePersonsWithPlacement.length
  const reductionPercent = ((activePersonsWithPlacement.length / activePersons.length) * 100).toFixed(1)

  console.log('\n=== IF WE REMOVED SHELTERED INDIVIDUALS ===')
  console.log(`Current by-name-list: ${activePersons.length}`)
  console.log(`Would remove: ${activePersonsWithPlacement.length} (${reductionPercent}%)`)
  console.log(`New by-name-list size: ${newListSize}`)

  // Breakdown by placement location
  const locationCounts = {}
  placements.forEach(p => {
    const loc = p.placement_location || 'Unknown'
    locationCounts[loc] = (locationCounts[loc] || 0) + 1
  })

  console.log('\n=== PLACEMENT LOCATIONS ===')
  Object.entries(locationCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([loc, count]) => {
      console.log(`  ${loc}: ${count} placements`)
    })

  // Recent placements (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const recentPlacements = placements.filter(p =>
    new Date(p.service_date) >= thirtyDaysAgo
  )
  const recentPersonsPlaced = new Set(recentPlacements.map(p => p.person_id))
  const activeRecentlyPlaced = activePersons.filter(p => recentPersonsPlaced.has(p.id))

  console.log('\n=== RECENT PLACEMENTS (Last 30 Days) ===')
  console.log(`Placements made: ${recentPlacements.length}`)
  console.log(`Active persons with recent placement: ${activeRecentlyPlaced.length}`)

  if (activeRecentlyPlaced.length > 0) {
    const recentReduction = ((activeRecentlyPlaced.length / activePersons.length) * 100).toFixed(1)
    console.log(`If removing only recently sheltered: ${activePersons.length - activeRecentlyPlaced.length} (${recentReduction}% reduction)`)
  }

  // Get encounters where shelter was refused or unavailable
  const { data: shelterAttempts, error: attemptsError } = await supabase
    .from('encounters')
    .select('person_id, refused_shelter, shelter_unavailable')
    .or('refused_shelter.eq.true,shelter_unavailable.eq.true')

  if (!attemptsError && shelterAttempts) {
    const refusedCount = shelterAttempts.filter(e => e.refused_shelter).length
    const unavailableCount = shelterAttempts.filter(e => e.shelter_unavailable).length

    console.log('\n=== SHELTER CONTEXT ===')
    console.log(`Encounters where shelter refused: ${refusedCount}`)
    console.log(`Encounters where shelter unavailable: ${unavailableCount}`)
  }
}

analyze()
