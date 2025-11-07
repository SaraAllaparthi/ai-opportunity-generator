import { Brief } from '@/lib/schema/brief'

export default function MovesTimeline({ data }: { data: Brief }) {
  const items = data.strategic_moves
  return (
    <div className="overflow-x-auto">
      <div className="flex items-center gap-6">
        {items.map((m, i) => (
          <div key={i} className="min-w-[180px]">
            <div className="text-xs text-muted-foreground">Q{m.horizon_quarters}</div>
            <div className="h-2 w-full rounded bg-muted"></div>
            <div className="mt-1 text-sm font-medium">{m.move}</div>
            <div className="text-xs text-muted-foreground">{m.owner}</div>
            <div className="text-xs text-muted-foreground mt-1">{m.rationale}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
