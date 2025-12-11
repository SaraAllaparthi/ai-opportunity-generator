import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { createClient } from '@/lib/db/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser()
    const body = await req.json()
    const { company_name, report_json, create_share_link } = body

    if (!company_name || !report_json) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createClient()

    // 1. Create Report
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .insert({
        user_id: user.id,
        company_name,
        report_json,
      })
      .select('id')
      .single()

    if (reportError || !report) {
      console.error('Error creating report:', reportError)
      return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
    }

    let shareToken = null

    // 2. Optionally create share link
    if (create_share_link) {
      const token = crypto.randomUUID().replace(/-/g, '') // Simple token
      // Default 7 days expiry
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      const { error: shareError } = await supabase
        .from('report_shares')
        .insert({
          report_id: report.id,
          token,
          expires_at: expiresAt.toISOString(),
          created_by_user_id: user.id,
        })

      if (shareError) {
        console.error('Error creating share link:', shareError)
        // Don't fail the whole request, just return no token
      } else {
        shareToken = token
      }
    }

    return NextResponse.json({ 
      id: report.id, 
      share_token: shareToken 
    })

  } catch (error: any) {
    console.error('API Error:', error)
    if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (error.message === 'Account disabled') return NextResponse.json({ error: 'Account disabled' }, { status: 403 })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
