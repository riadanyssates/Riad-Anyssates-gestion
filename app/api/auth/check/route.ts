import { NextResponse } from 'next/server'
import { getManagerSession, getManagerName, canEditAll } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const isAuth = await getManagerSession()
  if (!isAuth) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
  return NextResponse.json({ authenticated: true, name: getManagerName(), canEditAll: canEditAll() })
}
