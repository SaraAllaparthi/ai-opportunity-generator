import { useTranslations } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { getCurrentAppUser } from '@/lib/auth'
import StickyHeader from '@/components/StickyHeader'
import LoginForm from '@/components/LoginForm'

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale })
  
  const user = await getCurrentAppUser()

  // If already logged in, show a message
  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <StickyHeader />
        <main className="mx-auto max-w-4xl px-6 py-24">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              {t('login.alreadyLoggedIn')}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {t('login.loggedInAs', { email: user.email })}
            </p>
            <a
              href={`/${locale}`}
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('login.goToHome')}
            </a>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <StickyHeader />
      <main className="mx-auto max-w-4xl px-6 py-24">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-3">
            {t('login.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            {t('login.subtitle')}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
          <LoginForm />
        </div>
      </main>
    </div>
  )
}
