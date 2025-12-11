import { requireAdmin } from '@/lib/auth'
import StickyHeader from '@/components/StickyHeader'
import { getTranslations } from 'next-intl/server'
import { getCurrentAppUser } from '@/lib/auth'
import AdminUserManagement from '@/components/AdminUserManagement'
import AdminReportManagement from '@/components/AdminReportManagement'

export default async function AdminPage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ locale: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { locale } = await params
  const { tab } = await searchParams
  const t = await getTranslations({ locale, namespace: 'Index' })
  
  // Require admin access
  await requireAdmin()
  
  const user = await getCurrentAppUser()
  const activeTab = tab || 'users'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <StickyHeader user={user} />
      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Admin Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Manage users and reports
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8 border-b border-gray-200 dark:border-gray-700">
          <nav className="flex gap-8">
            <a
              href={`/${locale}/admin?tab=users`}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'users'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              User Management
            </a>
            <a
              href={`/${locale}/admin?tab=reports`}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'reports'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Report Management
            </a>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'users' ? <AdminUserManagement /> : <AdminReportManagement />}
      </main>
    </div>
  )
}
