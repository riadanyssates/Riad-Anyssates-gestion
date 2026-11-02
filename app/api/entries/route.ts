import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureDb } from '@/lib/db'
import { getManagerSession, getManagerName } from '@/lib/auth'
import { notify, fmtAmount } from '@/lib/notify'
 
export const dynamic = 'force-dynamic'
 
export async function GET(req: NextRequest) {
  try {
    await ensureDb()
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const employeeName = searchParams.get('employee')
    const token = searchParams.get('token')
    const month = searchParams.get('month')
 
    // Employee token auth
    if (token) {
      const emp = await sql`SELECT name FROM employees WHERE token = ${token} AND active = 1`
      if (!emp[0]) return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
      const name = emp[0].name as string
      const entries = type
        ? await sql`SELECT * FROM entries WHERE employee_name = ${name} AND type = ${type} ORDER BY date DESC, created_at DESC`
        : await sql`SELECT * FROM entries WHERE employee_name = ${name} ORDER BY date DESC, created_at DESC`
      return NextResponse.json(entries)
    }
 
    // Manager auth
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
 
    // Build query with available filters
    let entries
    if (type && status && employeeName && month) {
      entries = await sql`SELECT * FROM entries WHERE type=${type} AND status=${status} AND employee_name=${employeeName} AND strftime('%Y-%m',date)=${month} ORDER BY date DESC,created_at DESC`
    } else if (type && status && employeeName) {
      entries = await sql`SELECT * FROM entries WHERE type=${type} AND status=${status} AND employee_name=${employeeName} ORDER BY date DESC,created_at DESC`
    } else if (type && status && month) {
      entries = await sql`SELECT * FROM entries WHERE type=${type} AND status=${status} AND strftime('%Y-%m',date)=${month} ORDER BY date DESC,created_at DESC`
    } else if (type && employeeName && month) {
      entries = await sql`SELECT * FROM entries WHERE type=${type} AND employee_name=${employeeName} AND strftime('%Y-%m',date)=${month} ORDER BY date DESC,created_at DESC`
    } else if (type && month) {
      entries = await sql`SELECT * FROM entries WHERE type=${type} AND strftime('%Y-%m',date)=${month} ORDER BY date DESC,created_at DESC`
    } else if (type && status) {
      entries = await sql`SELECT * FROM entries WHERE type=${type} AND status=${status} ORDER BY date DESC,created_at DESC`
    } else if (type && employeeName) {
      entries = await sql`SELECT * FROM entries WHERE type=${type} AND employee_name=${employeeName} ORDER BY date DESC,created_at DESC`
    } else if (type) {
      entries = await sql`SELECT * FROM entries WHERE type=${type} ORDER BY date DESC,created_at DESC`
    } else if (status) {
      entries = await sql`SELECT * FROM entries WHERE status=${status} ORDER BY date DESC,created_at DESC`
    } else {
      entries = await sql`SELECT * FROM entries ORDER BY date DESC,created_at DESC`
    }
 
    return NextResponse.json(entries)
  } catch (error) {
    console.error('GET entries error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
 
export async function POST(req: NextRequest) {
  try {
    await ensureDb()
    const body = await req.json()
    const { type, date, amount, category, supplier, payment, description, currency, invoice_url, token, employee_name, amount_ht, tva_rate, reference, cash_location, to_accountant } = body
 
    let empName: string
 
    if (token) {
      const emp = await sql`SELECT name FROM employees WHERE token = ${token} AND active = 1`
      if (!emp[0]) return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
      empName = emp[0].name as string
    } else {
      const isAuth = await getManagerSession()
      if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
      // Plus de choix d'employé côté manager : on enregistre la personne connectée
      empName = employee_name || getManagerName()
    }
 
    if (!type || !date || !amount || !category || !empName) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
    }
 
    // Saisie d'un administrateur (session manager) : déjà validée, rien à valider ensuite.
    // Saisie d'un employé (token) : reste « En attente » jusqu'à validation.
    // Encaissement saisi par un employé : il part dans Comptable › Factures de vente,
    // où Valérie ou Nicolas complètent la facture client
    const result = await sql`
      INSERT INTO entries (employee_name, type, date, amount, category, supplier, payment, description, currency, invoice_url, amount_ht, tva_rate, reference, cash_location, to_accountant, status, validated_at)
      VALUES (${empName}, ${type}, ${date}, ${amount}, ${category}, ${supplier || null}, ${payment || null}, ${description || null}, ${currency || 'MAD'}, ${invoice_url || null}, ${amount_ht || null}, ${tva_rate || null}, ${reference || null}, ${payment === 'Espèces' ? (cash_location === 'coffre' ? 'coffre' : 'fonds') : null}, ${to_accountant || (token && type === 'cash') ? 1 : 0}, ${token ? 'pending' : 'validated'}, ${token ? null : new Date().toISOString().replace('T', ' ').slice(0, 19)})
      RETURNING *
    `
 
    // Notification aux administrateurs (sauf l'auteur de la saisie)
    const actor = token ? empName : getManagerName()
    const kindLabel = type === 'cb' ? 'dépense' : 'encaissement'
    await notify({
      kind: 'entry',
      actor,
      title: `${actor} : nouvelle ${kindLabel}${actor !== empName ? ` (pour ${empName})` : ''}`,
      body: [fmtAmount(amount, currency), category, supplier, payment].filter(Boolean).join(' · '),
      url: '/manager',
    })

    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('POST entry error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
 
