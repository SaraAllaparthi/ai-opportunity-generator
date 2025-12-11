import { getTranslations } from 'next-intl/server'
import { getCurrentAppUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import StickyHeader from '@/components/StickyHeader'
import ChangePasswordForm from '@/components/ChangePasswordForm'

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale })
  
  const user = await getCurrentAppUser()

  // Redirect to login if not authenticated
  if (!user) {
    redirect(`/${locale}/login`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <StickyHeader user={user} />
      <main className="mx-auto max-w-4xl px-6 py-24">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-3">
            {t('settings.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            {t('settings.subtitle')}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {t('settings.changePasswordTitle')}
          </h2>
          <ChangePasswordForm />
        </div>
      </main>
    </div>
  )
}
