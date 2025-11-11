'use client'

import { Brief } from '@/lib/schema/brief'
import { useTranslations, useLocale } from 'next-intl'

// Generate use-case specific action plan
function generateUseCaseActionPlan(data: Brief, t: any, locale: 'en' | 'de'): {
  discover: string[]
  pilot: string[]
  scale: string[]
  measure: string[]
} {
  const useCases = (data.use_cases || []).slice(0, 3) // Top 3 use cases
  const topUseCase = useCases[0]
  const strategicMoves = (data.strategic_moves || []).slice(0, 2)
  
  // Extract key themes from use cases
  const valueDrivers = useCases.map(uc => uc.value_driver).filter(Boolean)
  const topValueDriver = valueDrivers[0] || 'cost'
  
  // Value driver translations
  const valueDriverMap: Record<string, { en: string; de: string }> = {
    revenue: { en: 'revenue', de: 'Umsatz' },
    cost: { en: 'cost', de: 'Kosten' },
    risk: { en: 'risk', de: 'Risiko' },
    speed: { en: 'speed', de: 'Geschwindigkeit' },
    quality: { en: 'quality', de: 'Qualität' }
  }
  const valueDriverText = valueDriverMap[topValueDriver]?.[locale] || topValueDriver
  
  // Generate use-case specific actions
  const discover: string[] = locale === 'de' ? [
    `"${topUseCase?.title || 'Top-KI-Anwendungsfall'}" als schnellste ROI-Chance priorisieren`,
    'Eigentümer zuweisen und Erfolgs-KPIs für jeden Anwendungsfall definieren',
    'Datenverfügbarkeit und -qualität für priorisierte Anwendungsfälle bewerten'
  ] : [
    `Prioritize "${topUseCase?.title || 'top AI use case'}" as fastest ROI opportunity`,
    'Assign owner and define success KPIs for each use case',
    'Assess data availability and quality for priority use cases'
  ]
  
  const pilot: string[] = locale === 'de' ? [
    `Pilot für "${topUseCase?.title || 'Top-Anwendungsfall'}" innerhalb von 30 Tagen starten`,
    `Ziel: ${topUseCase?.payback_months || 12} Monate Amortisation beim ersten Pilot`,
    'Basismetriken und Erfolgsschwellenwerte festlegen'
  ] : [
    `Launch pilot for "${topUseCase?.title || 'top use case'}" within 30 days`,
    `Target ${topUseCase?.payback_months || 12}-month payback on first pilot`,
    'Establish baseline metrics and success thresholds'
  ]
  
  const scale: string[] = locale === 'de' ? [
    `"${topUseCase?.title || 'Top-Anwendungsfall'}" auf vollständige Bereitstellung skalieren`,
    `Verbleibende ${useCases.length > 1 ? useCases.length - 1 : 0} Anwendungsfälle nach Priorität ausrollen`,
    'MLOps-Infrastruktur für Produktionsbereitstellung aufbauen'
  ] : [
    `Scale "${topUseCase?.title || 'top use case'}" to full deployment`,
    `Roll out remaining ${useCases.length > 1 ? useCases.length - 1 : 0} use cases by priority`,
    'Build MLOps infrastructure for production deployment'
  ]
  
  const measure: string[] = locale === 'de' ? [
    `${valueDriverText}-Auswirkungen von "${topUseCase?.title || 'Top-Anwendungsfall'}" verfolgen`,
    'ROI im Vergleich zu prognostizierten Vorteilen überwachen',
    'Vierteljährlich basierend auf Ergebnissen überprüfen und anpassen'
  ] : [
    `Track ${topValueDriver} impact from "${topUseCase?.title || 'top use case'}"`,
    'Monitor ROI against projected benefits',
    'Review and adjust quarterly based on results'
  ]
  
  // Add strategic goals alignment if available
  if (strategicMoves.length > 0) {
    const firstMove = strategicMoves[0]
    discover.push(locale === 'de' 
      ? `Mit strategischem Ziel ausrichten: ${firstMove.move}`
      : `Align with strategic goal: ${firstMove.move}`)
    measure.push(locale === 'de'
      ? `Fortschritt messen in Richtung: ${firstMove.move}`
      : `Measure progress toward: ${firstMove.move}`)
  }
  
  return { discover, pilot, scale, measure }
}

export default function CEOActionPlan({ data }: { data: Brief }) {
  const t = useTranslations()
  const locale = useLocale() as 'en' | 'de'
  const insights = generateUseCaseActionPlan(data, t, locale)
  
  return (
    <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-lg">
      <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">{t('report.actionPlan.titleWithDays')}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{t('report.actionPlan.subtitle')}</p>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4 text-sm">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
          <div className="font-semibold text-gray-900 dark:text-white">{t('report.actionPlan.phases.discover')}</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-600 dark:text-gray-300 space-y-1">
            {insights.discover.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
          <div className="font-semibold text-gray-900 dark:text-white">{t('report.actionPlan.phases.pilot')}</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-600 dark:text-gray-300 space-y-1">
            {insights.pilot.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
          <div className="font-semibold text-gray-900 dark:text-white">{t('report.actionPlan.phases.scale')}</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-600 dark:text-gray-300 space-y-1">
            {insights.scale.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
          <div className="font-semibold text-gray-900 dark:text-white">{t('report.actionPlan.phases.measure')}</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-600 dark:text-gray-300 space-y-1">
            {insights.measure.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}


