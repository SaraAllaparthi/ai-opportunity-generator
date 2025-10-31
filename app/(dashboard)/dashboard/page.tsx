import { listBriefs } from '@/lib/db/briefs'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const briefs = await listBriefs()
  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {briefs.length === 0 && (
          <div className="rounded-lg border p-6 text-sm text-muted-foreground">No briefs yet. Generate one from the landing page.</div>
        )}
        {briefs.map((b) => (
          <a
            key={b.id}
            href={`/share/${b.share_slug}`}
            className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
          >
            <div className="text-sm text-muted-foreground">{new Date(b.created_at).toLocaleString()}</div>
            <div className="text-base font-medium">{b.data.company?.name || 'Company'}</div>
            <div className="text-sm text-muted-foreground truncate">{b.data.company?.summary || '—'}</div>
          </a>
        ))}
      </div>
    </main>
  )
}


