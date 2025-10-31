import { Brief } from '@/lib/schema/brief'

const items = [
  { name: 'Data', level: 'Medium' },
  { name: 'Leadership', level: 'Medium' },
  { name: 'Technical', level: 'Medium' },
  { name: 'Risk', level: 'Medium' },
  { name: 'Compliance', level: 'Medium' }
]

export default function FeasibilityScan({ _data }: { _data: Brief }) {
  return (
    <section className="rounded-2xl border border-gray-800 bg-[#121212] p-8 shadow-lg">
      <h3 className="mb-1 text-lg font-medium">Feasibility Scan</h3>
      <p className="text-sm italic text-gray-400 mb-4">Readiness across domains is adequate to proceed with targeted pilots.</p>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
        {items.map((i) => (
          <div key={i.name} className="rounded-xl border border-gray-800 bg-[#0A0A0A] p-4 text-sm flex items-center justify-between">
            <span className="text-white">{i.name}</span>
            <span className="rounded-full border border-gray-800 px-2 py-0.5 text-xs text-gray-400">{i.level}</span>
          </div>
        ))}
      </div>
    </section>
  )
}


