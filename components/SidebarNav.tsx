"use client"
import { useEffect, useState } from 'react'

const sections = [
  { id: 'exec-summary', label: 'Executive' },
  { id: 'snapshot', label: 'Snapshot' },
  { id: 'industry', label: 'Industry' },
  { id: 'moves', label: 'Moves' },
  { id: 'competitors', label: 'Competitors' },
  { id: 'use-cases', label: 'Landscape' },
  { id: 'action-plan', label: 'Action Plan' },
  { id: 'feasibility', label: 'AI Readiness' }
]

export default function SidebarNav() {
  const [active, setActive] = useState('exec-summary')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id) })
    }, { rootMargin: '-40% 0px -50% 0px' })
    sections.forEach(s => {
      const el = document.getElementById(s.id)
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [])

  const Nav = (
    <nav className="flex flex-col gap-2 text-sm">
      {sections.map(s => (
        <a key={s.id} href={`#${s.id}`} className={`rounded px-2 py-1 ${active===s.id?'bg-accent':''}`} onClick={()=>setOpen(false)}>
          {s.label}
        </a>
      ))}
    </nav>
  )

  return (
    <div className="md:sticky md:top-6">
      <div className="md:hidden mb-2">
        <button className="w-full rounded border px-3 py-2 text-sm" onClick={()=>setOpen(v=>!v)}>
          Jump to: {sections.find(s=>s.id===active)?.label}
        </button>
        {open && <div className="mt-2 rounded border p-2">{Nav}</div>}
      </div>
      <div className="hidden md:block">{Nav}</div>
    </div>
  )
}


