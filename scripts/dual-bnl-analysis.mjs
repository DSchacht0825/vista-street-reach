import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function analyze() {
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const cutoff = ninetyDaysAgo.toISOString().split('T')[0]

  // Get active persons
  const { data: activePersons } = await supabase
    .from('persons')
    .select('id, first_name, last_name, client_id, last_contact')
    .is('exit_date', null)
    .gte('last_contact', cutoff)

  const activeIds = activePersons.map(p => p.id)

  // Get most recent placement for each active person
  const { data: allPlacements } = await supabase
    .from('encounters')
    .select('person_id, placement_made, placement_location, service_date')
    .eq('placement_made', true)
    .in('person_id', activeIds)
    .order('service_date', { ascending: false })

  // Get most recent encounter for each person to see current status
  const { data: recentEncounters } = await supabase
    .from('encounters')
    .select('person_id, service_date, placement_made, placement_location')
    .in('person_id', activeIds)
    .order('service_date', { ascending: false })

  // Build a map of most recent placement per person
  const lastPlacement = {}
  allPlacements.forEach(p => {
    if (!lastPlacement[p.person_id]) {
      lastPlacement[p.person_id] = p
    }
  })

  // Build a map of most recent encounter per person
  const lastEncounter = {}
  recentEncounters.forEach(e => {
    if (!lastEncounter[e.person_id]) {
      lastEncounter[e.person_id] = e
    }
  })

  // Categorize: currently sheltered vs unsheltered
  // Consider someone 'currently sheltered' if their most recent encounter had a placement
  const currentlySheltered = []
  const unsheltered = []

  activePersons.forEach(p => {
    const lastEnc = lastEncounter[p.id]
    if (lastEnc && lastEnc.placement_made) {
      currentlySheltered.push({ ...p, placement: lastEnc.placement_location })
    } else {
      unsheltered.push(p)
    }
  })

  console.log('=== DUAL BY-NAME-LIST APPROACH ===\n')
  console.log('TOTAL BY-NAME-LIST (everyone):        ', activePersons.length)
  console.log('├── UNSHELTERED BY-NAME-LIST:         ', unsheltered.length)
  console.log('└── CURRENTLY SHELTERED:              ', currentlySheltered.length)

  const unshelteredPct = ((unsheltered.length / activePersons.length) * 100).toFixed(1)
  const shelteredPct = ((currentlySheltered.length / activePersons.length) * 100).toFixed(1)

  console.log('\n=== BREAKDOWN ===')
  console.log('Unsheltered:', unshelteredPct + '%')
  console.log('Sheltered:  ', shelteredPct + '%')

  // Where are sheltered people placed?
  const shelterLocs = {}
  currentlySheltered.forEach(p => {
    const loc = p.placement || 'Unknown'
    shelterLocs[loc] = (shelterLocs[loc] || 0) + 1
  })

  console.log('\n=== CURRENTLY SHELTERED BY LOCATION ===')
  Object.entries(shelterLocs)
    .sort((a, b) => b[1] - a[1])
    .forEach(([loc, count]) => {
      console.log('  ' + loc + ':', count)
    })

  // People with placement history but currently unsheltered
  const everPlaced = new Set(Object.keys(lastPlacement))
  const returnedUnsheltered = unsheltered.filter(p => everPlaced.has(p.id))

  console.log('\n=== CYCLING INSIGHT ===')
  console.log('Currently unsheltered who were previously placed:', returnedUnsheltered.length)
  console.log('(This shows people cycling back to streets after shelter)')
}

analyze()
