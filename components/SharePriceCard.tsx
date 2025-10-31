"use client"
import { useEffect, useState } from 'react'
import { getCompanyTickers } from '@/lib/utils/tickers'

type Price = { symbol: string; last: number; changePct: number; spark: number[]; ts: string; error?: string }

export default function SharePriceCard({ companyName }: { companyName: string }) {
  const symbols = getCompanyTickers(companyName)
  const [symbol, setSymbol] = useState(symbols[0] || '')
  const [data, setData] = useState<Price | null>(null)
  const [loading, setLoading] = useState(false)

  async function load(sym: string) {
    setLoading(true)
    try {
      const r = await fetch(`/api/price?symbol=${encodeURIComponent(sym)}`, { cache: 'no-store' })
      const j = await r.json()
      setData(j)
    } catch {
      setData({ symbol: sym, last: 0, changePct: 0, spark: [], ts: '', error: 'Price unavailable' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { 
    if (symbol) load(symbol) 
  }, [symbol])

  const up = (data?.changePct || 0) >= 0

  if (!symbols.length) {
    return (
      <div className="rounded-2xl border border-gray-800 bg-[#121212] p-6 shadow-lg w-full md:w-72">
        <div className="text-xs uppercase text-gray-400 mb-2">Share Price</div>
        <div className="text-sm text-gray-400">Ticker not available</div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-800 bg-[#121212] p-6 shadow-lg w-full md:w-72">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs uppercase text-gray-400">Share Price</div>
        {symbols.length > 1 && (
          <select className="rounded border border-gray-800 bg-[#0f0f0f] px-2 py-1 text-xs text-white" value={symbol} onChange={(e)=>setSymbol(e.target.value)}>
            {symbols.map(s => (<option key={s} value={s}>{s}</option>))}
          </select>
        )}
      </div>
      {loading ? (
        <div className="text-sm text-gray-400">Loading...</div>
      ) : data?.error ? (
        <div className="text-sm text-gray-400">Price unavailable</div>
      ) : (
        <div>
          <div className="flex items-baseline gap-2">
            <div className="text-lg font-semibold">{data?.last?.toFixed(2)}</div>
            <div className={`text-xs ${up ? 'text-green-600' : 'text-red-600'}`}>{(data?.changePct||0).toFixed(2)}%</div>
          </div>
          <div className="mt-2 h-8 w-full">
            <svg viewBox="0 0 100 20" className="h-8 w-full text-muted-foreground">
              <polyline fill="none" stroke="currentColor" strokeWidth="1" points={(() => {
                const arr = (data?.spark?.length ? data.spark : [0,0,0,0,0])
                const min = Math.min(...arr)
                const max = Math.max(...arr)
                const norm = arr.map(v => max - min === 0 ? 10 : 2 + ((v - min) / (max - min)) * 16)
                return norm.map((y,i) => `${i*25},${20 - y}`).join(' ')
              })()} />
            </svg>
          </div>
          <div className="mt-1 text-[10px] text-gray-400">Updated {data?.ts ? new Date(data.ts).toLocaleTimeString() : ''}</div>
        </div>
      )}
    </div>
  )
}


