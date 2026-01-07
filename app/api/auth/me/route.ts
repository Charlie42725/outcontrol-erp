import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getSession()

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      ok: true,
      data: user,
    })
  } catch (error) {
    console.error('Get session error:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
