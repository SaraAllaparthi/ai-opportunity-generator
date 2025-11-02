import { listBriefs } from '@/lib/db/briefs'
import StickyHeader from '@/components/StickyHeader'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const briefs = await listBriefs()
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
      <div className="relative z-10">
        <StickyHeader />
        <main className="mx-auto max-w-6xl px-6 py-12">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-300">View all your AI opportunity briefs</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {briefs.length === 0 && (
              <div className="md:col-span-2 lg:col-span-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center shadow-lg">
                <p className="text-gray-600 dark:text-gray-300 mb-2">No briefs yet.</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Generate one from the <a href="/" className="text-blue-600 dark:text-blue-400 hover:underline">landing page</a>.</p>
              </div>
            )}
            {briefs.map((b) => (
              <a
                key={b.id}
                href={`/share/${b.share_slug}`}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 transition-all hover:shadow-lg hover:scale-[1.02] shadow-sm"
              >
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">{new Date(b.created_at).toLocaleString()}</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{b.data.company?.name || 'Company'}</div>
                <div className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{b.data.company?.summary || '—'}</div>
              </a>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}


