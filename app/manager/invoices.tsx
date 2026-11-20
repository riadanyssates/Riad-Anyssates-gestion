'use client'
// Factures de vente (encaissements clients) et relevé trimestriel de la taxe de séjour
import { useEffect, useMemo, useState, useCallback } from 'react'
import type { Entry } from '@/types'
import { computeInvoice, entryGross, invoiceExtras, quarterOf, EXTRA_CATEGORIES, INVOICE_CATEGORIES, DEFAULT_TVA, DEFAULT_TAXE_SEJOUR_ENFANT, LODGING, QUARTER_LABELS, TAXE_LABEL, tvaOf, type Invoice, type TvaRates } from '@/lib/invoice'

const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u202F/g, '\u00A0') // espace insécable classique : la recherche Ctrl+F (Firefox) retrouve « 65 400 »
const label: React.CSSProperties = { display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }
const BROWN = '#8B4513'

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function downloadInvoice(inv: Invoice) {
  const { buildInvoicePdf } = await import('@/lib/invoice-pdf')
  saveBlob(await buildInvoicePdf(inv), `Facture ${inv.number}${inv.client_name ? ` - ${inv.client_name}` : ''}.pdf`)
}

// Factures et tarif de taxe de séjour, rechargeables après une création / modification
export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [taxRate, setTaxRate] = useState<number | null>(null)
  const [childRate, setChildRate] = useState(DEFAULT_TAXE_SEJOUR_ENFANT)
  const [tvaRates, setTvaRates] = useState<TvaRates>(DEFAULT_TVA)
  const reload = useCallback(async () => {
    const [inv, rate] = await Promise.all([
      fetch('/api/invoices', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('/api/settings/taxe-sejour', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
    ])
    setInvoices(Array.isArray(inv) ? inv : [])
    if (rate?.taxe_sejour_tarif !== undefined) setTaxRate(Number(rate.taxe_sejour_tarif))
    if (rate?.taxe_sejour_enfant !== undefined) setChildRate(Number(rate.taxe_sejour_enfant))
    if (rate?.tva_rates) setTvaRates(rate.tva_rates)
  }, [])
  useEffect(() => { reload() }, [reload])
  const byEntry = useMemo(() => {
    const m: Record<number, Invoice> = {}
    for (const i of invoices) if (i.entry_id && !i.cancelled) m[i.entry_id] = i
    return m
  }, [invoices])
  return { invoices, byEntry, taxRate, childRate, tvaRates, reload }
}

// ─── Saisie d'une facture (formulaire d'encaissement et fenêtre de modification) ──

export interface InvoiceDraft {
  clientName: string
  nights: string
  persons: string     // adultes
  children: string    // enfants de moins de 12 ans
  extras: { label: string; amount: string }[]
  amountMad: string   // encaissement en euros : montant facturé en dirhams
}

export const emptyDraft = (clientName = ''): InvoiceDraft => ({ clientName, nights: '', persons: '', children: '', extras: [], amountMad: '' })

// gross : montant payé en MAD, ou null si l'encaissement est en euros (montant saisi dans amountMad)
export function previewDraft(d: InvoiceDraft, gross: number | null, taxRate: number, childRate: number, rates?: TvaRates) {
  return computeInvoice({
    gross: gross ?? (parseFloat(d.amountMad) || 0), rates,
    nights: Number(d.nights), persons: Number(d.persons), children: Number(d.children), taxRate, childRate,
    extras: d.extras.map(e => ({ label: e.label, amount: parseFloat(e.amount) || 0 })),
  })
}

export function draftBody(d: InvoiceDraft) {
  return {
    client_name: d.clientName, nights: Number(d.nights) || 0, persons: Number(d.persons) || 0, children: Number(d.children) || 0,
    extras: d.extras.map(e => ({ label: e.label, amount: parseFloat(e.amount) || 0 })),
    amount_mad: parseFloat(d.amountMad) || undefined,
  }
}

export function InvoiceEditor({ draft, onChange, gross, taxRate, childRate, rates, autoFocus }: {
  draft: InvoiceDraft
  onChange: (d: InvoiceDraft) => void
  gross: number | null
  taxRate: number
  childRate: number
  rates: TvaRates
  autoFocus?: boolean
}) {
  const set = (patch: Partial<InvoiceDraft>) => onChange({ ...draft, ...patch })
  const setExtra = (i: number, patch: Partial<{ label: string; amount: string }>) =>
    set({ extras: draft.extras.map((e, k) => k === i ? { ...e, ...patch } : e) })
  const c = previewDraft(draft, gross, taxRate, childRate, rates)
  const tvaTag = (l: string) => <span style={{ color: '#999', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>TVA {String(tvaOf(l, rates)).replace('.', ',')} %</span>
  const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.625rem' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={label}>Client *</label>
          <input className="form-input" value={draft.clientName} onChange={e => set({ clientName: e.target.value })} placeholder="Nom du client" required autoFocus={autoFocus} />
        </div>
        <div>
          <label style={label}>Adultes</label>
          <input className="form-input" type="number" min="0" step="1" inputMode="numeric" value={draft.persons} onChange={e => set({ persons: e.target.value })} placeholder="0" />
        </div>
        <div>
          <label style={label}>Enfants (moins de 12 ans)</label>
          <input className="form-input" type="number" min="0" step="1" inputMode="numeric" value={draft.children} onChange={e => set({ children: e.target.value })} placeholder="0" />
        </div>
        <div>
          <label style={label}>Nombre de nuits</label>
          <input className="form-input" type="number" min="0" step="1" inputMode="numeric" value={draft.nights} onChange={e => set({ nights: e.target.value })} placeholder="0" />
        </div>
        {gross === null && (
          <div>
            <label style={label}>Montant facturé (MAD) *</label>
            <input className="form-input" type="number" min="0" step="0.01" value={draft.amountMad} onChange={e => set({ amountMad: e.target.value })} placeholder="Équivalent en dirhams" required />
          </div>
        )}
      </div>

      {/* Lignes de la facture */}
      <div style={{ background: 'white', border: '1px solid #EADBCB', borderRadius: '0.5rem', padding: '0.625rem 0.75rem', fontSize: '0.83rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <div style={row}>
          <span>{LODGING} <span style={{ color: '#999', fontSize: '0.75rem' }}>(le reste du montant)</span> {tvaTag(LODGING)}</span>
          <strong style={{ whiteSpace: 'nowrap', color: c.lodging < 0 ? 'var(--red)' : 'var(--text)' }}>{fmt(c.lodging)} MAD</strong>
        </div>
        {draft.extras.map((e, i) => (
          <div key={i} style={{ ...row, justifyContent: 'flex-start' }}>
            <select className="form-input" value={e.label} onChange={ev => setExtra(i, { label: ev.target.value })} style={{ width: 'auto', padding: '0.25rem 0.4rem' }}>
              {EXTRA_CATEGORIES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            {tvaTag(e.label)}
            <input className="form-input" type="number" min="0" step="0.01" value={e.amount} onChange={ev => setExtra(i, { amount: ev.target.value })} placeholder="Montant TTC" style={{ width: '8rem', padding: '0.25rem 0.4rem', marginLeft: 'auto' }} />
            <span style={{ fontSize: '0.75rem', color: '#888' }}>MAD</span>
            <button type="button" onClick={() => set({ extras: draft.extras.filter((_, k) => k !== i) })} title="Retirer la ligne" style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '1rem' }}>×</button>
          </div>
        ))}
        <button type="button" onClick={() => set({ extras: [...draft.extras, { label: EXTRA_CATEGORIES[0], amount: '' }] })}
          style={{ alignSelf: 'flex-start', background: 'none', border: '1px dashed #D9B99B', color: BROWN, borderRadius: '0.4rem', padding: '0.25rem 0.6rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
          + Ajouter une ligne (restauration, boissons, spa, transport, divers)
        </button>
        <div style={row}>
          <span>
            {TAXE_LABEL}
            <span style={{ display: 'block', color: '#999', fontSize: '0.72rem' }}>
              {c.nights} nuit{c.nights > 1 ? 's' : ''} × ({c.persons} adulte{c.persons > 1 ? 's' : ''} × {fmt(taxRate)}{c.children > 0 ? ` + ${c.children} enfant${c.children > 1 ? 's' : ''} × ${fmt(childRate)}` : ''}) MAD
            </span>
          </span>
          <strong style={{ color: BROWN, whiteSpace: 'nowrap' }}>{fmt(c.taxAmount)} MAD</strong>
        </div>
        {c.totalTVA > 0 && c.total > 0 && (
          <div style={{ ...row, color: '#666', fontSize: '0.78rem' }}>
            <span>dont TVA</span><span style={{ whiteSpace: 'nowrap' }}>{fmt(c.totalTVA)} MAD</span>
          </div>
        )}
        <div style={{ ...row, borderTop: '1px solid #EADBCB', paddingTop: '0.4rem', fontWeight: 700, color: BROWN, fontSize: '0.92rem' }}>
          <span>Total facture</span>
          <span style={{ whiteSpace: 'nowrap' }}>{c.total > 0 ? `${fmt(c.total)} MAD` : '—'}</span>
        </div>
        {c.total <= 0 && <span style={{ fontSize: '0.75rem', color: '#888' }}>{gross === null ? 'Indiquez le montant facturé en dirhams.' : 'Saisissez le montant total encaissé : la facture s’affichera ici.'}</span>}
        {c.lodging < 0 && c.total > 0 && <span style={{ color: 'var(--red)', fontWeight: 600, fontSize: '0.78rem' }}>La taxe de séjour et les lignes dépassent le montant encaissé.</span>}
      </div>
    </div>
  )
}

// ─── Fenêtre de création / modification d'une facture ─────────────────────────

export function InvoiceModal({ entry, invoice, taxRate, childRate, rates, onClose, onSaved }: {
  entry: Entry | null
  invoice: Invoice | null
  taxRate: number
  childRate: number
  rates: TvaRates
  onClose: () => void
  onSaved: (inv: Invoice | null) => void
}) {
  const [draft, setDraft] = useState<InvoiceDraft>(() => invoice ? {
    clientName: invoice.client_name ?? '', nights: String(invoice.nights), persons: String(invoice.persons), children: String(invoice.children || 0),
    extras: invoiceExtras(invoice).map(e => ({ label: e.label, amount: String(e.amount) })), amountMad: '',
  } : emptyDraft(entry?.supplier ?? ''))
  const [date, setDate] = useState(invoice?.date ?? entry?.date ?? new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const rate = invoice ? Number(invoice.tax_rate) : taxRate
  const cRate = invoice && Number(invoice.child_rate) > 0 ? Number(invoice.child_rate) : childRate
  const gross = invoice ? Number(invoice.amount_total) : entry && (entry.currency || 'MAD') !== 'EUR' ? entryGross(entry) : null
  const c = previewDraft(draft, gross, rate, cRate, rates)

  async function save(andDownload: boolean) {
    setSaving(true); setError('')
    const body = { entry_id: entry?.id, date, ...draftBody(draft) }
    const r = await fetch(invoice ? `/api/invoices/${invoice.id}` : '/api/invoices', {
      method: invoice ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    if (!r || !r.ok) { setError(d.error || 'Erreur — réessayez.'); setSaving(false); return }
    if (andDownload) await downloadInvoice(d as Invoice).catch(() => setError('Facture enregistrée, mais le PDF n’a pas pu être créé.'))
    setSaving(false)
    onSaved(d as Invoice)
  }

  async function remove() {
    if (!invoice || !confirm(`Supprimer la facture ${invoice.number} ?\n\nSa taxe de séjour ne sera plus comptée. Si d’autres factures ont été faites depuis, elle est annulée (son numéro reste, marqué « annulée »).`)) return
    setSaving(true); setError('')
    const r = await fetch(`/api/invoices/${invoice.id}`, { method: 'DELETE' }).catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    setSaving(false)
    if (!r || !r.ok) { setError(d.error || 'Erreur — réessayez.'); return }
    onSaved(null)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '1rem' }} onClick={onClose}>
      <div className="card" style={{ maxWidth: 500, width: '100%', maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: BROWN, marginBottom: '0.25rem' }}>
          {invoice ? `🧾 Facture ${invoice.number}` : '🧾 Nouvelle facture'}
        </h3>
        <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '1rem' }}>
          {invoice ? 'Le numéro reste inchangé.' : 'Le numéro est attribué automatiquement à l’enregistrement.'}
          {gross !== null && <> Montant encaissé : <strong>{fmt(gross)} MAD</strong>{entry?.payment ? ` (${entry.payment})` : ''}</>}
          {gross === null && entry && <> Encaissement de <strong>{fmt(entryGross(entry))} EUR</strong> : la facture est établie en dirhams.</>}
        </p>
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={label}>Date de la facture</label>
          <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ maxWidth: 200 }} />
        </div>
        <InvoiceEditor draft={draft} onChange={setDraft} gross={gross} taxRate={rate} childRate={cRate} rates={rates} autoFocus />

        {error && <p style={{ color: 'var(--red)', fontSize: '0.85rem', marginTop: '0.75rem' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Fermer</button>
          {invoice && <button onClick={remove} disabled={saving} title="Facture faite par erreur : elle sort de la taxe de séjour et du comptable" style={{ background: 'none', border: '1px solid #fca5a5', color: 'var(--red)', borderRadius: '0.5rem', padding: '0.4rem 0.7rem', cursor: 'pointer', fontSize: '0.8rem' }}>Supprimer</button>}
          {invoice && <button className="btn-secondary" onClick={() => save(false)} disabled={saving || !c.valid}>Enregistrer</button>}
          <button className="btn-primary" onClick={() => save(true)} disabled={saving || !c.valid || !draft.clientName.trim()} style={{ marginLeft: 'auto', background: BROWN }}>
            {saving ? 'Enregistrement…' : invoice ? '📄 Enregistrer et télécharger' : '📄 Créer la facture'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Relevé trimestriel de la taxe de séjour ──────────────────────────────────
// Taxe de séjour et taxe de promotion touristique = nuits × (adultes × 28 MAD + enfants de moins de 12 ans × 18 MAD)

export function TaxeSejourPanel() {
  const { invoices, taxRate, childRate, tvaRates, reload } = useInvoices()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1)
  const [rateInput, setRateInput] = useState('')
  const [childInput, setChildInput] = useState('')
  const [rateMsg, setRateMsg] = useState('')
  const [exporting, setExporting] = useState(false)
  const [editing, setEditing] = useState<Invoice | null>(null)

  useEffect(() => { if (taxRate !== null) setRateInput(String(taxRate)) }, [taxRate])
  useEffect(() => { setChildInput(String(childRate)) }, [childRate])

  const rows = useMemo(() => invoices
    .filter(i => !i.cancelled && Number(i.tax_amount) > 0 && Number(i.date.substring(0, 4)) === year && quarterOf(i.date) === quarter)
    .sort((a, b) => a.date.localeCompare(b.date) || a.seq - b.seq), [invoices, year, quarter])
  const adults = rows.reduce((t, i) => t + i.persons, 0)
  const children = rows.reduce((t, i) => t + (i.children || 0), 0)
  const nuitees = rows.reduce((t, i) => t + i.nights * (i.persons + (i.children || 0)), 0)
  const taxTotals = rows.reduce<Record<string, number>>((t, i) => {
    const c = i.tax_currency || 'MAD'
    t[c] = (t[c] || 0) + Number(i.tax_amount)
    return t
  }, {})
  const taxTotalLabel = Object.keys(taxTotals).length
    ? Object.entries(taxTotals).map(([c, v]) => `${fmt(v)} ${c}`).join(' + ')
    : `${fmt(0)} MAD`

  function shiftQuarter(d: number) {
    let q = quarter + d, y = year
    if (q < 1) { q = 4; y-- } else if (q > 4) { q = 1; y++ }
    setQuarter(q); setYear(y)
  }
  const isCurrent = year === now.getFullYear() && quarter === Math.floor(now.getMonth() / 3) + 1
  const settingsChanged = taxRate !== null && (rateInput !== String(taxRate) || childInput !== String(childRate))

  async function saveRate() {
    setRateMsg('')
    const r = await fetch('/api/settings/taxe-sejour', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taxe_sejour_tarif: rateInput, taxe_sejour_enfant: childInput }) }).catch(() => null)
    setRateMsg(r && r.ok ? '✓ Tarif enregistré (nouvelles factures)' : 'Tarif invalide')
    if (r && r.ok) reload()
    setTimeout(() => setRateMsg(''), 4000)
  }

  async function exportPdf() {
    setExporting(true)
    try {
      const { buildTaxeSejourPdf } = await import('@/lib/invoice-pdf')
      saveBlob(await buildTaxeSejourPdf(rows, year, quarter), `Taxe de séjour et TPT - T${quarter} ${year}.pdf`)
    } catch (err) { console.error(err) }
    setExporting(false)
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={() => shiftQuarter(-1)} style={{ border: '1px solid #ddd', background: 'white', borderRadius: '0.4rem', padding: '0.3rem 0.65rem', cursor: 'pointer', fontWeight: 600 }}>‹</button>
          <span style={{ fontWeight: 700, minWidth: 230, textAlign: 'center' }}>{QUARTER_LABELS[quarter]} {year}</span>
          <button onClick={() => shiftQuarter(1)} disabled={isCurrent} style={{ border: '1px solid #ddd', background: 'white', borderRadius: '0.4rem', padding: '0.3rem 0.65rem', cursor: isCurrent ? 'default' : 'pointer', opacity: isCurrent ? 0.4 : 1, fontWeight: 600 }}>›</button>
        </div>
        <button className="btn-primary" onClick={exportPdf} disabled={exporting || rows.length === 0} style={{ background: '#8B4513', fontSize: '0.85rem', padding: '0.4rem 0.9rem', opacity: rows.length === 0 ? 0.5 : 1 }}>
          {exporting ? 'Création…' : '📄 Relevé PDF'}
        </button>
        <a href={rows.length ? `/api/export/taxe-sejour?year=${year}&quarter=${quarter}` : undefined} className="btn-secondary" style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem', textDecoration: 'none', opacity: rows.length === 0 ? 0.5 : 1, pointerEvents: rows.length === 0 ? 'none' : 'auto' }}>📊 Excel</a>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#666', flexWrap: 'wrap' }}>
          Tarif par nuit : adulte
          <input className="form-input" type="number" min="0" step="0.5" value={rateInput} onChange={e => setRateInput(e.target.value)} style={{ width: '4.5rem', padding: '0.25rem 0.4rem' }} />
          enfant (- 12 ans)
          <input className="form-input" type="number" min="0" step="0.5" value={childInput} onChange={e => setChildInput(e.target.value)} style={{ width: '4.5rem', padding: '0.25rem 0.4rem' }} />
          MAD
          {settingsChanged && <button className="btn-secondary" onClick={saveRate} style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}>OK</button>}
          {rateMsg && <span style={{ color: rateMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{rateMsg}</span>}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        {[['Adultes', String(adults)], ['Enfants (- 12 ans)', String(children)], ['Nuitées (personnes × nuits)', String(nuitees)], ['Taxe à reverser', taxTotalLabel]].map(([l, v], i) => (
          <div key={l} className="card" style={{ padding: '0.75rem 1rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#888' }}>{l}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: i === 3 ? '#8B4513' : 'var(--text)' }}>{v}</div>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: '#aaa', padding: '2rem' }}>
          Aucune taxe de séjour sur ce trimestre.<br />
          <span style={{ fontSize: '0.8rem' }}>Créez la facture client en ajoutant un encaissement (bouton « 🧾 Créer une facture client ») avec le nombre d&apos;adultes, d&apos;enfants et de nuits.</span>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="table-dep">
            <thead>
              <tr><th>Date</th><th>N° facture</th><th>Client</th><th>Adultes</th><th>Enfants</th><th>Nuits</th><th>Nuitées</th><th>Taxe</th></tr>
            </thead>
            <tbody>
              {rows.map(i => (
                <tr key={i.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(i.date + 'T00:00:00').toLocaleDateString('fr-FR')}</td>
                  <td><button onClick={() => setEditing(i)} title="Ouvrir / corriger la facture" style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', padding: 0, font: 'inherit', fontWeight: 600 }}>{i.number}</button></td>
                  <td className="col-wrap">{i.client_name || '—'}</td>
                  <td>{i.persons}</td>
                  <td>{i.children || 0}</td>
                  <td>{i.nights}</td>
                  <td>{i.nights * (i.persons + (i.children || 0))}</td>
                  <td style={{ fontWeight: 600, color: '#8B4513', whiteSpace: 'nowrap' }}>{fmt(Number(i.tax_amount))} {i.tax_currency || 'MAD'}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700, background: '#FAF6F2' }}>
                <td colSpan={3}>Total du trimestre</td>
                <td>{adults}</td><td>{children}</td><td></td><td>{nuitees}</td>
                <td style={{ color: '#8B4513', whiteSpace: 'nowrap' }}>{taxTotalLabel}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {editing && taxRate !== null && (
        <InvoiceModal entry={null} invoice={editing} taxRate={taxRate} childRate={childRate} rates={tvaRates} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />
      )}
    </div>
  )
}

// ─── Taux de TVA par catégorie (factures de vente) ────────────────────────────

export function TvaRatesCard() {
  const { tvaRates, reload } = useInvoices()
  const [edit, setEdit] = useState<Record<string, string> | null>(null)
  const [msg, setMsg] = useState('')

  async function save() {
    if (!edit) return
    const body = Object.fromEntries(Object.entries(edit).map(([k, v]) => [k, parseFloat(v) || 0]))
    const r = await fetch('/api/settings/taxe-sejour', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tva_rates: body }) }).catch(() => null)
    if (r && r.ok) { setEdit(null); setMsg('✓ Taux enregistrés (nouvelles factures)'); reload() } else setMsg('Erreur — réessayez.')
    setTimeout(() => setMsg(''), 4000)
  }

  return (
    <div className="card" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem 1rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8rem' }}>
      <strong style={{ color: BROWN }}>TVA des factures :</strong>
      {INVOICE_CATEGORIES.map(c => (
        <span key={c.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}>
          {c.label}
          {edit ? (
            <><input className="form-input" type="number" min="0" max="100" step="0.5" value={edit[c.label]} onChange={e => setEdit({ ...edit, [c.label]: e.target.value })} style={{ width: '4rem', padding: '0.15rem 0.35rem' }} />%</>
          ) : <strong>{String(tvaRates[c.label]).replace('.', ',')} %</strong>}
        </span>
      ))}
      {edit
        ? <><button className="btn-primary" onClick={save} style={{ fontSize: '0.75rem', padding: '0.25rem 0.7rem', background: BROWN }}>Enregistrer</button><button className="btn-secondary" onClick={() => setEdit(null)} style={{ fontSize: '0.75rem', padding: '0.25rem 0.7rem' }}>Annuler</button></>
        : <button className="btn-secondary" onClick={() => setEdit(Object.fromEntries(INVOICE_CATEGORIES.map(c => [c.label, String(tvaRates[c.label])])))} style={{ fontSize: '0.75rem', padding: '0.25rem 0.7rem', marginLeft: 'auto' }}>Modifier</button>}
      {msg && <span style={{ color: msg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{msg}</span>}
    </div>
  )
}
