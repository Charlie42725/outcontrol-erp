import { NextResponse } from 'next/server'
import { deleteSession } from '@/lib/auth'

export async function POST() {
  try {
    await deleteSession()

    // 返回成功並設置 no-cache header，確保不會快取登出狀態
    const response = NextResponse.json({ ok: true })
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { ok: false, error: '登出失敗' },
      { status: 500 }
    )
  }
}
