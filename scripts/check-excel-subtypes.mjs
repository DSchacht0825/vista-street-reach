import XLSX from 'xlsx'

const workbook = XLSX.readFile('public/logreport-2.xls')
const sheet = workbook.Sheets[workbook.SheetNames[0]]
const data = XLSX.utils.sheet_to_json(sheet)

// Filter to Nov 2025
const novLogs = data.filter(row => {
  if (!row.Date) return false
  const dateStr = row.Date.split(' ')[0]
  const parts = dateStr.split('/')
  if (parts.length < 3) return false
  const [month, day, year] = parts
  const fullYear = year.length === 2 ? '20' + year : year
  return fullYear === '2025' && month === '11'
})

console.log('Total Nov 2025 log entries in Excel:', novLogs.length)

// Count by Sub Type
const subtypeCounts = {}
novLogs.forEach(row => {
  const subType = row['Sub Type'] || 'Unknown'
  subtypeCounts[subType] = (subtypeCounts[subType] || 0) + 1
})

console.log('\nSub Type counts from original Excel:')
Object.entries(subtypeCounts)
  .sort(([a], [b]) => a.localeCompare(b))
  .forEach(([type, count]) => {
    console.log(type + ':', count)
  })

// Count people entries (some rows have multiple people)
let totalPeopleEntries = 0
novLogs.forEach(row => {
  if (row.People) {
    const people = row.People.split(/[,|]/).filter(p => p.trim())
    totalPeopleEntries += people.length
  }
})
console.log('\nTotal people entries (expanded):', totalPeopleEntries)
