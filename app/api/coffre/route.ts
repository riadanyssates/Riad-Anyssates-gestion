import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getManagerSession, getManagerName } from '@/lib/auth'
import { notify, fmtAmount } from '@/lib/notify'
 
export const dynamic = 'force-dynamic'
 
export async function GET(req: NextRequest) {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
 
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')
 
    const entries = month
      ? await sql`SELECT * FROM coffre_entries WHERE strftime('%Y-%m', date) = ${month} ORDER BY date DESC, created_at DESC`
      : await sql`SELECT * FROM coffre_entries ORDER BY date DESC, created_at DESC`
 
    return NextResponse.json(entries)
  } catch (error) {
    console.error('GET coffre error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
 
export async function POST(req: NextRequest) {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
 
    const body = await req.json()
    const { direction, date, amount, currency, category, description, employee_name, invoice_url } = body
 
    if (!direction || !date || !amount || !category || !employee_name) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
    }
    if (direction !== 'in' && direction !== 'out') {
      return NextResponse.json({ error: 'Direction invalide' }, { status: 400 })
    }
 
    const result = await sql`
      INSERT INTO coffre_entries (employee_name, direction, date, amount, currency, category, description, invoice_url, status)
      VALUES (${employee_name}, ${direction}, ${date}, ${amount}, ${currency || 'MAD'}, ${category}, ${description || null}, ${invoice_url || null}, 'validated')
      RETURNING *
    `
    await notify({
      kind: 'coffre',
      actor: getManagerName(),
      title: `${getManagerName()} : ${direction === 'in' ? 'entrée' : 'sortie'} du coffre fort`,
      body: [fmtAmount(amount, currency), category, description].filter(Boolean).join(' · '),
      url: '/manager',
    })
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('POST coffre error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
 

