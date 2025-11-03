"use client"
import { Brief } from '@/lib/schema/brief'
import { useMemo, useState } from 'react'

// Match the same colors used in IndustryCard
const TREND_COLORS = [
  '#14b8a6', // teal-500
  '#3b82f6', // blue-500
  '#8b5cf6', // purple-500
  '#ec4899', // pink-500
  '#f59e0b', // amber-500
]

// Extract actionable part - same logic as IndustryCard
function extractTrendName(trend: string): string {
  // Look for common patterns: AI/ML/technology name followed by action verb
  const words = trend.split(' ')
  
  // Find where the actionable phrase ends (usually before a verb like "reduces", "improves", etc.)
  const actionVerbs = ['reduces', 'improves', 'increases', 'enhances', 'optimizes', 'enables', 'helps', 'allows', 'uses', 'provides']
  let actionableEnd = -1
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase().replace(/[.,]/g, '')
    if (actionVerbs.includes(word)) {
      actionableEnd = i
      break
    }
  }
  
  // If we found an action verb, everything before it is the actionable part
  if (actionableEnd > 0) {
    return words.slice(0, actionableEnd).join(' ')
  }
  
  // Fallback: If no clear action verb, try splitting by separators
  const separators = /[.—]|—/
  if (separators.test(trend)) {
    return trend.split(separators)[0].trim()
  }
  
  // Last resort: first 3-4 words
  if (words.length <= 4) return trend
  const mainWords = Math.min(4, Math.floor(words.length * 0.4))
  return words.slice(0, mainWords).join(' ')
}

// Simple hash function for deterministic values
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

// Get deterministic offset (0-1) from string
function getDeterministicOffset(str: string, seed: number = 0): number {
  const hash = hashString(str + seed.toString())
  return (hash % 1000) / 1000 // 0-1 range
}

// Heuristic to estimate Business Readiness from trend text (AI-focused) - deterministic
function estimateReadiness(trend: string): number {
  const text = trend.toLowerCase()
  const offset = getDeterministicOffset(trend, 1)
  
  // High readiness indicators - AI/ML tech that's ready now
  if (text.includes('predictive maintenance') || text.includes('ai-driven') || text.includes('smart factor') || text.includes('already') || text.includes('now deploy')) {
    return 0.75 + offset * 0.15 // 75-90% - green (ready now)
  }
  if (text.includes('ai forecast') || text.includes('ml optimiz') || text.includes('automation') || text.includes('improv') || text.includes('reduc')) {
    return 0.55 + offset * 0.15 // 55-70% - blue (emerging)
  }
  // Medium readiness - emerging tech
  if (text.includes('sustainability analytic') || text.includes('data-driven') || text.includes('intelligent') || text.includes('expect')) {
    return 0.35 + offset * 0.15 // 35-50% - blue-purple (emerging)
  }
  // Lower readiness - future-ready
  return 0.2 + offset * 0.15 // 20-35% - purple (future-ready)
}

// Heuristic to estimate Potential Impact from trend text (AI-focused) - deterministic
function estimateImpact(trend: string): number {
  const text = trend.toLowerCase()
  const offset = getDeterministicOffset(trend, 2)
  
  // High impact indicators - quantifiable business outcomes
  if (text.includes('reduc') || text.includes('improves') || text.includes('increases') || text.includes('by 20%') || text.includes('by 30%') || text.includes('by 25%')) {
    return 0.75 + offset * 0.15 // 75-90%
  }
  if (text.includes('downtime') || text.includes('efficiency') || text.includes('accuracy') || text.includes('compliance') || text.includes('quality')) {
    return 0.6 + offset * 0.15 // 60-75%
  }
  // Medium impact
  if (text.includes('optimiz') || text.includes('forecast') || text.includes('schedul') || text.includes('analytics')) {
    return 0.4 + offset * 0.2 // 40-60%
  }
  // Lower impact
  return 0.3 + offset * 0.15 // 30-45%
}

