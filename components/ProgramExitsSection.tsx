'use client'

import { useState } from 'react'
import { EXIT_DESTINATIONS } from '@/lib/schemas/exit-schema'

interface Person {
  id: string
  first_name: string
  last_name: string
  exit_date?: string | null
  exit_destination?: string | null
  exit_notes?: string | null
}

interface ProgramExitsSectionProps {
  persons: Person[]
}

export default function ProgramExitsSection({
  persons,
}: ProgramExitsSectionProps) {
  const [showExits, setShowExits] = useState(true)

  // Filter to persons with exits and calculate exit stats
  const exitedPersons = persons.filter(p => p.exit_date)
  const totalExits = exitedPersons.length

  // Calculate exits by destination
  const exitsByDestination = exitedPersons.reduce((acc, p) => {
    const dest = p.exit_destination || 'Unknown'
    acc[dest] = (acc[dest] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Group destinations by category
  const exitsByCategory = Object.entries(EXIT_DESTINATIONS).reduce((acc, [category, destinations]) => {
    const categoryExits = destinations.reduce((sum, destination) => {
      return sum + (exitsByDestination[destination] || 0)
    }, 0)

    if (categoryExits > 0) {
      acc[category] = {
        total: categoryExits,
        destinations: destinations
          .map(dest => ({
            name: dest,
            count: exitsByDestination[dest] || 0
          }))
          .filter(item => item.count > 0)
      }
    }

    return acc
  }, {} as Record<string, { total: number, destinations: Array<{ name: string, count: number }> }>)

  // Add unknown/other exits not in categories
  const categorizedDestinations: string[] = Object.values(EXIT_DESTINATIONS).flat()
  const uncategorizedExits = Object.entries(exitsByDestination)
    .filter(([dest]) => !categorizedDestinations.includes(dest))
    .reduce((sum, [, count]) => sum + count, 0)

  if (uncategorizedExits > 0) {
    const uncategorizedDests = Object.entries(exitsByDestination)
      .filter(([dest]) => !categorizedDestinations.includes(dest))
      .map(([name, count]) => ({ name, count }))

    exitsByCategory['Other'] = {
      total: uncategorizedExits,
      destinations: uncategorizedDests
    }
  }

  const categoryColors: Record<string, { bg: string, text: string, border: string }> = {
    'Permanent Housing': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    'Temporary Housing': { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
    'Institutional Settings': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    'Homeless Situations': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    'Other': { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Program Exits</h3>
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={showExits}
            onChange={(e) => setShowExits(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="ml-2 text-sm text-gray-700">Show Exit Details</span>
        </label>
      </div>

      {/* Total Exits Summary */}
      <div className="text-center p-6 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-lg mb-6 border-2 border-teal-200">
        <p className="text-4xl font-bold text-teal-600">{totalExits}</p>
        <p className="text-sm text-gray-600 mt-2">Total Program Exits</p>
      </div>

      {/* Exit Details - Collapsible */}
      {showExits && totalExits > 0 && (
        <div className="space-y-4">
          <h4 className="text-md font-semibold text-gray-700 mb-3">Exit Destinations by Category</h4>

          {Object.entries(exitsByCategory).map(([category, data]) => {
            const colors = categoryColors[category] || categoryColors['Other']

            return (
              <div key={category} className={`${colors.bg} border ${colors.border} rounded-lg p-4`}>
                <div className="flex justify-between items-center mb-3">
                  <h5 className={`font-semibold ${colors.text}`}>{category}</h5>
                  <span className={`${colors.text} font-bold text-lg`}>{data.total}</span>
                </div>
                <div className="space-y-2 pl-4">
                  {data.destinations.map((dest) => (
                    <div key={dest.name} className="flex justify-between items-center text-sm">
                      <span className="text-gray-700">{dest.name}</span>
                      <span className="font-medium text-gray-900">{dest.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showExits && totalExits === 0 && (
        <p className="text-center text-gray-500 italic py-4">No program exits recorded yet</p>
      )}
    </div>
  )
}
