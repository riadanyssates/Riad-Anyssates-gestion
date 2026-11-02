import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureDb } from '@/lib/db'
import { createSessionToken, SESSION_COOKIE, MANAGER_NAME_COOKIE } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await ensureDb()
    const { pin, token: empToken } = await req.json()

    let displayName: string

    if (empToken) {
      // Accès manager via le lien personnel d'un employé autorisé (ex : Nicolas)
      const rows = await sql`SELECT name FROM employees WHERE token = ${empToken} AND active = 1 AND is_manager = 1`
      if (!rows[0]) {
        return NextResponse.json({ error: 'Accès manager non autorisé' }, { status: 401 })
      }
      displayName = rows[0].name as string
    } else {
      if (!pin) {
        return NextResponse.json({ error: 'PIN requis' }, { status: 400 })
      }
      const rows = await sql`SELECT value FROM settings WHERE key = 'pin'`
      const storedPin = rows[0]?.value as string | undefined
      if (pin !== storedPin) {
        return NextResponse.json({ error: 'PIN incorrect' }, { status: 401 })
      }
      displayName = 'Valérie'
    }

    const token = createSessionToken(displayName)
    const response = NextResponse.json({ ok: true, name: displayName })
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    }
    response.cookies.set(SESSION_COOKIE, token, cookieOpts)
    response.cookies.set(MANAGER_NAME_COOKIE, encodeURIComponent(displayName), cookieOpts)
    return response
  } catch (error) {
    console.error('Auth error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(SESSION_COOKIE)
  response.cookies.delete(MANAGER_NAME_COOKIE)
  return response
}