// Extract concise AI opportunity statement from trend
function extractAIOpportunity(trend: string): string {
  const lowerTrend = trend.toLowerCase()
  
  // Extract key metric if present (e.g., "reduces downtime by 20%")
  const metricMatch = trend.match(/(reduc|improves|increases|cuts)\s+.+\s+by\s+(\d+)%/i)
  if (metricMatch) {
    const verb = metricMatch[1].toLowerCase()
    const percent = metricMatch[2]
    if (verb.includes('reduc') || verb.includes('cut')) {
      return `Reduces ${metricMatch[0].split('by')[0].replace(verb, '').trim()} by ${percent}%`
    } else {
      return `Improves ${metricMatch[0].split('by')[0].replace(verb, '').trim()} by ${percent}%`
    }
  }
  
  // Look for specific AI benefits - keep concise
  if (lowerTrend.includes('predictive maintenance')) {
    return 'Reduces downtime by 20-30%'
  }
  if (lowerTrend.includes('smart factor')) {
    return 'Reduces waste by 15-25%'
  }
  if (lowerTrend.includes('forecast')) {
    return 'Improves accuracy by 30-40%'
  }
  if (lowerTrend.includes('sustainability')) {
    return 'Accelerates compliance, reduces costs'
  }
  if (lowerTrend.includes('automation')) {
    return 'Reduces manual oversight, improves quality'
  }
  if (lowerTrend.includes('optimiz')) {
    return 'Optimizes operations and efficiency'
  }
  
  // Extract core benefit (first 8-10 words max)
  const words = trend.split(' ')
  if (words.length <= 10) return trend
  // Take first part that contains key outcome
  return words.slice(0, 8).join(' ') + '...'
}

// Get action item based on readiness and impact
function getActionItem(readiness: number, impact: number): string {
  if (readiness >= 0.7 && impact >= 0.6) {
    return 'Act now — High priority opportunity'
  }
  if (readiness >= 0.7 && impact < 0.6) {
    return 'Quick win — Low effort, good return'
  }
  if (readiness < 0.7 && impact >= 0.6) {
    return 'Plan pilot — High value, needs preparation'
  }
  if (readiness >= 0.5 && impact >= 0.5) {
    return 'Explore options — Medium priority'
  }
  return 'Monitor — Lower priority for now'
}

// Get color based on readiness level (green = ready now, blue = emerging, purple = future-ready)
function getReadinessColor(readiness: number, index: number): string {
  if (readiness >= 0.7) {
    // Green = ready now (high readiness)
    return '#16a34a' // green-600
  } else if (readiness >= 0.5) {
    // Blue = emerging (medium-high readiness)
    return '#3b82f6' // blue-500
  } else if (readiness >= 0.3) {
    // Blue-purple = emerging (medium readiness)
    return '#6366f1' // indigo-500
  } else {
    // Purple = future-ready (lower readiness)
    return '#8b5cf6' // purple-500
  }
}

interface TrendPoint {
  trend: string
  trendName: string
  readiness: number
  impact: number
  action: string
  aiOpportunity: string
  x: number // 0-100 for positioning
  y: number // 0-100 for positioning
}

