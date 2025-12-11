'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'

type Report = {
  id: string
  company_name: string
  created_at: string
  deleted_at?: string | null
  report_shares?: Array<{
    share_slug: string
    created_at: string
  }>
}

export default function AdminReportManagement() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const locale = useLocale()

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      // Force fresh data fetch to avoid caching issues with deleted reports
      const res = await fetch('/api/admin/reports', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setReports(data.reports)
      } else {
        setMessage('Failed to load reports')
      }
    } catch (error) {
      setMessage('Error loading reports')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, companyName: string) => {
    if (!confirm(`Are you sure you want to delete the report for ${companyName}? This action cannot be undone.`)) {
      return
    }

    try {
      const res = await fetch(`/api/admin/reports/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        // Update local state to mark as deleted
        setReports(reports.map(r => 
          r.id === id ? { ...r, deleted_at: new Date().toISOString() } : r
        ))
      } else {
        alert('Failed to delete report')
      }
    } catch (error) {
      console.error('Error deleting report:', error)
      alert('Error deleting report')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Reports List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            All Reports ({reports.length})
          </h2>
        </div>
        
        {message && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-400">{message}</p>
          </div>
        )}

        {reports.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">No reports generated yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Share Link
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {reports.map((report) => (
                  <tr key={report.id} className={`hover:bg-gray-50 dark:hover:bg-gray-900/50 ${report.deleted_at ? 'opacity-50 bg-gray-50 dark:bg-gray-900/30' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      {report.company_name}
                      {report.deleted_at && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                          Deleted
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(report.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {report.report_shares && report.report_shares.length > 0 ? (
                        <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs select-all">
                          {report.report_shares[0].share_slug}
                        </code>
                      ) : (
                        <span className="text-gray-400">No share link</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right space-x-4">
                      {report.report_shares && report.report_shares.length > 0 && (
                        <Link
                          href={`/${locale}/share/${report.report_shares[0].share_slug}`}
                          className={`font-medium ${report.deleted_at ? 'text-gray-400 cursor-not-allowed pointer-events-none' : 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'}`}
                          target="_blank"
                        >
                          View
                        </Link>
                      )}
                      
                      {!report.deleted_at && (
                        <button
                          onClick={() => handleDelete(report.id, report.company_name)}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
