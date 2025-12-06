import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Vista, CA bounding box (approximate)
const VISTA_BOUNDS = {
  minLat: 33.12,
  maxLat: 33.24,
  minLng: -117.30,
  maxLng: -117.19
}

// Known locations in Vista for common addresses
const MANUAL_GEOCODES = {
  '1972-1976 Via Centre': { latitude: 33.1844, longitude: -117.2823 },
  '2469 Impala Dr': { latitude: 33.1515, longitude: -117.2188 },
  '1162 Delpy View Pt': { latitude: 33.2168, longitude: -117.2230 },
  '502-544 Hacienda Dr': { latitude: 33.1922, longitude: -117.2526 },
  '1339-1345 N Escondido Blvd': { latitude: 33.1284, longitude: -117.0867 },
  '260-298 W El Norte Pkwy': { latitude: 33.2147, longitude: -117.1007 },
  'Centre City Pkwy': { latitude: 33.1284, longitude: -117.0867 },
  '2035-2099 Victory Dr': { latitude: 33.1839, longitude: -117.2833 },
  '1341 N Escondido Blvd': { latitude: 33.1284, longitude: -117.0867 },
  '601-655 Hacienda Dr': { latitude: 33.1928, longitude: -117.2574 },
  '640-662 Sycamore Ave': { latitude: 33.1666, longitude: -117.2161 },
  '503-519 Hacienda Dr': { latitude: 33.1922, longitude: -117.2526 },
  '202 S Rancho Santa Fe Rd': { latitude: 33.1980, longitude: -117.2680 },
  '584-598 Hacienda Dr': { latitude: 33.1928, longitude: -117.2560 },
  '7447 Otay Mesa Rd': { latitude: 32.5605, longitude: -116.9386 },
  '1120-1132 E Taylor St': { latitude: 33.2272, longitude: -117.2253 },
  '1270-1282 Hacienda Dr': { latitude: 33.1927, longitude: -117.2680 },
  '2002-2098 Hartwright Rd': { latitude: 33.1744, longitude: -117.2073 },
  '1901-1911 Buena Creek Rd': { latitude: 33.1925, longitude: -117.2560 },
  '1300 N Escondido Blvd': { latitude: 33.1284, longitude: -117.0867 },
  '3437-3451 Thunder Dr': { latitude: 33.1836, longitude: -117.2881 },
  '2422-2432 S El Camino Real': { latitude: 33.1910, longitude: -117.2549 },
  '2402-2412 S El Camino Real': { latitude: 33.1910, longitude: -117.2549 },
  '101-127 Via Vera Cruz': { latitude: 33.1932, longitude: -117.2580 },
  'S Las Posas Rd': { latitude: 33.2100, longitude: -117.2670 },
  '2125-2133 S Santa Fe Ave': { latitude: 33.1720, longitude: -117.2070 },
  '2044-2052 S Santa Fe Ave': { latitude: 33.1735, longitude: -117.2080 },
  '2000-2030 S Santa Fe Ave': { latitude: 33.1740, longitude: -117.2085 },
  '5237 Jack Pine Ct': { latitude: 33.1700, longitude: -117.2200 },
  '1544-1554 Whispering Palm Dr': { latitude: 33.1600, longitude: -117.2100 },
  '450 W El Norte Pkwy': { latitude: 33.2147, longitude: -117.1007 },
  '5240 Jack Pine Ct': { latitude: 33.1700, longitude: -117.2200 },
  '2165-2169 S Santa Fe Ave': { latitude: 33.1718, longitude: -117.2069 },
  '6616 Miramar Rd': { latitude: 32.8770, longitude: -117.1450 },
  '7988 Miramar Rd': { latitude: 32.8770, longitude: -117.1450 },
  '112 Palmyra Dr': { latitude: 33.1706, longitude: -117.2074 },
  '638-652 Eucalyptus Ave': { latitude: 33.2025, longitude: -117.2377 },
  '2478 Impala Dr': { latitude: 33.1515, longitude: -117.2188 },
  '367 Via Vera Cruz': { latitude: 33.1932, longitude: -117.2580 },
  '965-973 Boardwalk': { latitude: 33.1910, longitude: -117.2550 },
  '351-373 Mimosa Ave': { latitude: 33.1590, longitude: -117.2100 },
  '2546-2580 Birch St': { latitude: 33.1522, longitude: -117.2207 },
  '942-958 E Vista Way': { latitude: 33.2110, longitude: -117.2300 },
  '306 N Horne St': { latitude: 33.2040, longitude: -117.2440 },
  '2472 Impala Dr': { latitude: 33.1515, longitude: -117.2188 },
  '2463 Impala Dr': { latitude: 33.1515, longitude: -117.2188 },
  '800 W Valley Pkwy': { latitude: 33.1500, longitude: -117.1000 },
  '655 Benet Rd': { latitude: 33.1600, longitude: -117.2600 },
  '2148-2196 Citracado Pkwy': { latitude: 33.1284, longitude: -117.0867 },
  '681-707 Hacienda Dr': { latitude: 33.1928, longitude: -117.2574 },
  '1640-1692 Thibodo Rd': { latitude: 33.1759, longitude: -117.2278 },
  '720-798 Hacienda Dr': { latitude: 33.1928, longitude: -117.2574 },
  '320-348 Vista Village Dr': { latitude: 33.2000, longitude: -117.2470 },
  '1780-1798 W Vista Way': { latitude: 33.1890, longitude: -117.2790 },
  '1701-1749 Goodwin Dr': { latitude: 33.2240, longitude: -117.2450 },
  '1601-1699 Manor Dr': { latitude: 33.2250, longitude: -117.2449 },
  '1283-1299 Tylee St': { latitude: 33.2275, longitude: -117.2265 },
  '1229-1277 W Vista Way': { latitude: 33.1940, longitude: -117.2673 },
  '678-692 Sycamore Ave': { latitude: 33.1666, longitude: -117.2161 },
  '2110-2146 Citracado Pkwy': { latitude: 33.1284, longitude: -117.0867 },
  '135 S Rancho Santa Fe Rd': { latitude: 33.1980, longitude: -117.2680 },
  '822 N Coast Hwy': { latitude: 33.2000, longitude: -117.3800 },
  '141 E Carmel St': { latitude: 33.2030, longitude: -117.2420 },
  '2034-2058 S El Camino Real': { latitude: 33.1910, longitude: -117.2549 },
  '2402 Auto Park Way': { latitude: 33.1284, longitude: -117.0867 },
  '2550-2564 Auto Park Way': { latitude: 33.1284, longitude: -117.0867 },
  '1901-1969 Via Centre': { latitude: 33.1845, longitude: -117.2820 },
  '1744-1778 W Vista Way': { latitude: 33.1890, longitude: -117.2790 },
  '3236-3252 Shadow Tree Dr': { latitude: 33.1850, longitude: -117.2900 },
  '3248 Shadow Tree Dr': { latitude: 33.1850, longitude: -117.2900 },
  '3240 Shadow Tree Dr': { latitude: 33.1850, longitude: -117.2900 },
  '550 W Washington Ave': { latitude: 33.1284, longitude: -117.0867 },
  '100 CR-14': { latitude: 33.2050, longitude: -117.2400 },
  '630-652 Hacienda Dr': { latitude: 33.1932, longitude: -117.2549 },
  '4181-4193 Oceanside Blvd': { latitude: 33.2213, longitude: -117.2572 },
  '4557-4587 Oceanside Blvd': { latitude: 33.2213, longitude: -117.2572 },
  '4789-4799 Oceanside Blvd': { latitude: 33.2213, longitude: -117.2572 },
  '13-21 CR-14': { latitude: 33.2050, longitude: -117.2400 },
  '3045-3075 Enterprise Ct': { latitude: 33.1449, longitude: -117.2230 },
  '3768 Ocean Ranch Blvd': { latitude: 33.2150, longitude: -117.2700 },
  '1796-1818 S Santa Fe Ave': { latitude: 33.1787, longitude: -117.2150 },
  '525-629 La Tortuga Dr': { latitude: 33.1887, longitude: -117.2598 },
  '202 Holiday Way': { latitude: 33.2030, longitude: -117.2420 },
  '3000-3042 Enterprise Ct': { latitude: 33.1449, longitude: -117.2230 },
  '832-850 Matagual Dr': { latitude: 33.1896, longitude: -117.2506 },
  '1146 S Ditmar St': { latitude: 33.2000, longitude: -117.2400 },
  '1151 S Coast Hwy': { latitude: 33.2000, longitude: -117.3800 },
  '404 S Coast Hwy': { latitude: 33.2000, longitude: -117.3800 },
  '1834-1848 Hacienda Dr': { latitude: 33.1858, longitude: -117.2801 },
  '2409-2421 Foothill Dr': { latitude: 33.2015, longitude: -117.2067 },
  '2395-2401 Foothill Dr': { latitude: 33.2015, longitude: -117.2067 },
  '723-753 Hacienda Dr': { latitude: 33.1928, longitude: -117.2574 },
  '657-667 Hacienda Dr': { latitude: 33.1928, longitude: -117.2574 },
  '255 Holiday Way': { latitude: 33.2030, longitude: -117.2420 },
  '3600 Ocean Ranch Blvd': { latitude: 33.2150, longitude: -117.2700 },
  '3735 Maritime Way': { latitude: 33.2150, longitude: -117.2700 },
  '447-505 W Vista Way': { latitude: 33.1965, longitude: -117.2521 },
  'Buena Creek Rd': { latitude: 33.1925, longitude: -117.2560 },
  'E 24th St': { latitude: 33.2000, longitude: -117.2400 },

  // Incorrectly geocoded addresses that need fixing
  'CA-78 E': { latitude: 33.1900, longitude: -117.2550 }, // Was geocoded to Montreal
  'S El Camino Real': { latitude: 33.1910, longitude: -117.2549 }, // Was geocoded to Monterey County
  '592-594 W Vista Way': { latitude: 33.1960, longitude: -117.2540 }, // Was geocoded to Sacramento
  '169-187 Vista Village Dr': { latitude: 33.1975, longitude: -117.2460 }, // Was geocoded to San Antonio
  '1060 Airport Rd': { latitude: 33.2100, longitude: -117.2550 }, // Was geocoded to Stockton
  '490 N Grape St': { latitude: 33.2000, longitude: -117.2400 }, // Was geocoded to Lodi
  '1593 E Vista Way': { latitude: 33.2228, longitude: -117.2256 }, // Was geocoded to Florida
  '1363 E Vista Way': { latitude: 33.2190, longitude: -117.2270 }, // Was geocoded to Florida
  '1260 E Vista Way': { latitude: 33.2185, longitude: -117.2280 }, // Was geocoded to Florida
  '125-155 Vista Village Dr': { latitude: 33.1975, longitude: -117.2460 }, // Was geocoded to San Antonio
  '147-175 Vista Village Dr': { latitude: 33.1975, longitude: -117.2460 }, // Was geocoded to San Antonio
  '225 Vista Village Dr': { latitude: 33.1975, longitude: -117.2460 }, // Verify it's correct
  '495-499 Vista Village Dr': { latitude: 33.2015, longitude: -117.2445 }, // Was geocoded to San Antonio
  '125 Vista Village Dr': { latitude: 33.1975, longitude: -117.2460 }, // Was geocoded to San Antonio
  'W Vista Way': { latitude: 33.1900, longitude: -117.2700 }, // Was geocoded to Sacramento
  '596-598 W Vista Way': { latitude: 33.1960, longitude: -117.2540 }, // Was geocoded to Sacramento
  '1781-1799 W Vista Way': { latitude: 33.1890, longitude: -117.2790 }, // Was geocoded to Sacramento
  '2608 El Camino Real': { latitude: 33.1910, longitude: -117.2549 }, // Was geocoded to Monterey County
  '4930 Lake Blvd': { latitude: 33.1600, longitude: -117.2200 }, // Was geocoded to Tahoe
  '2360 Euclid Ave': { latitude: 33.1900, longitude: -117.2600 }, // Was geocoded to SF
  '2518 Euclid Ave': { latitude: 33.1900, longitude: -117.2600 }, // Was geocoded to SF
  '2425 Euclid Ave': { latitude: 33.1900, longitude: -117.2600 }, // Was geocoded to SF
  '338-348 Mimosa Ave': { latitude: 33.1590, longitude: -117.2100 }, // Was geocoded to Ottawa
  '2564 Bella Vista Dr': { latitude: 33.2000, longitude: -117.2500 }, // Was geocoded to Wyoming
  '186 Ocean View Dr': { latitude: 33.2000, longitude: -117.2600 }, // Was geocoded to Pacific Palisades
  '264-280 E Main St': { latitude: 33.2005, longitude: -117.2440 }, // Was geocoded to El Cajon
  '761 E Vista Way': { latitude: 33.2083, longitude: -117.2362 }, // Was geocoded to Florida
  '777 E Vista Way': { latitude: 33.2085, longitude: -117.2355 }, // Was geocoded to Florida
  '1074 E Vista Way': { latitude: 33.2135, longitude: -117.2290 }, // Was geocoded to Florida
  '857 E Vista Way': { latitude: 33.2095, longitude: -117.2330 }, // Was geocoded to Florida
  '1350 E Vista Way': { latitude: 33.2188, longitude: -117.2275 }, // Was geocoded to Florida
  '9462 Owl Ct': { latitude: 33.1700, longitude: -117.2200 }, // Was geocoded to Tracy
  '1207 S Mission Rd': { latitude: 33.1920, longitude: -117.2308 }, // Was geocoded to San Diego Old Town
  '1507 Mission Rd': { latitude: 33.1920, longitude: -117.2308 }, // Was geocoded to San Diego Old Town
  'Orion St': { latitude: 33.1700, longitude: -117.2300 }, // Was geocoded to Lemon Grove
  'Palomar Medical Center': { latitude: 33.1284, longitude: -117.0867 }, // Was geocoded to Escondido - that's correct but keep for reference

  // Additional addresses that need manual geocoding
  '630 Sycamore Ave': { latitude: 33.1666, longitude: -117.2161 },
  '3131 Oceanside Blvd': { latitude: 33.2213, longitude: -117.2572 },
  '1701 Mission Ave': { latitude: 33.2100, longitude: -117.3200 },
  'CA-78 W': { latitude: 33.1900, longitude: -117.2550 },
  '3707 Maritime Way': { latitude: 33.2150, longitude: -117.2700 },
  '1002 Mission Ave': { latitude: 33.2100, longitude: -117.3200 },
  '2400 Euclid Ave': { latitude: 33.1900, longitude: -117.2600 },
  '420 N Coast Hwy': { latitude: 33.2100, longitude: -117.3850 },
  'Vista': { latitude: 33.2000, longitude: -117.2426 },
  '1919 Apple St': { latitude: 33.1600, longitude: -117.2200 },
  '528 W Washington Ave': { latitude: 33.1284, longitude: -117.0867 },
  '3708 Ocean Ranch Blvd': { latitude: 33.2150, longitude: -117.2700 },
  '414 N Coast Hwy': { latitude: 33.2100, longitude: -117.3850 },
  '4920 Amador Dr': { latitude: 33.2300, longitude: -117.3000 },
  '1403 s Sante fe ave': { latitude: 33.1843, longitude: -117.2233 },
  '1403 s sante fe ave': { latitude: 33.1843, longitude: -117.2233 }
}

