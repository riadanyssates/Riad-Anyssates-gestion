import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureDb } from '@/lib/db'
import { getManagerSession, canEditAll } from '@/lib/auth'
import { removeInvoice } from '@/lib/invoice-db'
import { refreshPayableStatus } from '@/lib/payables-db'

export const dynamic = 'force-dynamic'
 
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
 
    const body = await req.json()
    const id = parseInt(params.id)

    // Modification complète d'une opération : réservée à Valérie et Nicolas
    if (body.edit !== undefined) {
      if (!canEditAll()) return NextResponse.json({ error: 'Seuls Valérie et Nicolas peuvent modifier une opération en entier.' }, { status: 403 })
      await ensureDb()
      const cur = (await sql`SELECT * FROM entries WHERE id = ${id}`)[0]
      if (!cur) return NextResponse.json({ error: 'Entrée introuvable' }, { status: 404 })
      const e = body.edit || {}
      const txt = (v: unknown, max = 300) => { const s = String(v ?? '').trim().slice(0, max); return s || null }
      const date = String(e.date ?? cur.date)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date + 'T00:00:00Z'))) return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
      const amount = Number(e.amount ?? cur.amount)
      if (!isFinite(amount) || amount < 0) return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
      const currency = String(e.currency ?? cur.currency ?? 'MAD')
      if (!['MAD', 'EUR'].includes(currency)) return NextResponse.json({ error: 'Devise invalide' }, { status: 400 })
      const MODES = ['CB', 'Virement', 'Chèque', 'Prélèvement', 'Espèces']
      const payment = e.payment === undefined ? (cur.payment as string | null) : txt(e.payment, 40)
      if (payment && !MODES.includes(payment)) return NextResponse.json({ error: 'Mode de paiement invalide' }, { status: 400 })
      const loc = payment === 'Espèces' ? ((e.cash_location ?? cur.cash_location) === 'coffre' ? 'coffre' : 'fonds') : null
      const employee = txt(e.employee_name ?? cur.employee_name, 80)
      const category = txt(e.category ?? cur.category, 80)
      if (!employee || !category) return NextResponse.json({ error: 'Employé et catégorie sont obligatoires' }, { status: 400 })
      const num = (v: unknown, fallback: unknown) => { if (v === undefined) return fallback ?? null; if (v === null || v === '') return null; const n = Number(v); return isFinite(n) ? n : null }
      const amountHt = num(e.amount_ht, cur.amount_ht)
      const tvaRate = num(e.tva_rate, cur.tva_rate)
      const supplier = e.supplier === undefined ? cur.supplier : txt(e.supplier)
      const reference = e.reference === undefined ? cur.reference : txt(e.reference, 120)
      const description = e.description === undefined ? cur.description : txt(e.description, 1000)
      const toAcc = e.to_accountant === undefined ? cur.to_accountant : (e.to_accountant ? 1 : 0)
      // justificatif : non envoyé = inchangé, null = retiré, texte = remplacé
      const invoiceUrl = e.invoice_url === undefined ? cur.invoice_url : (e.invoice_url ? String(e.invoice_url) : null)
      const result = await sql`UPDATE entries SET date = ${date}, employee_name = ${employee}, category = ${category}, supplier = ${supplier},
        payment = ${payment}, cash_location = ${loc}, reference = ${reference}, description = ${description}, currency = ${currency},
        amount = ${amount}, amount_ht = ${amountHt}, tva_rate = ${tvaRate}, to_accountant = ${toAcc}, invoice_url = ${invoiceUrl}
        WHERE id = ${id} RETURNING *`
      // Si l'opération règle une facture fournisseur, le règlement suit la modification
      const pays = await sql`SELECT payable_id FROM payable_payments WHERE entry_id = ${id}`
      if (pays.length) {
        await sql`UPDATE payable_payments SET date = ${date}, amount = ${amount}, payment = ${payment} WHERE entry_id = ${id}`
        for (const x of pays) await refreshPayableStatus(x.payable_id as number)
      }
      return NextResponse.json(result[0])
    }
 
    if (body.invoice_url !== undefined) {
      const result = await sql`UPDATE entries SET invoice_url = ${body.invoice_url} WHERE id = ${id} RETURNING *`
      return NextResponse.json(result[0])
    }
 
    if (body.pointed !== undefined) {
      const result = await sql`UPDATE entries SET pointed = ${body.pointed ? 1 : 0} WHERE id = ${id} RETURNING *`
      return NextResponse.json(result[0])
    }
 
    if (body.date !== undefined) {
      const d = String(body.date)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(Date.parse(d + 'T00:00:00Z'))) {
        return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
      }
      const result = await sql`UPDATE entries SET date = ${d} WHERE id = ${id} RETURNING *`
      if (!result[0]) return NextResponse.json({ error: 'Entrée introuvable' }, { status: 404 })
      return NextResponse.json(result[0])
    }

    if (body.to_accountant !== undefined) {
      await ensureDb()
      const result = await sql`UPDATE entries SET to_accountant = ${body.to_accountant ? 1 : 0} WHERE id = ${id} RETURNING *`
      return NextResponse.json(result[0])
    }

    if (body.payment !== undefined) {
      const MODES = ['CB', 'Virement', 'Chèque', 'Prélèvement', 'Espèces']
      const payment = String(body.payment)
      if (!MODES.includes(payment)) return NextResponse.json({ error: 'Mode de paiement invalide' }, { status: 400 })
      const loc = payment === 'Espèces' ? (body.cash_location === 'coffre' ? 'coffre' : 'fonds') : null
      const result = await sql`UPDATE entries SET payment = ${payment}, cash_location = ${loc} WHERE id = ${id} RETURNING *`
      if (!result[0]) return NextResponse.json({ error: 'Entrée introuvable' }, { status: 404 })
      return NextResponse.json(result[0])
    }

    if (body.description !== undefined) {
      const desc = String(body.description ?? '').trim().slice(0, 1000)
      const result = await sql`UPDATE entries SET description = ${desc || null} WHERE id = ${id} RETURNING *`
      if (!result[0]) return NextResponse.json({ error: 'Entrée introuvable' }, { status: 404 })
      return NextResponse.json(result[0])
    }

    if (body.reference !== undefined) {
      const result = await sql`UPDATE entries SET reference = ${body.reference || null} WHERE id = ${id} RETURNING *`
      return NextResponse.json(result[0])
    }
 
    const { status } = body
    if (status === 'validated') {
      const result = await sql`
        UPDATE entries SET status = 'validated', validated_at = datetime('now')
        WHERE id = ${id}
        RETURNING *
      `
      return NextResponse.json(result[0])
    } else if (status === 'pending') {
      const result = await sql`
        UPDATE entries SET status = 'pending', validated_at = NULL
        WHERE id = ${id}
        RETURNING *
      `
      return NextResponse.json(result[0])
    }
 
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  } catch (error) {
    console.error('PATCH entry error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
 
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
 
    await ensureDb()
    const id = parseInt(params.id)
    // La facture de cet encaissement est supprimée (ou annulée si d'autres ont été faites depuis) :
    // sa taxe de séjour ne compte plus. On la retire avant l'encaissement pour ne jamais la laisser orpheline.
    const inv = await sql`SELECT id FROM invoices WHERE entry_id = ${id}`
    for (const i of inv) await removeInvoice(i.id as number)
    // Règlement d'une facture fournisseur : il est retiré, la facture redevient « à payer » (ou partiellement réglée)
    const pays = await sql`SELECT id, payable_id FROM payable_payments WHERE entry_id = ${id}`
    await sql`DELETE FROM payable_payments WHERE entry_id = ${id}`
    for (const x of pays) await refreshPayableStatus(x.payable_id as number)
    await sql`DELETE FROM entries WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE entry error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
 
