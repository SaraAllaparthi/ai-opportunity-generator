import { NextRequest } from 'next/server'

// Minimal Alpha Vantage proxy: /api/price?symbol=UBSG.SW
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const symbol = searchParams.get('symbol') || 'UBSG.SW'
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY
    if (!apiKey) return new Response(JSON.stringify({ error: 'Price unavailable' }), { status: 200 })

    const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`
    const quoteRes = await fetch(quoteUrl, { cache: 'no-store' })
    const quote = await quoteRes.json()
    
    // Check for API errors
    if (quote["Error Message"] || quote["Note"]) {
      return new Response(JSON.stringify({ error: 'Price unavailable', symbol }), { status: 200 })
    }
    
    const gq = quote["Global Quote"] || {}
    const last = parseFloat(gq["05. price"] || '0')
    const changePct = parseFloat(gq["10. change percent"]?.replace('%','') || '0')

    if (!last || last === 0) {
      return new Response(JSON.stringify({ error: 'Price unavailable', symbol }), { status: 200 })
    }

    // A tiny 5 data-point spark based on intraday 5min (fallback to flat)
    let points: number[] = []
    try {
      const intradayUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${encodeURIComponent(symbol)}&interval=5min&outputsize=compact&apikey=${apiKey}`
      const intradayRes = await fetch(intradayUrl, { cache: 'no-store' })
      const intraday = await intradayRes.json()
      
      if (!intraday["Error Message"] && !intraday["Note"]) {
        const series = intraday["Time Series (5min)"] || {}
        points = Object.entries(series)
          .slice(0, 5)
          .map(([, v]: any) => parseFloat(v['4. close']))
          .reverse()
      }
    } catch {
      // If intraday fails, use flat sparkline
      points = Array(5).fill(last)
    }

    return new Response(JSON.stringify({ symbol, last, changePct, spark: points.length ? points : Array(5).fill(last), ts: new Date().toISOString() }), { status: 200 })
  } catch {
    return new Response(JSON.stringify({ error: 'Price unavailable' }), { status: 200 })
  }
}


