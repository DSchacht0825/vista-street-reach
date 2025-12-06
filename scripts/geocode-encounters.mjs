import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Geocode an address using OpenStreetMap Nominatim (free, no API key needed)
async function geocodeAddress(address) {
  // Add Vista, CA to the address for better results
  const fullAddress = address.includes('Vista') || address.includes('CA')
    ? address
    : `${address}, Vista, CA`

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1`

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Vista-Street-Reach-App/1.0'
      }
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()

    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon)
      }
    }

    return null
  } catch (error) {
    console.error('Geocoding error for', address, ':', error.message)
    return null
  }
}

// Rate limit helper - Nominatim requires 1 request per second
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function geocodeEncounters() {
  console.log('Fetching encounters with missing GPS coordinates...\n')

  // Fetch all encounters with zero or null GPS
  let encountersToUpdate = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('encounters')
      .select('id, outreach_location, latitude, longitude')
      .or('latitude.eq.0,longitude.eq.0,latitude.is.null,longitude.is.null')
      .range(from, from + 999)

    if (error) {
      console.error('Error fetching encounters:', error)
      return
    }

    if (!data || data.length === 0) break
    encountersToUpdate = encountersToUpdate.concat(data)
    from += 1000
  }

  console.log(`Found ${encountersToUpdate.length} encounters to geocode\n`)

  // Get unique addresses to minimize API calls
  const uniqueAddresses = [...new Set(encountersToUpdate.map(e => e.outreach_location))]
  console.log(`Unique addresses to geocode: ${uniqueAddresses.length}\n`)

  // Geocode each unique address
  const addressCache = new Map()
  let geocoded = 0
  let failed = 0

  for (const address of uniqueAddresses) {
    if (!address || address.trim() === '') {
      failed++
      continue
    }

    console.log(`Geocoding (${geocoded + failed + 1}/${uniqueAddresses.length}): ${address}`)

    const coords = await geocodeAddress(address)

    if (coords) {
      addressCache.set(address, coords)
      geocoded++
      console.log(`  ✓ Found: ${coords.latitude}, ${coords.longitude}`)
    } else {
      failed++
      console.log(`  ✗ Not found`)
    }

    // Rate limit: 1 request per second for Nominatim
    await sleep(1100)
  }

  console.log(`\nGeocoding complete: ${geocoded} found, ${failed} not found\n`)

  // Update encounters with geocoded coordinates
  console.log('Updating encounters in database...\n')

  let updated = 0
  let skipped = 0

  for (const encounter of encountersToUpdate) {
    const coords = addressCache.get(encounter.outreach_location)

    if (coords) {
      const { error } = await supabase
        .from('encounters')
        .update({
          latitude: coords.latitude,
          longitude: coords.longitude
        })
        .eq('id', encounter.id)

      if (error) {
        console.error(`Error updating encounter ${encounter.id}:`, error.message)
      } else {
        updated++
      }
    } else {
      skipped++
    }

    if (updated % 100 === 0 && updated > 0) {
      console.log(`Updated ${updated} encounters...`)
    }
  }

  console.log(`\n=== Complete ===`)
  console.log(`Encounters updated: ${updated}`)
  console.log(`Encounters skipped (no geocode): ${skipped}`)

  // Show failed addresses for manual review
  const failedAddresses = uniqueAddresses.filter(a => a && !addressCache.has(a))
  if (failedAddresses.length > 0) {
    console.log(`\n=== Addresses that could not be geocoded ===`)
    failedAddresses.forEach(a => console.log(` - ${a}`))
  }
}

geocodeEncounters().catch(console.error)
