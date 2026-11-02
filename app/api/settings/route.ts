import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getManagerSession, getManagerName, createSessionToken, SESSION_COOKIE } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const rows = await sql`SELECT key, value FROM settings`
    const settings: Record<string, string> = {}
    for (const row of rows) {
      if (row.key !== 'pin') {
        settings[row.key as string] = row.value as string
      }
    }
    return NextResponse.json(settings)
  } catch (error) {
    console.error('GET settings error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { currentPin, newPin } = await req.json()

    // Verify current PIN
    const rows = await sql`SELECT value FROM settings WHERE key = 'pin'`
    if ((rows[0]?.value as string) !== currentPin) {
      return NextResponse.json({ error: 'PIN actuel incorrect' }, { status: 400 })
    }

    await sql`UPDATE settings SET value = ${newPin} WHERE key = 'pin'`

    // Update session cookie with new PIN
    const token = createSessionToken(getManagerName())
    const response = NextResponse.json({ ok: true })
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    return response
  } catch (error) {
    console.error('PATCH settings error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
