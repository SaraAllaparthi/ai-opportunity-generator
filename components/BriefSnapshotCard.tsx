import { Brief } from '@/lib/schema/brief'
import { confidenceFromCount, getConfidenceColor } from '@/lib/utils/citations'

export default function SnapshotCard({ data }: { data: Brief }) {
  const company = data.company
  const confidence = confidenceFromCount((data.citations||[]).length)
  // Format company size - show full number without truncation, handle commas
  const formattedSize = company.size ? (() => {
    const sizeStr = company.size.trim()
    
    // Remove commas for parsing, then add them back for display if needed
    const cleaned = sizeStr.replace(/,/g, '')
    
    // Extract range (e.g., "1000-5000 employees")
    const rangeMatch = cleaned.match(/([1-9]\d*)\s*-\s*([1-9]\d*)\s*(?:employees?|Mitarbeiter|staff|workforce|headcount|people)?/i)
    if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
      const num1 = parseInt(rangeMatch[1], 10)
      const num2 = parseInt(rangeMatch[2], 10)
      // Validate numbers are not zero and num2 > num1
      if (num1 > 0 && num2 > 0 && num2 >= num1 && !isNaN(num1) && !isNaN(num2)) {
        const formatted1 = num1 >= 1000 ? num1.toLocaleString() : num1.toString()
        const formatted2 = num2 >= 1000 ? num2.toLocaleString() : num2.toString()
        return `${formatted1}-${formatted2} employees`
      }
    }
    
    // Extract single number (e.g., "100000 employees")
    const singleMatch = cleaned.match(/([1-9]\d*)\s*(?:employees?|Mitarbeiter|staff|workforce|headcount|people)?/i)
    if (singleMatch && singleMatch[1]) {
      const num = parseInt(singleMatch[1], 10)
      // Validate number is not zero
      if (num > 0 && !isNaN(num)) {
        const formatted = num >= 1000 ? num.toLocaleString() : num.toString()
        return `${formatted} employees`
      }
    }
    
    // If we can't parse it or it's invalid, return null to hide it
    console.warn('[BriefSnapshotCard] Invalid size value:', sizeStr)
    return null
  })() : null

  const hasFacts = formattedSize || company.industry || company.headquarters || company.founded || company.ceo || company.market_position
  
  // Extract year from founded field (e.g., "Founded in 1975" -> "1975")
  const foundedYear = company.founded ? (() => {
    const yearMatch = company.founded.match(/\b(19|20)\d{2}\b/)
    return yearMatch ? yearMatch[0] : company.founded
  })() : null
  
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-lg">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="font-semibold text-gray-900 dark:text-white mb-1 text-lg">{company.name}</div>
          <a className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors text-sm" href={company.website} target="_blank" rel="noreferrer">{company.website}</a>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getConfidenceColor(confidence)}`}>Confidence {confidence}</span>
      </div>

      {hasFacts && (
        <div className="mb-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          {formattedSize && (
            <div>
              <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-0.5">Size</div>
              <div className="text-gray-900 dark:text-white font-medium">{formattedSize}</div>
            </div>
          )}
          {company.industry && (
            <div>
              <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-0.5">Industry</div>
              <div className="text-gray-900 dark:text-white font-medium">{company.industry}</div>
            </div>
          )}
          {company.headquarters && (
            <div>
              <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-0.5">Headquarters</div>
              <div className="text-gray-900 dark:text-white font-medium">{company.headquarters}</div>
            </div>
          )}
          {foundedYear && (
            <div>
              <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-0.5">Founded in</div>
              <div className="text-gray-900 dark:text-white font-medium">{foundedYear}</div>
            </div>
          )}
          {company.ceo && (
            <div>
              <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-0.5">CEO</div>
              <div className="text-gray-900 dark:text-white font-medium">{company.ceo}</div>
            </div>
          )}
          {company.market_position && (
            <div>
              <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-0.5">Market Position</div>
              <div className="text-gray-900 dark:text-white font-medium">{company.market_position}</div>
            </div>
          )}
        </div>
      )}

      <div className="mb-4">
        {company.summary ? (
          <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-300 space-y-1.5">
            {company.summary
              .split(/[.!?]\s+/)
              .filter(sentence => sentence.trim().length > 0)
              .map((sentence, index) => (
                <li key={index} className="leading-relaxed">{sentence.trim()}</li>
              ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">Company summary based on verified research data.</p>
        )}
      </div>
    </div>
  )
}