function isInVistaBounds(lat, lng) {
  return lat >= VISTA_BOUNDS.minLat && lat <= VISTA_BOUNDS.maxLat &&
         lng >= VISTA_BOUNDS.minLng && lng <= VISTA_BOUNDS.maxLng
}

async function fixGeocoding() {
  console.log('=== Fixing Geocoding Issues ===\n')

  // Step 1: Find encounters with coordinates outside Vista bounds
  console.log('Step 1: Finding encounters with coordinates outside Vista area...\n')

  let allEncounters = []
  let from = 0
  while (true) {
    const { data } = await supabase
      .from('encounters')
      .select('id, latitude, longitude, outreach_location')
      .range(from, from + 999)
    if (!data || data.length === 0) break
    allEncounters = allEncounters.concat(data)
    from += 1000
  }

  console.log(`Total encounters: ${allEncounters.length}`)

  // Find encounters outside Vista bounds (but not zero)
  const outsideBounds = allEncounters.filter(e =>
    e.latitude && e.longitude &&
    e.latitude !== 0 && e.longitude !== 0 &&
    !isInVistaBounds(e.latitude, e.longitude)
  )

  console.log(`Encounters with coords outside Vista bounds: ${outsideBounds.length}`)

  // Find encounters with zero/null coords
  const zeroCoords = allEncounters.filter(e =>
    !e.latitude || !e.longitude || e.latitude === 0 || e.longitude === 0
  )

  console.log(`Encounters with zero/null coords: ${zeroCoords.length}\n`)

  // Step 2: Fix outside-bounds encounters using manual geocodes
  console.log('Step 2: Fixing encounters outside Vista bounds...\n')

  let fixedOutside = 0
  let skippedOutside = 0

  for (const enc of outsideBounds) {
    const manualCoords = MANUAL_GEOCODES[enc.outreach_location]
    if (manualCoords) {
      const { error } = await supabase
        .from('encounters')
        .update({
          latitude: manualCoords.latitude,
          longitude: manualCoords.longitude
        })
        .eq('id', enc.id)

      if (!error) {
        fixedOutside++
      }
    } else {
      skippedOutside++
      console.log(`  No manual coords for: ${enc.outreach_location}`)
    }
  }

  console.log(`\nFixed ${fixedOutside} encounters outside bounds`)
  console.log(`Skipped ${skippedOutside} (no manual coords)\n`)

  // Step 3: Fix zero-coord encounters using manual geocodes
  console.log('Step 3: Fixing encounters with zero coords...\n')

  let fixedZero = 0
  let skippedZero = 0

  for (const enc of zeroCoords) {
    const manualCoords = MANUAL_GEOCODES[enc.outreach_location]
    if (manualCoords) {
      const { error } = await supabase
        .from('encounters')
        .update({
          latitude: manualCoords.latitude,
          longitude: manualCoords.longitude
        })
        .eq('id', enc.id)

      if (!error) {
        fixedZero++
      }
    } else {
      skippedZero++
    }
  }

  console.log(`Fixed ${fixedZero} encounters with zero coords`)
  console.log(`Skipped ${skippedZero} (no manual coords)\n`)

  // Summary
  console.log('=== Summary ===')
  console.log(`Total fixed: ${fixedOutside + fixedZero}`)
  console.log(`Total still needing manual review: ${skippedOutside + skippedZero}`)

  // List remaining addresses needing manual geocoding
  const remainingAddresses = new Set()
  for (const enc of [...outsideBounds, ...zeroCoords]) {
    if (!MANUAL_GEOCODES[enc.outreach_location]) {
      remainingAddresses.add(enc.outreach_location)
    }
  }

  if (remainingAddresses.size > 0) {
    console.log('\n=== Addresses still needing geocoding ===')
    for (const addr of remainingAddresses) {
      console.log(`  - ${addr}`)
    }
  }
}

fixGeocoding().catch(console.error)
