import { Brief } from '@/lib/schema/brief'
import { validateROI } from './roiValidation'

export function formatCurrencyCHF(n?: number): string {
  if (typeof n !== 'number' || isNaN(n)) return 'Estimate'
  return new Intl.NumberFormat('en-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(n)
}

export function computeUplift(useCases: Brief['use_cases']) {
  const benefits = useCases.map(u => u.est_annual_benefit).filter((v): v is number => typeof v === 'number' && !isNaN(v))
  const sum = benefits.reduce((a, b) => a + b, 0)
  return benefits.length ? sum : undefined
}

export function computeWeightedPayback(useCases: Brief['use_cases']) {
  const items = useCases.filter(u => typeof u.est_annual_benefit === 'number' && typeof u.payback_months === 'number')
  const num = items.reduce((acc, u) => acc + (u.est_annual_benefit as number) * (u.payback_months as number), 0)
  const den = items.reduce((acc, u) => acc + (u.est_annual_benefit as number), 0)
  if (!den) return undefined
  return Math.round(num / den)
}

function computeTotalInvestment(useCases: Brief['use_cases']) {
  const oneTime = useCases.map(u => u.est_one_time_cost).filter((v): v is number => typeof v === 'number' && !isNaN(v))
  const ongoing = useCases.map(u => u.est_ongoing_cost).filter((v): v is number => typeof v === 'number' && !isNaN(v))
  const totalOneTime = oneTime.reduce((a, b) => a + b, 0)
  const totalOngoing = ongoing.reduce((a, b) => a + b, 0)
  return totalOneTime + totalOngoing
}

function computeROIPercentage(useCases: Brief['use_cases']) {
  const uplift = computeUplift(useCases)
  const investment = computeTotalInvestment(useCases)
  if (typeof uplift === 'number' && investment > 0) {
    const rawRoi = ((uplift - investment) / investment) * 100
    return validateROI(rawRoi)
  }
  return undefined
}

function getTopValueDrivers(useCases: Brief['use_cases'], count: number = 2): string[] {
  const counts: Record<string, number> = {}
  for (const u of useCases) {
    counts[u.value_driver] = (counts[u.value_driver] || 0) + 1
  }
  return Object.entries(counts)
    .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
    .slice(0, count)
    .map(([driver]) => driver)
}

function getValueDriverDescription(driver: string): string {
  const descriptions: Record<string, string> = {
    revenue: 'revenue growth',
    cost: 'cost reduction',
    risk: 'risk mitigation',
    speed: 'process acceleration',
    quality: 'quality improvement'
  }
  return descriptions[driver] || driver
}

function getFastestPaybackUseCase(useCases: Brief['use_cases']) {
  return useCases
    .filter(u => typeof u.payback_months === 'number' && u.payback_months > 0)
    .sort((a: Brief['use_cases'][number], b: Brief['use_cases'][number]) => (a.payback_months || 999) - (b.payback_months || 999))[0]
}

export function generateExecutiveSummary(data: Brief, locale: 'en' | 'de' = 'en'): string {
  const uplift = computeUplift(data.use_cases)
  const weightedPayback = computeWeightedPayback(data.use_cases)
  const avgComplexity = data.use_cases.reduce((a, u) => a + u.complexity, 0) / data.use_cases.length
  const topValueDrivers = getTopValueDrivers(data.use_cases, 2)
  const fastestUseCase = getFastestPaybackUseCase(data.use_cases)
  const roi = computeROIPercentage(data.use_cases)
  const investment = computeTotalInvestment(data.use_cases)
  
  // Build summary based on available data
  const sentences: string[] = []
  
  // Helper function to get value driver descriptions in the correct language
  const getValueDriverDescriptionLocalized = (driver: string): string => {
    if (locale === 'de') {
      const descriptions: Record<string, string> = {
        revenue: 'Umsatzwachstum',
        cost: 'Kostenreduzierung',
        risk: 'Risikominderung',
        speed: 'Prozessbeschleunigung',
        quality: 'Qualitätsverbesserung'
      }
      return descriptions[driver] || driver
    }
    return getValueDriverDescription(driver)
  }

  // First sentence: Quantified value proposition with timeframe
  if (typeof uplift === 'number' && uplift > 0) {
    const timeHorizon = locale === 'de'
      ? (typeof weightedPayback === 'number' && weightedPayback <= 12 
          ? 'innerhalb von 12 Monaten' 
          : typeof weightedPayback === 'number' && weightedPayback <= 24
          ? 'innerhalb von 24 Monaten'
          : 'in den nächsten 12-24 Monaten')
      : (typeof weightedPayback === 'number' && weightedPayback <= 12 
          ? 'within 12 months' 
          : typeof weightedPayback === 'number' && weightedPayback <= 24
          ? 'within 24 months'
          : 'over the next 12-24 months')
    
    const valueDrivers = topValueDrivers.length > 0
      ? topValueDrivers.map(d => getValueDriverDescriptionLocalized(d)).join(locale === 'de' ? ' und ' : ' and ')
      : locale === 'de' ? 'betriebliche Effizienz' : 'operational efficiency'
    
    if (locale === 'de') {
      sentences.push(
        `KI kann ${formatCurrencyCHF(uplift)} jährlichen Mehrwert ${timeHorizon} freisetzen, hauptsächlich durch ${valueDrivers}.`
      )
    } else {
      sentences.push(
        `AI can unlock ${formatCurrencyCHF(uplift)} annual value ${timeHorizon}, primarily through ${valueDrivers}.`
      )
    }
  } else {
    if (locale === 'de') {
      sentences.push(
        `KI-Initiativen können messbare ROI durch schnellere Prozesseffizienz und Kostenreduzierung generieren.`
      )
    } else {
      sentences.push(
        `AI initiatives can generate measurable ROI through faster process efficiency and cost reduction.`
      )
    }
  }
  
  // Second sentence: Strategic focus with fastest payback or ROI context
  if (fastestUseCase && typeof fastestUseCase.payback_months === 'number' && fastestUseCase.payback_months <= 12) {
    const focusAreas = topValueDrivers.length > 0
      ? topValueDrivers.map(d => getValueDriverDescriptionLocalized(d)).join(locale === 'de' ? ' und ' : ' and ')
      : locale === 'de' ? 'strategische Initiativen' : 'strategic initiatives'
    
    if (locale === 'de') {
      sentences.push(
        `Fokussieren Sie sich auf ${focusAreas}, um messbare Wirkung zu erzielen, wobei die Initiative mit der schnellsten Amortisation Ergebnisse in ${fastestUseCase.payback_months} Monaten liefert.`
      )
    } else {
      sentences.push(
        `Focus on ${focusAreas} to achieve measurable impact, with the fastest-payback initiative delivering results in ${fastestUseCase.payback_months} months.`
      )
    }
  } else if (typeof roi === 'number' && roi > 50 && investment > 0) {
    const focusAreas = topValueDrivers.length > 0
      ? topValueDrivers.map(d => getValueDriverDescriptionLocalized(d)).join(locale === 'de' ? ' und ' : ' and ')
      : locale === 'de' ? 'strategische Initiativen' : 'strategic initiatives'
    
    if (locale === 'de') {
      sentences.push(
        `Fokussieren Sie sich auf ${focusAreas}, um Margenverbesserungen zu erzielen, mit einem geschätzten ROI von ${roi}% auf ${formatCurrencyCHF(investment)} Gesamtinvestition.`
      )
    } else {
      sentences.push(
        `Focus on ${focusAreas} to achieve margin improvements, with an estimated ${roi}% ROI on ${formatCurrencyCHF(investment)} total investment.`
      )
    }
  } else if (topValueDrivers.length > 0) {
    const focusAreas = topValueDrivers.map(d => getValueDriverDescriptionLocalized(d)).join(locale === 'de' ? ' und ' : ' and ')
    const complexityNote = locale === 'de'
      ? (avgComplexity <= 2.5 
          ? 'mit moderater Komplexität'
          : avgComplexity <= 3.5
          ? 'mit überschaubarer Komplexität'
          : 'erfordert fokussierte Umsetzung')
      : (avgComplexity <= 2.5 
          ? 'with moderate complexity'
          : avgComplexity <= 3.5
          ? 'with manageable complexity'
          : 'requiring focused implementation')
    
    if (locale === 'de') {
      sentences.push(
        `Fokussieren Sie sich auf ${focusAreas}, um messbare Wirkung ${complexityNote} zu erzielen.`
      )
    } else {
      sentences.push(
        `Focus on ${focusAreas} to achieve measurable impact ${complexityNote}.`
      )
    }
  } else if (typeof weightedPayback === 'number' && weightedPayback <= 18) {
    if (locale === 'de') {
      sentences.push(
        `Priorisieren Sie Initiativen mit gewichteter Amortisation von ${weightedPayback} Monaten, um Wertrealisierung zu beschleunigen und Wirkung zu verstärken.`
      )
    } else {
      sentences.push(
        `Prioritize initiatives with weighted payback of ${weightedPayback} months to accelerate value realization and compound impact.`
      )
    }
  } else {
    if (locale === 'de') {
      sentences.push(
        `Priorisieren Sie Initiativen mit der schnellsten Amortisation, um Wertrealisierung zu beschleunigen und Wirkung zu verstärken.`
      )
    } else {
      sentences.push(
        `Prioritize initiatives with the fastest payback to accelerate value realization and compound impact.`
      )
    }
  }
  
  // Third sentence: ROI or strategic context (only if we have strong data and haven't used it yet)
  if (sentences.length < 3) {
    if (typeof roi === 'number' && roi > 0 && typeof uplift === 'number' && uplift > 0 && investment > 0) {
      if (!sentences.some(s => s.includes('ROI') || s.includes('ROI'))) {
        if (locale === 'de') {
          sentences.push(
            `Mit einem geschätzten ROI von ${roi}% auf ${formatCurrencyCHF(investment)} Gesamtinvestition bieten diese Initiativen überzeugende Renditen bei überschaubarem Risiko.`
          )
        } else {
          sentences.push(
            `With an estimated ${roi}% ROI on ${formatCurrencyCHF(investment)} total investment, these initiatives offer compelling returns with manageable risk.`
          )
        }
      }
    } else if (typeof weightedPayback === 'number' && weightedPayback <= 18 && !sentences.some(s => s.includes('payback') || s.includes('Amortisation'))) {
      if (locale === 'de') {
        sentences.push(
          `Eine gewichtete Amortisation von ${weightedPayback} Monaten positioniert diese Initiativen als hochprioritäre Investitionen mit klarer Wertlieferung.`
        )
      } else {
        sentences.push(
          `Weighted payback of ${weightedPayback} months positions these initiatives as high-priority investments with clear value delivery.`
        )
      }
    }
  }
  
  // Fallback if we don't have enough data
  if (sentences.length === 0) {
    if (locale === 'de') {
      sentences.push(
        `KI-Initiativen können messbare ROI durch schnellere Prozesseffizienz und Kostenreduzierung generieren.`
      )
      sentences.push(
        `Priorisieren Sie Initiativen mit der schnellsten Amortisation, um Wertrealisierung zu beschleunigen.`
      )
    } else {
      sentences.push(
        `AI initiatives can generate measurable ROI through faster process efficiency and cost reduction.`
      )
      sentences.push(
        `Prioritize initiatives with the fastest payback to accelerate value realization.`
      )
    }
  }
  
  // Return 2-3 sentences maximum, ensuring natural flow
  return sentences.slice(0, 3).join(' ')
}

