import { NextRequest, NextResponse } from 'next/server'
import sql, { sqlBatch, ensureDb } from '@/lib/db'
import { getManagerSession, canEditAll } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const body = await req.json()
    const id = parseInt(params.id)

    // Modification complète d'un mouvement de caisse : réservée à Valérie et Nicolas
    if (body.edit !== undefined) {
      if (!canEditAll()) return NextResponse.json({ error: 'Seuls Valérie et Nicolas peuvent modifier un mouvement de caisse.' }, { status: 403 })
      await ensureDb()
      const cur = (await sql`SELECT * FROM fonds_entries WHERE id = ${id}`)[0]
      if (!cur) return NextResponse.json({ error: 'Mouvement introuvable' }, { status: 404 })
      const e = body.edit || {}
      const txt = (v: unknown, max = 300) => { const s = String(v ?? '').trim().slice(0, max); return s || null }
      const date = String(e.date ?? cur.date)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date + 'T00:00:00Z'))) return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
      const amount = Number(e.amount ?? cur.amount)
      if (!isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
      const currency = String(e.currency ?? cur.currency ?? 'MAD')
      if (!['MAD', 'EUR'].includes(currency)) return NextResponse.json({ error: 'Devise invalide' }, { status: 400 })
      const direction = String(e.direction ?? cur.direction)
      if (direction !== 'in' && direction !== 'out') return NextResponse.json({ error: 'Sens invalide' }, { status: 400 })
      const description = e.description === undefined ? cur.description : txt(e.description, 1000)

      // Transfert coffre ↔ caisse : les deux côtés sont modifiés ensemble (sens opposé côté coffre)
      const transferId = cur.transfer_id as string | null
      if (transferId) {
        const coffreDir = direction === 'in' ? 'out' : 'in'
        await sqlBatch([
          { sql: 'UPDATE fonds_entries SET date = ?, amount = ?, currency = ?, direction = ?, description = ? WHERE transfer_id = ?', args: [date, amount, currency, direction, description as string | null, transferId] },
          { sql: 'UPDATE coffre_entries SET date = ?, amount = ?, currency = ?, direction = ?, description = ? WHERE transfer_id = ?', args: [date, amount, currency, coffreDir, description as string | null, transferId] },
        ])
        const result = await sql`SELECT * FROM fonds_entries WHERE id = ${id}`
        return NextResponse.json(result[0])
      }

      const employee = txt(e.employee_name ?? cur.employee_name, 80)
      const category = txt(e.category ?? cur.category, 80)
      if (!employee || !category) return NextResponse.json({ error: 'Employé et catégorie sont obligatoires' }, { status: 400 })
      const result = await sql`UPDATE fonds_entries SET date = ${date}, amount = ${amount}, currency = ${currency}, direction = ${direction},
        employee_name = ${employee}, category = ${category}, description = ${description} WHERE id = ${id} RETURNING *`
      return NextResponse.json(result[0])
    }

    const { status } = body

    if (status === 'validated') {
      const result = await sql`UPDATE fonds_entries SET status='validated', validated_at=datetime('now') WHERE id=${id} RETURNING *`
      return NextResponse.json(result[0])
    } else if (status === 'pending') {
      const result = await sql`UPDATE fonds_entries SET status='pending', validated_at=NULL WHERE id=${id} RETURNING *`
      return NextResponse.json(result[0])
    }

    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  } catch (error) {
    console.error('PATCH fonds error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    // Un transfert coffre ↔ caisse est supprimé des deux côtés
    const row = await sql`SELECT transfer_id FROM fonds_entries WHERE id = ${parseInt(params.id)}`
    const transferId = row[0]?.transfer_id as string | null | undefined
    if (transferId) {
      await sql`DELETE FROM fonds_entries WHERE transfer_id = ${transferId}`
      await sql`DELETE FROM coffre_entries WHERE transfer_id = ${transferId}`
    } else {
      await sql`DELETE FROM fonds_entries WHERE id = ${parseInt(params.id)}`
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE fonds error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
