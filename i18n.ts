import { getRequestConfig } from 'next-intl/server'
import { notFound } from 'next/navigation'

export const locales = ['en', 'de'] as const
export const defaultLocale = 'en' as const

export default getRequestConfig(async ({ requestLocale }) => {
  // This function will be called for every request
  // Use the locale from the request
  let locale = await requestLocale

  // Validate that the incoming `locale` parameter is valid
  if (!locale || !locales.includes(locale as any)) {
    locale = defaultLocale
  }

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default
  }
})

