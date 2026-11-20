'use client'
// Onglet « À payer » : fournisseurs du riad.
//  - NDT, Renaisens : une facture par mois
//  - Elite Food, Berghout : un bon à chaque commande, puis une facture de fin de mois rapprochée des bons
//  - artisans / autres : factures ponctuelles
// Le règlement d'une facture crée la dépense correspondante.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { openAttachment, fileToDataUrl } from '@/lib/attachments'
import { PAYABLE_SUPPLIERS, PAYABLE_OTHER_CATEGORY, payableCategory, supplierMode, type Payable } from '@/lib/payables'
import { DateRangeFilter, EMPTY_RANGE, inRange, rangeActive, type DateRange } from './date-range'

const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u202F/g, '\u00A0') // espace insécable classique : la recherche Ctrl+F (Firefox) retrouve « 65 400 »
const dmy = (d: string | null) => (d ? d.split('-').reverse().join('/') : '')
const today = () => new Date().toISOString().slice(0, 10)
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const monthLabel = (p: string | null) => (p ? `${MONTHS[parseInt(p.slice(5, 7), 10) - 1]} ${p.slice(0, 4)}` : '')
function shiftMonth(p: string, delta: number) {
  const d = new Date(parseInt(p.slice(0, 4), 10), parseInt(p.slice(5, 7), 10) - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const previousMonth = () => shiftMonth(today().slice(0, 7), -1)
const CATEGORIES = ['Prestataire', 'Nourriture', 'Spa', 'Travaux', 'Aménagement/Déco', 'Entretien', 'Livraison/Carrossa', 'Administratif', 'Divers']
const PAYMENTS = ['Virement', 'Chèque', 'Espèces', 'CB', 'Prélèvement']
const BON_SUPPLIERS = PAYABLE_SUPPLIERS.filter(s => s.mode === 'bons')
const OTHER = '__autre__'
const LIBRE = 'Libre (artisans…)'
const MAX_BYTES = 3_000_000
const amountMad = (r: Payable) => (r.currency === 'MAD' ? Number(r.amount) : 0)
// Déjà payé (acomptes) et reste à payer d'une facture
const paidOf = (r: Payable) => (r.payments || []).reduce((s, x) => s + Number(x.amount), 0)
const remainingOf = (r: Payable) => Math.max(0, Math.round((Number(r.amount) - paidOf(r)) * 100) / 100)
const remainingMad = (r: Payable) => (r.currency === 'MAD' ? remainingOf(r) : 0)

type View = 'factures' | 'bons' | 'rapprochement'

interface Draft {
  id?: number
  kind: 'facture' | 'bon'
  pick: string        // fournisseur habituel ou OTHER
  other: string       // nom libre (artisan…)
  category: string
  date: string
  period: string
  due_date: string
  reference: string
  description: string
  notes: string
  amount: string
  currency: string
  file: File | null
  bonIds: number[] | null  // bons repris par la facture (null : tous ceux du mois non facturés)
}

const emptyDraft = (kind: 'facture' | 'bon', supplier?: string): Draft => {
  const s = PAYABLE_SUPPLIERS.find(x => x.name === supplier) ?? (kind === 'bon' ? BON_SUPPLIERS[0] : PAYABLE_SUPPLIERS[0])
  return {
    kind, pick: s.name, other: '', category: s.category, date: today(),
    period: kind === 'bon' ? today().slice(0, 7) : previousMonth(),
    due_date: '', reference: '', description: '', notes: '', amount: '', currency: 'MAD', file: null, bonIds: null,
  }
}

const supplierOf = (d: Draft) => (d.pick === OTHER ? d.other.trim() : d.pick)
const isKnown = (s: string) => PAYABLE_SUPPLIERS.some(p => p.name === s)

export default function PayablesTab() {
  const [rows, setRows] = useState<Payable[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('factures')
  const [msg, setMsg] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [payFor, setPayFor] = useState<Payable | null>(null)
  const [payDate, setPayDate] = useState(today())
  const [payMode, setPayMode] = useState('Virement')
  const [payLoc, setPayLoc] = useState<'coffre' | 'fonds'>('coffre')
  const [payAmount, setPayAmount] = useState('')
  const [filterSupplier, setFilterSupplier] = useState('')
  const [filterStatus, setFilterStatus] = useState<'todo' | 'paid' | ''>('todo')
  const [range, setRange] = useState<DateRange>(EMPTY_RANGE)
  const [recMonth, setRecMonth] = useState(previousMonth())
  const fileRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLDivElement>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/payables').then(r => r.json()).catch(() => [])
    setRows(Array.isArray(r) ? r : [])
    setLoading(false)
  }, [])
  useEffect(() => { reload() }, [reload])

  const factures = useMemo(() => rows.filter(r => r.kind !== 'bon'), [rows])
  const bons = useMemo(() => rows.filter(r => r.kind === 'bon'), [rows])
  const byId = useMemo(() => new Map(rows.map(r => [r.id, r])), [rows])

  // Fournisseurs libres déjà utilisés (artisans…), proposés à la saisie
  const otherNames = useMemo(() => Array.from(new Set(factures.map(r => r.supplier).filter(s => !isKnown(s)))).sort(), [factures])
  const todayIso = today()
  const overdue = (p: Payable) => p.kind !== 'bon' && p.status === 'todo' && !!p.due_date && p.due_date < todayIso

  // Reste à payer par fournisseur (les artisans sont regroupés) et bons pas encore facturés
  const summary = useMemo(() => {
    const groups = [...PAYABLE_SUPPLIERS.map(s => s.name), LIBRE]
    return groups.map(g => {
      const match = (r: Payable) => (g === LIBRE ? !isKnown(r.supplier) : r.supplier === g)
      const items = factures.filter(r => r.status === 'todo' && match(r))
      const openBons = bons.filter(r => !r.invoice_id && match(r))
      return {
        name: g, count: items.length, total: items.reduce((s, r) => s + remainingMad(r), 0),
        late: items.some(overdue), bons: openBons.length, bonsTotal: openBons.reduce((s, r) => s + amountMad(r), 0),
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factures, bons])
  const totalTodo = summary.reduce((s, g) => s + g.total, 0)

  const matchSupplier = (r: Payable) => !filterSupplier || (filterSupplier === OTHER ? !isKnown(r.supplier) : r.supplier === filterSupplier)
  const shownFactures = factures.filter(r => (!filterStatus || r.status === filterStatus) && matchSupplier(r) && (!rangeActive(range) || inRange(r.date, range)))
  const shownBons = bons.filter(r => matchSupplier(r) && (!rangeActive(range) || inRange(r.date, range)))
  const shownTotal = (view === 'bons' ? shownBons : shownFactures).reduce((s, r) => s + amountMad(r), 0)

  // Bons proposés pour une facture de fin de mois : ceux du mois non encore facturés, plus ceux déjà repris par cette facture
  const candidateBons = (d: Draft) => {
    const supplier = supplierOf(d)
    return bons
      .filter(b => b.supplier === supplier && ((b.invoice_id && b.invoice_id === d.id) || (!b.invoice_id && (b.period || b.date.slice(0, 7)) === d.period)))
      .sort((a, b) => a.date.localeCompare(b.date))
  }
  const selectedBons = (d: Draft) => {
    const cands = candidateBons(d)
    return d.bonIds ? cands.filter(b => d.bonIds!.includes(b.id)) : cands
  }

  function openForm(d: Draft) {
    setDraft(d); setMsg('')
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  function edit(p: Payable) {
    openForm({
      id: p.id, kind: p.kind === 'bon' ? 'bon' : 'facture',
      pick: isKnown(p.supplier) ? p.supplier : OTHER, other: isKnown(p.supplier) ? '' : p.supplier,
      category: p.category || payableCategory(p.supplier), date: p.date, period: p.period || p.date.slice(0, 7), due_date: p.due_date || '',
      reference: p.reference || '', description: p.description || '', notes: p.notes || '', amount: String(p.amount), currency: p.currency || 'MAD', file: null,
      bonIds: p.kind === 'bon' ? null : bons.filter(b => b.invoice_id === p.id).map(b => b.id),
    })
  }

  async function save() {
    if (!draft) return
    const supplier = supplierOf(draft)
    if (!supplier) { setMsg('Indiquez le nom du fournisseur'); return }
    if (!(parseFloat(draft.amount) > 0)) { setMsg('Indiquez le montant'); return }
    if (draft.file && draft.file.size > MAX_BYTES && !draft.file.type.startsWith('image/')) { setMsg('Fichier trop lourd (3 Mo maximum)'); return }
    setSaving(true); setMsg('')
    try {
      const file = draft.file ? await fileToDataUrl(draft.file) : undefined
      const withBons = draft.kind === 'facture' && supplierMode(supplier) === 'bons'
      const body = {
        kind: draft.kind, supplier, category: draft.category, date: draft.date,
        period: draft.kind === 'bon' ? draft.date.slice(0, 7) : draft.period,
        due_date: draft.due_date || null, reference: draft.reference || null, description: draft.description || null, notes: draft.notes,
        amount: parseFloat(draft.amount), currency: draft.currency, file, filename: draft.file?.name,
        bon_ids: withBons ? selectedBons(draft).map(b => b.id) : undefined,
      }
      const r = await fetch(draft.id ? `/api/payables/${draft.id}` : '/api/payables', {
        method: draft.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Erreur')
      setMsg(`✓ ${draft.kind === 'bon' ? 'Bon' : 'Facture'} ${supplier} enregistré${draft.kind === 'bon' ? '' : 'e'}`)
      setDraft(null)
      await reload()
    } catch (e) { setMsg((e as Error).message) }
    setSaving(false)
  }

  async function pay() {
    if (!payFor) return
    setSaving(true)
    const r = await fetch(`/api/payables/${payFor.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pay: { date: payDate, payment: payMode, cash_location: payLoc, amount: parseFloat(payAmount) } }),
    }).catch(() => null)
    setSaving(false)
    if (!r?.ok) { setMsg((await r?.json().catch(() => ({})))?.error || 'Le règlement n\'a pas pu être enregistré'); return }
    const partial = parseFloat(payAmount) < remainingOf(payFor) - 0.01
    setMsg(`✓ ${payFor.supplier} : ${partial ? `acompte de ${fmt(parseFloat(payAmount))} enregistré, reste ${fmt(remainingOf(payFor) - parseFloat(payAmount))}` : 'réglé'} — la dépense a été ajoutée${payMode === 'Espèces' ? (payLoc === 'coffre' ? ' (coffre fort)' : ' (fond de caisse)') : ''}`)
    setPayFor(null)
    reload()
  }

  async function unpayOne(p: Payable, paymentId: number, amount: number) {
    if (!confirm(`Annuler le règlement de ${fmt(amount)} à ${p.supplier} ? La dépense correspondante sera supprimée.`)) return
    await fetch(`/api/payables/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unpay_payment: paymentId }) })
    reload()
  }

  async function remove(p: Payable) {
    const what = p.kind === 'bon' ? 'le bon' : 'la facture'
    if (!confirm(`Supprimer ${what} ${p.supplier}${p.reference ? ` n° ${p.reference}` : ''} ?`)) return
    const r = await fetch(`/api/payables/${p.id}`, { method: 'DELETE' })
    if (!r.ok) setMsg((await r.json().catch(() => ({}))).error || 'Erreur')
    reload()
  }

  async function view_(p: Payable) {
    const r = await fetch(`/api/payables/${p.id}`).then(r => r.json()).catch(() => null)
    if (r?.file) openAttachment(r.file)
  }

  // ── Rapprochement de fin de mois ──────────────────────────────────────────
  const reconciliation = useMemo(() => PAYABLE_SUPPLIERS.map(s => {
    const invs = factures.filter(f => f.supplier === s.name && (f.period || f.date.slice(0, 7)) === recMonth)
    const invoiced = invs.reduce((t, f) => t + amountMad(f), 0)
    if (s.mode === 'mensuel') return { ...s, invs, invoiced, monthBons: [] as Payable[], bonsTotal: 0, linkedTotal: 0, unbilled: [] as Payable[] }
    const monthBons = bons.filter(b => b.supplier === s.name && (b.period || b.date.slice(0, 7)) === recMonth)
    const linked = bons.filter(b => b.invoice_id && invs.some(f => f.id === b.invoice_id))
    return {
      ...s, invs, invoiced, monthBons,
      bonsTotal: monthBons.reduce((t, b) => t + amountMad(b), 0),
      linkedTotal: linked.reduce((t, b) => t + amountMad(b), 0),
      unbilled: monthBons.filter(b => !b.invoice_id),
    }
  }), [factures, bons, recMonth])

  const label: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }
  const chip = (active: boolean): React.CSSProperties => ({
    padding: '0.35rem 0.75rem', borderRadius: '999px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
    border: `1px solid ${active ? 'var(--terracotta)' : '#ddd'}`, background: active ? 'var(--terracotta)' : 'white', color: active ? 'white' : 'var(--text)',
  })
  const tab = (active: boolean): React.CSSProperties => ({
    padding: '0.5rem 0.9rem', border: 'none', borderBottom: `2px solid ${active ? 'var(--terracotta)' : 'transparent'}`,
    background: 'transparent', color: active ? 'var(--terracotta)' : 'var(--text)', fontWeight: active ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap',
  })

  const draftSupplier = draft ? supplierOf(draft) : ''
  const draftWithBons = !!draft && draft.kind === 'facture' && supplierMode(draftSupplier) === 'bons'
  const draftBonsTotal = draft && draftWithBons ? selectedBons(draft).reduce((t, b) => t + amountMad(b), 0) : 0
  const draftGap = draftWithBons ? (parseFloat(draft!.amount) || 0) - draftBonsTotal : 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>🧾 À payer</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn-secondary" style={{ whiteSpace: 'nowrap' }} onClick={() => openForm(emptyDraft('bon'))}>+ Bon de commande</button>
          <button className="btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={() => openForm(emptyDraft('facture'))}>+ Facture</button>
        </div>
      </div>

      {/* Reste à payer par fournisseur */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        {summary.map(g => {
          const key = g.name === LIBRE ? OTHER : g.name
          const active = filterSupplier === key
          return (
            <button key={g.name} type="button" className="stat-card" onClick={() => setFilterSupplier(active ? '' : key)}
              style={{ textAlign: 'left', cursor: 'pointer', border: active ? '2px solid var(--terracotta)' : undefined, background: 'white' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#888' }}>{g.name}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: g.total ? 'var(--terracotta)' : '#999' }}>{fmt(g.total)} DHS</div>
              <div style={{ fontSize: '0.75rem', color: g.late ? '#c0392b' : '#999' }}>
                {g.count ? `${g.count} facture${g.count > 1 ? 's' : ''} à payer${g.late ? ' · en retard' : ''}` : 'Rien à payer'}
              </div>
              {g.bons > 0 && <div style={{ fontSize: '0.75rem', color: '#B8860B' }}>{g.bons} bon{g.bons > 1 ? 's' : ''} non facturé{g.bons > 1 ? 's' : ''} · {fmt(g.bonsTotal)}</div>}
            </button>
          )
        })}
        <div className="stat-card" style={{ background: '#FFFBF7' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#888' }}>Total à payer</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{fmt(totalTodo)} DHS</div>
        </div>
      </div>

      {msg && <div style={{ marginBottom: '0.75rem', padding: '0.6rem 0.8rem', borderRadius: '0.5rem', background: msg.startsWith('✓') ? '#EAF7EE' : '#FDECEA', color: msg.startsWith('✓') ? '#1e7e34' : '#c0392b', fontSize: '0.85rem' }}>{msg}</div>}

      {draft && (
        <div ref={formRef} className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>
              {draft.kind === 'bon' ? (draft.id ? 'Modifier le bon de commande' : 'Nouveau bon de commande') : (draft.id ? 'Modifier la facture' : 'Nouvelle facture')}
            </h3>
            <button className="btn-secondary" onClick={() => setDraft(null)}>Annuler</button>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {(draft.kind === 'bon' ? BON_SUPPLIERS : PAYABLE_SUPPLIERS).map(s => (
              <button key={s.name} type="button" style={chip(draft.pick === s.name)} onClick={() => setDraft({ ...draft, pick: s.name, category: s.category, bonIds: null })}>{s.name}</button>
            ))}
            {draft.kind === 'facture' && (
              <button type="button" style={chip(draft.pick === OTHER)} onClick={() => setDraft({ ...draft, pick: OTHER, category: PAYABLE_OTHER_CATEGORY, bonIds: null })}>✏️ Libre (artisan, tapissier…)</button>
            )}
          </div>
          {draft.kind === 'facture' && supplierMode(draftSupplier) === 'mensuel' && (
            <p style={{ fontSize: '0.8rem', color: '#777', margin: '0 0 0.75rem' }}>{draftSupplier} facture une fois par mois : indiquez le mois concerné.</p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
            {draft.pick === OTHER && (
              <div>
                <label style={label}>Nom du fournisseur *</label>
                <input className="form-input" list="payable-others" value={draft.other} placeholder="ex : Menuisier Hassan" onChange={e => setDraft({ ...draft, other: e.target.value })} />
                <datalist id="payable-others">{otherNames.map(n => <option key={n} value={n} />)}</datalist>
              </div>
            )}
            {draft.kind === 'facture' && supplierMode(draftSupplier) && (
              <div>
                <label style={label}>Mois concerné</label>
                <input className="form-input" type="month" value={draft.period} onChange={e => setDraft({ ...draft, period: e.target.value, bonIds: null })} />
              </div>
            )}
            <div>
              <label style={label}>Montant *</label>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <input className="form-input" type="number" inputMode="decimal" step="0.01" value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })} />
                <select className="form-input" style={{ width: 'auto' }} value={draft.currency} onChange={e => setDraft({ ...draft, currency: e.target.value })}>
                  <option value="MAD">DHS</option><option value="EUR">€</option>
                </select>
              </div>
            </div>
            <div>
              <label style={label}>{draft.kind === 'bon' ? 'Date de la commande' : 'Date de la facture'}</label>
              <input className="form-input" type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} />
            </div>
            {draft.kind === 'facture' && (
              <div>
                <label style={label}>À payer avant le</label>
                <input className="form-input" type="date" value={draft.due_date} onChange={e => setDraft({ ...draft, due_date: e.target.value })} />
              </div>
            )}
            <div>
              <label style={label}>{draft.kind === 'bon' ? 'N° du bon' : 'N° de facture'}</label>
              <input className="form-input" value={draft.reference} onChange={e => setDraft({ ...draft, reference: e.target.value })} />
            </div>
            {draft.kind === 'facture' && (
              <div>
                <label style={label}>Catégorie</label>
                <select className="form-input" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <label style={label}>Description</label>
            <input className="form-input" value={draft.description} placeholder={draft.kind === 'bon' ? 'ex : légumes, viande…' : 'ex : excursions, soins spa…'} onChange={e => setDraft({ ...draft, description: e.target.value })} />
          </div>
          {draft.kind === 'facture' && (
            <div style={{ marginTop: '0.75rem' }}>
              <label style={label}>Notes libres</label>
              <textarea className="form-input" rows={2} value={draft.notes} placeholder="ex : acompte de 1 500 versé à la commande, solde à la livraison des coussins…" onChange={e => setDraft({ ...draft, notes: e.target.value })} />
            </div>
          )}

          {/* Facture de fin de mois : rapprochement avec les bons du mois */}
          {draftWithBons && (() => {
            const cands = candidateBons(draft)
            const sel = selectedBons(draft).map(b => b.id)
            return (
              <div style={{ marginTop: '0.75rem', border: '1px solid #EDE0D6', borderRadius: '0.5rem', padding: '0.75rem', background: '#FFFBF7' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem' }}>Bons de {draftSupplier} — {monthLabel(draft.period)}</div>
                {cands.length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: '#888' }}>Aucun bon saisi pour ce mois.</div>
                ) : (
                  <div style={{ display: 'grid', gap: '0.25rem', marginBottom: '0.5rem' }}>
                    {cands.map(b => (
                      <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={sel.includes(b.id)}
                          onChange={e => setDraft({ ...draft, bonIds: e.target.checked ? [...sel, b.id] : sel.filter(x => x !== b.id) })} />
                        <span style={{ minWidth: 80 }}>{dmy(b.date)}</span>
                        <span style={{ flex: 1 }}>{b.reference ? `n° ${b.reference}` : ''} {b.description || ''}</span>
                        <b>{fmt(Number(b.amount))}</b>
                      </label>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.85rem' }}>
                  <span>Total des bons : <b>{fmt(draftBonsTotal)} DHS</b></span>
                  <span>Facture : <b>{fmt(parseFloat(draft.amount) || 0)} DHS</b></span>
                  {draft.amount && (
                    Math.abs(draftGap) < 0.01
                      ? <span style={{ color: '#1e7e34', fontWeight: 700 }}>✓ Concordant</span>
                      : <span style={{ color: '#c0392b', fontWeight: 700 }}>⚠️ Écart {draftGap > 0 ? '+' : ''}{fmt(draftGap)} DHS</span>
                  )}
                  {cands.length > 0 && <button type="button" className="btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }} onClick={() => setDraft({ ...draft, amount: String(draftBonsTotal) })}>Reprendre le total des bons</button>}
                </div>
              </div>
            )
          })()}

          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => setDraft({ ...draft, file: e.target.files?.[0] || null })} />
            <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>📎 {draft.file ? draft.file.name : `Joindre ${draft.kind === 'bon' ? 'le bon' : 'la facture'} (photo ou PDF)`}</button>
            <button type="button" className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Enregistrement…' : draft.id ? 'Enregistrer' : 'Ajouter'}</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid #EDE0D6', marginBottom: '1rem', overflowX: 'auto' }}>
        <button style={tab(view === 'factures')} onClick={() => setView('factures')}>📄 Factures</button>
        <button style={tab(view === 'bons')} onClick={() => setView('bons')}>📦 Bons de commande</button>
        <button style={tab(view === 'rapprochement')} onClick={() => setView('rapprochement')}>⚖️ Rapprochement fin de mois</button>
      </div>

      {view !== 'rapprochement' && (
        <div className="card filters-bar" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {view === 'factures' && (
            <select className="form-input" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value as 'todo' | 'paid' | '')}>
              <option value="todo">À payer</option><option value="paid">Réglées</option><option value="">Toutes</option>
            </select>
          )}
          <select className="form-input" style={{ width: 'auto' }} value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}>
            <option value="">Tous les fournisseurs</option>
            {(view === 'bons' ? BON_SUPPLIERS : PAYABLE_SUPPLIERS).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
            {view === 'factures' && <option value={OTHER}>{LIBRE}</option>}
          </select>
          <DateRangeFilter value={range} onChange={setRange} />
          <span style={{ marginLeft: 'auto', fontSize: '0.85rem', fontWeight: 600 }}>
            {(view === 'bons' ? shownBons : shownFactures).length} {view === 'bons' ? 'bon' : 'facture'}{(view === 'bons' ? shownBons : shownFactures).length > 1 ? 's' : ''} · {fmt(shownTotal)} DHS
          </span>
        </div>
      )}

      {view === 'factures' && (
        <div className="card table-scroll" style={{ padding: 0 }}>
          {loading ? <div style={{ padding: '1rem', color: '#888' }}>Chargement…</div> : shownFactures.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#888' }}>{filterStatus === 'todo' ? 'Aucune facture à payer 🎉' : 'Aucune facture'}</div>
          ) : (
            <table className="table-dep" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#FAF6F2', textAlign: 'left' }}>
                  <th>Fournisseur</th><th>Mois</th><th>Date</th><th>N°</th><th className="col-wrap">Description</th><th>Échéance</th>
                  <th style={{ textAlign: 'right' }}>Montant</th><th>Statut</th><th></th>
                </tr>
              </thead>
              <tbody>
                {shownFactures.map(p => {
                  const linked = bons.filter(b => b.invoice_id === p.id)
                  const gap = Number(p.amount) - linked.reduce((t, b) => t + amountMad(b), 0)
                  return (
                    <tr key={p.id} style={{ borderTop: '1px solid #f0e8e0', background: overdue(p) ? '#FFF5F4' : undefined }}>
                      <td style={{ fontWeight: 600 }}>{p.supplier}<div style={{ fontSize: '0.7rem', color: '#999', fontWeight: 400 }}>{p.category}</div></td>
                      <td>{supplierMode(p.supplier) ? monthLabel(p.period) : '—'}</td>
                      <td>{dmy(p.date)}</td>
                      <td>{p.reference || '—'}</td>
                      <td className="col-wrap">
                        {p.description || ''}
                        {p.notes && <div style={{ fontSize: '0.75rem', color: '#666', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>📝 {p.notes}</div>}
                        {supplierMode(p.supplier) === 'bons' && (
                          <div style={{ fontSize: '0.75rem', color: linked.length && Math.abs(gap) < 0.01 ? '#1e7e34' : '#c0392b' }}>
                            {linked.length ? `${linked.length} bon${linked.length > 1 ? 's' : ''} · ${Math.abs(gap) < 0.01 ? '✓ concordant' : `⚠️ écart ${gap > 0 ? '+' : ''}${fmt(gap)}`}` : '⚠️ aucun bon rattaché'}
                          </div>
                        )}
                      </td>
                      <td style={{ color: overdue(p) ? '#c0392b' : undefined, fontWeight: overdue(p) ? 700 : undefined }}>{p.due_date ? dmy(p.due_date) : '—'}{overdue(p) && ' ⚠️'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(Number(p.amount))} {p.currency === 'EUR' ? '€' : 'DHS'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {p.status === 'paid'
                          ? <span style={{ color: '#1e7e34', fontWeight: 600 }}>✓ Réglée le {dmy(p.paid_date)}</span>
                          : p.payments?.length
                            ? <span style={{ color: '#B8860B', fontWeight: 600 }}>Acompte versé<div style={{ color: 'var(--terracotta)' }}>Reste {fmt(remainingOf(p))}</div></span>
                            : <span style={{ color: 'var(--terracotta)', fontWeight: 600 }}>À payer</span>}
                        {(p.payments || []).map(x => (
                          <div key={x.id} style={{ fontSize: '0.7rem', color: '#888', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            {dmy(x.date)} · {fmt(x.amount)} · {x.payment}
                            <button title="Annuler ce règlement" onClick={() => unpayOne(p, x.id, x.amount)} style={{ ...iconBtn, fontSize: '0.75rem', padding: 0 }}>↩️</button>
                          </div>
                        ))}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {!!p.has_file && <button title="Voir la facture" onClick={() => view_(p)} style={iconBtn}>📎</button>}
                        {p.status === 'todo'
                          ? <button className="btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => { setPayFor(p); setPayDate(today()); setPayMode('Virement'); setPayLoc('coffre'); setPayAmount(String(remainingOf(p))) }}>💸 {p.payments?.length ? 'Payer le solde' : 'Payer'}</button>
                          : null}
                        <button title="Modifier" onClick={() => edit(p)} style={iconBtn}>✏️</button>
                        {!p.payments?.length && <button title="Supprimer" onClick={() => remove(p)} style={iconBtn}>🗑️</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {view === 'bons' && (
        <div className="card table-scroll" style={{ padding: 0 }}>
          {loading ? <div style={{ padding: '1rem', color: '#888' }}>Chargement…</div> : shownBons.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#888' }}>Aucun bon de commande</div>
          ) : (
            <table className="table-dep" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#FAF6F2', textAlign: 'left' }}>
                  <th>Fournisseur</th><th>Date</th><th>N° du bon</th><th className="col-wrap">Description</th>
                  <th style={{ textAlign: 'right' }}>Montant</th><th>Facture</th><th></th>
                </tr>
              </thead>
              <tbody>
                {[...shownBons].sort((a, b) => b.date.localeCompare(a.date)).map(b => {
                  const inv = b.invoice_id ? byId.get(b.invoice_id) : null
                  return (
                    <tr key={b.id} style={{ borderTop: '1px solid #f0e8e0' }}>
                      <td style={{ fontWeight: 600 }}>{b.supplier}</td>
                      <td>{dmy(b.date)}</td>
                      <td>{b.reference || '—'}</td>
                      <td className="col-wrap">{b.description || ''}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(Number(b.amount))} {b.currency === 'EUR' ? '€' : 'DHS'}</td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                        {inv
                          ? <span style={{ color: '#1e7e34' }}>✓ Facture {monthLabel(inv.period)}{inv.reference ? ` n° ${inv.reference}` : ''}</span>
                          : <span style={{ color: '#B8860B' }}>Pas encore facturé</span>}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {!!b.has_file && <button title="Voir le bon" onClick={() => view_(b)} style={iconBtn}>📎</button>}
                        <button title="Modifier" onClick={() => edit(b)} style={iconBtn}>✏️</button>
                        <button title="Supprimer" onClick={() => remove(b)} style={iconBtn}>🗑️</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {view === 'rapprochement' && (
        <div>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <button className="btn-secondary" onClick={() => setRecMonth(shiftMonth(recMonth, -1))}>‹</button>
            <b style={{ minWidth: 150, textAlign: 'center', textTransform: 'capitalize' }}>{monthLabel(recMonth)}</b>
            <button className="btn-secondary" onClick={() => setRecMonth(shiftMonth(recMonth, 1))}>›</button>
            <span style={{ fontSize: '0.8rem', color: '#777' }}>Chaque fin de mois : la facture de chaque fournisseur est-elle arrivée, et correspond-elle aux bons ?</span>
          </div>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {reconciliation.map(r => {
              const missing = r.invs.length === 0
              const gap = r.invoiced - r.bonsTotal
              const ok = !missing && (r.mode === 'mensuel' || (Math.abs(gap) < 0.01 && r.unbilled.length === 0))
              return (
                <div key={r.name} className="card" style={{ borderLeft: `4px solid ${ok ? '#1e7e34' : missing ? '#B8860B' : '#c0392b'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div>
                      <b>{r.name}</b> <span style={{ fontSize: '0.75rem', color: '#888' }}>{r.mode === 'mensuel' ? 'facture mensuelle' : 'bons + facture de fin de mois'}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: ok ? '#1e7e34' : missing ? '#B8860B' : '#c0392b' }}>
                      {missing ? '⏳ Facture non saisie' : ok ? '✓ OK' : '⚠️ À vérifier'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.85rem', marginTop: '0.4rem' }}>
                    {r.mode === 'bons' && <span>Bons du mois : <b>{r.monthBons.length}</b> · <b>{fmt(r.bonsTotal)} DHS</b></span>}
                    <span>Facturé : <b>{missing ? '—' : `${fmt(r.invoiced)} DHS`}</b>{r.invs.some(f => f.status === 'paid') && <span style={{ color: '#1e7e34' }}> (réglé)</span>}</span>
                    {r.mode === 'bons' && !missing && <span style={{ color: Math.abs(gap) < 0.01 ? '#1e7e34' : '#c0392b', fontWeight: 700 }}>Écart : {gap > 0 ? '+' : ''}{fmt(gap)} DHS</span>}
                  </div>
                  {r.mode === 'bons' && r.unbilled.length > 0 && !missing && (
                    <div style={{ fontSize: '0.8rem', color: '#c0392b', marginTop: '0.4rem' }}>
                      Bons non repris dans la facture : {r.unbilled.map(b => `${dmy(b.date)}${b.reference ? ` n° ${b.reference}` : ''} (${fmt(Number(b.amount))})`).join(', ')}
                    </div>
                  )}
                  {missing && (
                    <button className="btn-primary" style={{ marginTop: '0.5rem', padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}
                      onClick={() => openForm({ ...emptyDraft('facture', r.name), period: recMonth })}>+ Saisir la facture de {monthLabel(recMonth)}</button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {payFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: 380 }}>
            <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>💸 Régler {payFor.supplier}{payFor.period && supplierMode(payFor.supplier) ? ` — ${monthLabel(payFor.period)}` : ''}</h3>
            <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.75rem' }}>
              Facture {fmt(Number(payFor.amount))} {payFor.currency === 'EUR' ? '€' : 'DHS'}
              {paidOf(payFor) > 0 && <> · déjà payé {fmt(paidOf(payFor))} · <b style={{ color: 'var(--terracotta)' }}>reste {fmt(remainingOf(payFor))}</b></>}
            </div>
            <label style={label}>Montant payé maintenant</label>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.25rem' }}>
              <input className="form-input" type="number" inputMode="decimal" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
              <button type="button" style={chip(Math.abs((parseFloat(payAmount) || 0) - remainingOf(payFor)) < 0.01)} onClick={() => setPayAmount(String(remainingOf(payFor)))}>Tout</button>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#B8860B', marginBottom: '0.75rem', minHeight: '1em' }}>
              {(parseFloat(payAmount) || 0) > 0 && (parseFloat(payAmount) || 0) < remainingOf(payFor) - 0.01 && `Acompte : il restera ${fmt(remainingOf(payFor) - parseFloat(payAmount))} à payer`}
            </div>
            <label style={label}>Date du règlement</label>
            <input className="form-input" type="date" value={payDate} onChange={e => setPayDate(e.target.value)} style={{ marginBottom: '0.75rem' }} />
            <label style={label}>Mode de paiement</label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {PAYMENTS.map(m => <button key={m} type="button" style={chip(payMode === m)} onClick={() => setPayMode(m)}>{m}</button>)}
            </div>
            {payMode === 'Espèces' && (
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
                <button type="button" style={chip(payLoc === 'coffre')} onClick={() => setPayLoc('coffre')}>🔐 Coffre fort</button>
                <button type="button" style={chip(payLoc === 'fonds')} onClick={() => setPayLoc('fonds')}>💰 Fond de caisse</button>
              </div>
            )}
            <p style={{ fontSize: '0.8rem', color: '#777', margin: '0 0 0.75rem' }}>
              La dépense sera ajoutée automatiquement dans Dépenses{payMode === 'Espèces' ? (payLoc === 'coffre' ? ' et le Coffre fort' : ' et le Fond de caisse') : ' et la Banque'}, avec la facture pour le comptable.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setPayFor(null)}>Annuler</button>
              <button className="btn-primary" disabled={saving || !(parseFloat(payAmount) > 0)} onClick={pay}>{saving ? '…' : 'Valider le règlement'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0.2rem 0.3rem' }