export default function TrendImpactGrid({ data }: { data: Brief }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  
  const trends = useMemo(() => {
    const rawTrends = (data.industry.trends || []).slice(0, 5)
    
    const points: TrendPoint[] = rawTrends.map((trend, index) => {
      const readiness = estimateReadiness(trend)
      const impact = estimateImpact(trend)
      const trendName = extractTrendName(trend)
      const action = getActionItem(readiness, impact)
      const aiOpportunity = extractAIOpportunity(trend)
      
      return {
        trend,
        trendName,
        readiness,
        impact,
        action,
        aiOpportunity,
        x: readiness * 100, // Convert to percentage for positioning
        y: 100 - (impact * 100) // Invert Y so high impact is at top
      }
    })
    
    // Ensure points don't overlap too much by adjusting positions (deterministic)
    const adjustedPoints: TrendPoint[] = []
    points.forEach((point, index) => {
      let adjustedPoint = { ...point }
      // Add small deterministic offset based on trend text to prevent exact overlaps
      const xOffset = getDeterministicOffset(point.trend, 3) * 8 - 4 // -4 to +4
      const yOffset = getDeterministicOffset(point.trend, 4) * 8 - 4 // -4 to +4
      adjustedPoint.x += xOffset
      adjustedPoint.y += yOffset
      // Clamp to grid bounds (with padding for labels)
      adjustedPoint.x = Math.max(12, Math.min(88, adjustedPoint.x))
      adjustedPoint.y = Math.max(12, Math.min(85, adjustedPoint.y))
      adjustedPoints.push(adjustedPoint)
    })
    
    return adjustedPoints
  }, [data.industry.trends])

  return (
    <div className="w-full">
      <div className="relative w-full h-96 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
        {/* Grid lines - center lines dividing into 4 quadrants */}
        <svg className="absolute inset-0 w-full h-full" style={{ padding: '48px' }}>
          {/* Center vertical line (divides left/right) */}
          <line x1="50%" y1="0%" x2="50%" y2="100%" stroke="currentColor" strokeWidth="1" opacity="0.15" className="text-gray-400 dark:text-gray-600" />
          {/* Center horizontal line (divides top/bottom) */}
          <line x1="0%" y1="50%" x2="100%" y2="50%" stroke="currentColor" strokeWidth="1" opacity="0.15" className="text-gray-400 dark:text-gray-600" />
        </svg>

        {/* Trend bubbles with labels */}
        <div className="relative w-full h-full" style={{ padding: '48px' }}>
          {trends.map((point, index) => {
            const color = getReadinessColor(point.readiness, index)
            const isHovered = hoveredIndex === index
            
            // Convert hex to RGB for glow effects
            const hexToRgb = (hex: string) => {
              const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
              return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
              } : { r: 59, g: 130, b: 246 }
            }
            const rgb = hexToRgb(color)
            const rgba = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7)`
            
            // Position label to the right of the dot, or left if too far right
            const labelPosition = point.x > 70 ? 'left' : 'right'
            
            return (
              <div
                key={index}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200 z-10 group"
                style={{
                  left: `${point.x}%`,
                  top: `${point.y}%`,
                }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Glowing bubble - color coded by readiness */}
                <div
                  className="relative"
                  style={{
                    filter: isHovered 
                      ? `drop-shadow(0 0 16px ${color}) drop-shadow(0 0 8px ${color}80)`
                      : `drop-shadow(0 0 12px ${rgba}) drop-shadow(0 0 6px ${color}60)`,
                    transform: isHovered ? 'scale(1.4)' : 'scale(1)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div
                    className="w-5 h-5 rounded-full"
                    style={{
                      background: `radial-gradient(circle at 30% 30%, ${color} 0%, ${color}dd 50%, ${color}aa 100%)`,
                      boxShadow: `0 0 20px ${rgba}, inset 0 0 10px rgba(255, 255, 255, 0.4)`,
                    }}
                  />
                </div>
                
                {/* Hover tooltip - only shown on hover with AI opportunity */}
                {isHovered && (
                  <div
                    className={`absolute ${labelPosition === 'right' ? 'left-full ml-3' : 'right-full mr-3'} top-1/2 -translate-y-1/2 z-20 pointer-events-none`}
                    style={{ maxWidth: '220px' }}
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-white bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl"
                      style={{
                        borderColor: `${color}60`,
                        boxShadow: `0 4px 12px ${rgba}`,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className="flex-shrink-0 w-2.5 h-2.5 rounded-full"
                          style={{ 
                            backgroundColor: color,
                            boxShadow: `0 0 6px ${color}80`,
                          }}
                        />
                        <span className="font-semibold text-sm">{point.trendName}</span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1 leading-relaxed space-y-0.5">
                        <div>Readiness: {Math.round(point.readiness * 100)}%</div>
                        <div>Impact: {Math.round(point.impact * 100)}%</div>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-200 dark:border-gray-700">
                        {point.action}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* X-axis labels */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 text-sm text-gray-600 dark:text-gray-400 font-medium">
          Business Readiness
        </div>
        <div className="absolute bottom-4 left-12 text-xs text-gray-500 dark:text-gray-500">
          Low
        </div>
        <div className="absolute bottom-4 right-12 text-xs text-gray-500 dark:text-gray-500">
          High
        </div>
        
        {/* Y-axis labels */}
        <div className="absolute left-6 top-1/2 transform -translate-y-1/2 -rotate-90 text-sm text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap origin-center">
          Potential Impact
        </div>
        <div className="absolute left-4 top-12 text-xs text-gray-500 dark:text-gray-500">
          High
        </div>
      </div>
    </div>
  )
}
