import { getCurrentAppUser } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const user = await getCurrentAppUser()
    
    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 })
    }

    return NextResponse.json({ user }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ user: null }, { status: 200 })
  }
}
