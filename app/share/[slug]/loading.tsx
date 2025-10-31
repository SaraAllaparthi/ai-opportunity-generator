export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="animate-pulse rounded-2xl border border-gray-800 bg-[#1a1a1a]/70 px-6 py-10 text-center shadow-lg">
        <div className="text-sm uppercase tracking-wide text-gray-400">Loading</div>
        <div className="mt-1 text-base text-gray-300">Preparing your AI Brief…</div>
      </div>
    </div>
  )
}


