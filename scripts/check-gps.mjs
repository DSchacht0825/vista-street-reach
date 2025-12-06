import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function check() {
  // Get all encounters with coordinates
  let allEnc = []
  let from = 0
  while (true) {
    const { data } = await supabase
      .from('encounters')
      .select('latitude, longitude, service_date, outreach_location')
      .range(from, from + 999)
    if (!data || data.length === 0) break
    allEnc = allEnc.concat(data)
    from += 1000
  }

  console.log('Total encounters:', allEnc.length)

  // Check GPS data quality
  const withValidGPS = allEnc.filter(e => e.latitude && e.longitude && e.latitude !== 0 && e.longitude !== 0)
  const withZeroGPS = allEnc.filter(e => e.latitude === 0 || e.longitude === 0)
  const withNullGPS = allEnc.filter(e => !e.latitude || !e.longitude)

  console.log('With valid GPS:', withValidGPS.length)
  console.log('With zero GPS:', withZeroGPS.length)
  console.log('With null GPS:', withNullGPS.length)

  // Sample of valid GPS coordinates
  console.log('\nSample valid coordinates:')
  withValidGPS.slice(0, 5).forEach(e => {
    console.log(' ', e.latitude, e.longitude, '-', e.outreach_location)
  })

  // Check coordinate ranges
  if (withValidGPS.length > 0) {
    const lats = withValidGPS.map(e => e.latitude)
    const lngs = withValidGPS.map(e => e.longitude)
    console.log('\nCoordinate ranges:')
    console.log('  Latitude:', Math.min(...lats), 'to', Math.max(...lats))
    console.log('  Longitude:', Math.min(...lngs), 'to', Math.max(...lngs))
  }

  // Sample of zero GPS
  if (withZeroGPS.length > 0) {
    console.log('\nSample with zero coordinates:')
    withZeroGPS.slice(0, 5).forEach(e => {
      console.log(' ', e.latitude, e.longitude, '-', e.outreach_location)
    })
  }
}

check().catch(console.error)
