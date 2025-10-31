"use client"
import Link from 'next/link'

export default function StickyHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-800 bg-[#0A0A0A]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[850px] items-center justify-between px-6 py-4">
        <div className="text-sm font-medium tracking-wider text-white">MAVERICK LENS</div>
        <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
          Sign Out
        </Link>
      </div>
    </header>
  )
}

