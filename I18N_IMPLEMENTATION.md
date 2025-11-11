# i18n Implementation Status

## ✅ Completed

1. **Installed next-intl** - Package installed and configured
2. **Created middleware.ts** - Locale detection with cookie fallback, redirects root to /en or /de
3. **Created message bundles** - `messages/en.json` and `messages/de.json` with comprehensive translations
4. **Created [locale] structure** - `app/[locale]/layout.tsx` with NextIntlClientProvider
5. **Created formatting helpers** - `lib/utils/i18n.ts` with `fmtCurrency`, `fmtNumber`, `fmtDate`
6. **Created LocaleSwitcher component** - Toggle between EN/DE with cookie persistence
7. **Updated StickyHeader** - Now uses translations and includes locale switcher
8. **Updated homepage header** - Uses translations for navigation
9. **Updated next.config.js** - Added next-intl plugin

## 🔄 In Progress / Remaining

### Pages to Update
- [ ] `app/[locale]/(marketing)/page.tsx` - Hero section, form labels, features section
- [ ] `app/[locale]/share/[slug]/page.tsx` - All section headings and subtitles
- [ ] `app/[locale]/(dashboard)/dashboard/page.tsx` - Dashboard strings

### Components to Update
- [ ] `components/BriefExecutiveSummary.tsx` - Use translations for labels
- [ ] `components/BriefSnapshotCard.tsx` - All labels
- [ ] `components/BriefIndustryCard.tsx` - Section titles
- [ ] `components/BriefMovesCard.tsx` - Labels
- [ ] `components/BriefCompetitorsCard.tsx` - Labels
- [ ] `components/BriefUseCasesCard.tsx` - Table headers, labels
- [ ] `components/CEOActionPlan.tsx` - Phase labels
- [ ] `components/FeasibilityScan.tsx` - Already partially done, verify all strings
- [ ] `components/CompetitorComparison.tsx` - Labels, executive summary
- [ ] `components/RoiDonut.tsx` - Tooltip formatting
- [ ] `components/BenefitInvestmentBar.tsx` - Labels
- [ ] `components/TrendImpactGrid.tsx` - Labels
- [ ] `components/SidebarNav.tsx` - Navigation labels

### LLM Prompts to Update
- [ ] `lib/research/pipeline.ts` - Add locale parameter to research functions
- [ ] `lib/providers/perplexity.ts` - Add language instructions to prompts
- [ ] `lib/providers/llm.ts` - Already supports locale via parameters
- [ ] `app/api/research/route.ts` - Accept locale parameter and pass to research functions

### Formatting Updates
- [ ] Update all currency displays to use `fmtCurrency(locale, amount)`
- [ ] Update all number displays to use `fmtNumber(locale, n)`
- [ ] Update chart tooltips to use locale-aware formatting
- [ ] Update date displays (if any) to use `fmtDate(locale, date)`

### SEO
- [ ] Add alternate hreflang links in `app/[locale]/layout.tsx`
- [ ] Update metadata to be locale-aware

## Usage Examples

### In Components (Client)
```tsx
'use client'
import { useTranslations, useLocale } from 'next-intl'
import { fmtCurrency } from '@/lib/utils/i18n'

export default function MyComponent() {
  const t = useTranslations()
  const locale = useLocale()
  
  return (
    <div>
      <h1>{t('section.execSummary')}</h1>
      <p>{fmtCurrency(locale, 100000)}</p>
    </div>
  )
}
```

### In Server Components
```tsx
import { getTranslations } from 'next-intl/server'
import { fmtCurrency } from '@/lib/utils/i18n'

export default async function MyPage({ params }: { params: { locale: string } }) {
  const t = await getTranslations()
  const { locale } = await params
  
  return (
    <div>
      <h1>{t('section.execSummary')}</h1>
      <p>{fmtCurrency(locale, 100000)}</p>
    </div>
  )
}
```

### LLM Prompts with Locale
```tsx
const locale = 'de' // or 'en'
const systemPrompt = locale === 'de'
  ? 'Schreibe auf Deutsch in einem prägnanten, managementtauglichen Stil (1–2 Sätze pro Insight).'
  : 'Write in English with concise, executive tone (1–2 sentences per insight).'

// Add formatting context
const context = {
  locale,
  numberFormat: locale === 'de' ? 'de-CH' : 'en-CH',
  currency: 'CHF'
}
```

## Next Steps

1. Update all remaining components to use `useTranslations()` or `getTranslations()`
2. Replace hardcoded strings with translation keys
3. Update all currency/number formatting to use helpers
4. Add locale parameter to API routes and pass to LLM functions
5. Test both /en and /de routes thoroughly
6. Add hreflang tags for SEO

