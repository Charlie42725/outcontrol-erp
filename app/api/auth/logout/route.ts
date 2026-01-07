import { NextResponse } from 'next/server'
import { deleteSession } from '@/lib/auth'

export async function POST() {
  try {
    await deleteSession()

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { ok: false, error: '登出失敗' },
      { status: 500 }
    )
  }
}
