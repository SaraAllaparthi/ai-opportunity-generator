import { NextRequest, NextResponse } from 'next/server'
import { llmGenerateText } from '@/lib/providers/llm'

export async function POST(req: NextRequest) {
  let body: any = {}
  let language = 'en'
  
  try {
    body = await req.json()
    const { companyName, dimensions } = body
    language = body.language || 'en'

    if (!companyName || !dimensions || !Array.isArray(dimensions)) {
      return NextResponse.json(
        { error: 'Missing required fields: companyName, dimensions' },
        { status: 400 }
      )
    }

    const system = language === 'de'
      ? 'Du bist ein strategischer Analyst. Schreibe eine prägnante, geschäftsfokussierte Zusammenfassung (2-3 Sätze) für CEOs. Fokussiere auf Wettbewerbsvorteile, Lücken und Handlungsempfehlungen. Keine generischen Aussagen.'
      : 'You are a strategic analyst. Write a concise, business-focused executive summary (2-3 sentences) for CEOs. Focus on competitive advantages, gaps, and actionable insights. Avoid generic statements.'

    const dimensionData = dimensions.map((d: any) => ({
      dimension: d.label,
      companyScore: d.companyScore.toFixed(1),
      peerAverage: d.peerAverage.toFixed(1),
      gap: (d.companyScore - d.peerAverage).toFixed(1)
    }))

    const user = language === 'de'
      ? `Analysiere die Peer-Vergleichsdaten für ${companyName}:

${dimensionData.map((d: any) => `- ${d.dimension}: ${companyName} ${parseFloat(d.gap) >= 0 ? 'führt' : 'liegt zurück'} mit ${d.companyScore} vs. Peer-Durchschnitt ${d.peerAverage} (Differenz: ${d.gap >= 0 ? '+' : ''}${d.gap})`).join('\n')}

Schreibe eine prägnante Executive Summary (2-3 Sätze) auf Deutsch, die:
1. Die wichtigsten Stärken und Schwächen hervorhebt
2. Konkrete Handlungsempfehlungen gibt
3. Keine Firmennamen erwähnt (nur "das Unternehmen" oder "die Firma")
4. Geschäftsfokussiert und strategisch ist`
      : `Analyze peer comparison data for ${companyName}:

${dimensionData.map((d: any) => `- ${d.dimension}: ${companyName} ${parseFloat(d.gap) >= 0 ? 'leads' : 'trails'} with ${d.companyScore} vs peer average ${d.peerAverage} (gap: ${d.gap >= 0 ? '+' : ''}${d.gap})`).join('\n')}

Write a concise executive summary (2-3 sentences) that:
1. Highlights key strengths and weaknesses
2. Provides actionable insights
3. Does not mention company names (use "the company" or "the organization")
4. Is business-focused and strategic`

    try {
      const summary = await llmGenerateText(system, user, {
        model: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 120,
        timeoutMs: 10000
      })

      return NextResponse.json({ summary })
    } catch (llmError: any) {
      console.error('[API] LLM generation error:', llmError)
      // Return a fallback summary instead of failing
      const fallbackSummary = language === 'de'
        ? 'Die Peer-Vergleichsanalyse zeigt Stärken und Verbesserungspotenziale in verschiedenen Dimensionen. Das Unternehmen sollte sich auf Bereiche mit größeren Lücken konzentrieren, um die Wettbewerbsposition zu stärken.'
        : 'The peer comparison analysis reveals strengths and improvement opportunities across various dimensions. The company should focus on areas with larger gaps to strengthen competitive positioning.'
      
      return NextResponse.json({ summary: fallbackSummary })
    }
  } catch (err: any) {
    console.error('[API] Error in summarize-peer-comparison route:', err)
    console.error('[API] Error details:', {
      message: err?.message,
      stack: err?.stack,
      name: err?.name
    })
    
    // Return a fallback summary instead of error
    const fallbackSummary = body?.language === 'de'
      ? 'Die Peer-Vergleichsanalyse zeigt Stärken und Verbesserungspotenziale in verschiedenen Dimensionen.'
      : 'The peer comparison analysis reveals strengths and improvement opportunities across various dimensions.'
    
    return NextResponse.json({ summary: fallbackSummary })
  }
}

