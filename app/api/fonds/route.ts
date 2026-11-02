import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getManagerSession, getManagerName } from '@/lib/auth'
import { notify, fmtAmount } from '@/lib/notify'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')
    const token = searchParams.get('token')

    // Employee token auth
    if (token) {
      const emp = await sql`SELECT name FROM employees WHERE token = ${token} AND active = 1`
      if (!emp[0]) return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
      const name = emp[0].name as string
      const entries = await sql`SELECT * FROM fonds_entries WHERE employee_name = ${name} ORDER BY date DESC, created_at DESC`
      return NextResponse.json(entries)
    }

    // Manager auth
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const entries = month
      ? await sql`SELECT * FROM fonds_entries WHERE strftime('%Y-%m', date) = ${month} ORDER BY date DESC, created_at DESC`
      : await sql`SELECT * FROM fonds_entries ORDER BY date DESC, created_at DESC`

    return NextResponse.json(entries)
  } catch (error) {
    console.error('GET fonds error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { direction, date, amount, currency, category, description, token, employee_name } = body

    let empName: string

    if (token) {
      const emp = await sql`SELECT name FROM employees WHERE token = ${token} AND active = 1`
      if (!emp[0]) return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
      empName = emp[0].name as string
    } else {
      const isAuth = await getManagerSession()
      if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
      empName = employee_name
    }

    if (!direction || !date || !amount || !category || !empName) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
    }

    if (direction !== 'in' && direction !== 'out') {
      return NextResponse.json({ error: 'Direction invalide' }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO fonds_entries (employee_name, direction, date, amount, currency, category, description, status, validated_at)
      VALUES (${empName}, ${direction}, ${date}, ${amount}, ${currency || 'MAD'}, ${category}, ${description || null}, ${token ? 'pending' : 'validated'}, ${token ? null : new Date().toISOString().replace('T', ' ').slice(0, 19)})
      RETURNING *
    `

    await notify({
      kind: 'fonds',
      actor: token ? empName : getManagerName(),
      title: `${token ? empName : getManagerName()} : ${direction === 'in' ? 'entrée' : 'sortie'} de caisse`,
      body: [fmtAmount(amount, currency), category, description].filter(Boolean).join(' · '),
      url: '/manager',
    })

    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('POST fonds error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
