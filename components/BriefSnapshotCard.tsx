import { Brief } from '@/lib/schema/brief'
import { confidenceFromCount, getConfidenceColor } from '@/lib/utils/citations'

export default function SnapshotCard({ data }: { data: Brief }) {
  const company = data.company
  const confidence = confidenceFromCount((data.citations||[]).length)
  // Format company size (remove "employees" and format nicely)
  const formattedSize = company.size ? (() => {
    const sizeStr = company.size.trim()
    
    // Remove "employees" or "employee" (case insensitive)
    let cleaned = sizeStr.replace(/\s*employees?\s*/gi, ' ').trim()
    
    // Extract number or range pattern (handles "150", "150-200", "150 - 200")
    const rangeMatch = cleaned.match(/(\d+)\s*-\s*(\d+)/)
    if (rangeMatch) {
      return `${rangeMatch[1]}-${rangeMatch[2]}`
    }
    
    // Extract single number
    const singleMatch = cleaned.match(/(\d+)/)
    if (singleMatch) {
      return singleMatch[1]
    }
    
    // If no numbers found but still has text, try to clean it further
    // Remove common prefixes like "about", "approximately", "~", etc.
    cleaned = cleaned.replace(/^(about|approximately|around|~|~|circa)\s+/i, '').trim()
    
    // Return cleaned version or original if nothing to clean
    return cleaned || sizeStr
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


