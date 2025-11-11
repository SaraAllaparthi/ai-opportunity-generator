/**
 * Locale-aware formatting helpers
 */

export const fmtCurrency = (locale: string, amount: number, currency = 'CHF'): string => {
  const localeCode = locale === 'de' ? 'de-CH' : 'en-CH'
  return new Intl.NumberFormat(localeCode, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(amount)
}

export const fmtNumber = (locale: string, n: number): string => {
  const localeCode = locale === 'de' ? 'de-CH' : 'en-CH'
  return new Intl.NumberFormat(localeCode).format(n)
}

export const fmtDate = (locale: string, date: Date): string => {
  const localeCode = locale === 'de' ? 'de-CH' : 'en-CH'
  return new Intl.DateTimeFormat(localeCode, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date)
}

