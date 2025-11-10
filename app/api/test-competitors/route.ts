import { NextResponse } from 'next/server'
import { getBriefBySlug } from '@/lib/db/briefs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')
  
  if (!slug) {
    return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 })
  }
  
  try {
    const brief = await getBriefBySlug(slug, true)
    
    if (!brief) {
      return NextResponse.json({ error: 'Brief not found' }, { status: 404 })
    }
    
    const data = brief.data
    
    // Test data flow
    const result = {
      slug,
      company: {
        name: data.company?.name,
        website: data.company?.website
      },
      competitors: {
        count: data.competitors?.length || 0,
        type: Array.isArray(data.competitors) ? 'array' : typeof data.competitors,
        raw: data.competitors || [],
        filtered: (data.competitors || [])
          .filter(c => c && c.name && c.name.trim())
          .slice(0, 3)
          .map(c => ({
            name: c.name,
            website: c.website,
            hq: c.hq,
            hasEvidencePages: Array.isArray(c.evidence_pages) && c.evidence_pages.length > 0
          }))
      },
      componentWillRender: (data.competitors || []).filter(c => c && c.name && c.name.trim()).length > 0
    }
    
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Failed to fetch brief',
      message: error.message 
    }, { status: 500 })
  }
}

