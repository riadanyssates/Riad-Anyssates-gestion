'use client'
// Relevés bancaires (Attijari, CMI, Amex) : dépôt, consultation et téléchargement
import { useCallback, useEffect, useRef, useState } from 'react'
import { openAttachment, dataUrlToBlob } from '@/lib/attachments'

export type StatementSource = 'attijari' | 'cmi' | 'amex'
export const STATEMENT_LABELS: Record<StatementSource, string> = { attijari: 'Attijari', cmi: 'CMI', amex: 'AMEX' }

interface Statement {
  id: number; source: string; period: string; filename: string
  mime: string | null; size: number | null; uploaded_by: string | null; created_at: string
}

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const monthLabel = (p: string) => `${MONTHS[parseInt(p.slice(5, 7), 10) - 1]} ${p.slice(0, 4)}`
const sizeLabel = (n: number | null) => !n ? '' : n > 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(n / 1000))} Ko`
// Limite de taille d'une requête sur Vercel (~4,5 Mo) : le fichier est envoyé encodé (+33 %)
const MAX_BYTES = 3_000_000

function previousMonth() {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('lecture'))
    r.readAsDataURL(file)
  })
}

export function StatementsPanel({ source }: { source: StatementSource }) {
  const [rows, setRows] = useState<Statement[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(previousMonth())
  const [busy, setBusy] = useState<number | 'upload' | null>(null)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const check = useStatementCheck()
  const canCheck = (s: Statement) => source === 'attijari' && /^(application\/pdf|image\/)/.test(s.mime || '')

  const reload = useCallback(async () => {
    setLoading(true)
    const r = await fetch(`/api/statements?source=${source}`, { cache: 'no-store' }).catch(() => null)
    const d = r && r.ok ? await r.json() : []
    setRows(Array.isArray(d) ? d : [])
    setLoading(false)
  }, [source])
  useEffect(() => { reload() }, [reload])

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 5000) }

  async function upload(file: File) {
    if (file.size > MAX_BYTES) { flash('Fichier trop lourd (3 Mo maximum) — enregistrez le relevé en PDF plus léger ou en plusieurs parties.'); return }
    setBusy('upload')
    try {
      const data = await readAsDataUrl(file)
      const r = await fetch('/api/statements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source, period, filename: file.name, file: data }) })
      if (!r.ok) throw new Error(String(r.status))
      const added: Statement = await r.json()
      flash(`✓ Relevé de ${monthLabel(period)} ajouté`)
      reload()
      // Relevé Attijari : contrôle automatique par rapport aux saisies du mois
      if (canCheck(added)) check.run(added.id)
    } catch {
      flash("Le relevé n'a pas pu être ajouté — réessayez.")
    }
    setBusy(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function fetchFile(s: Statement): Promise<string | null> {
    setBusy(s.id)
    const r = await fetch(`/api/statements/${s.id}`, { cache: 'no-store' }).catch(() => null)
    const d = r && r.ok ? await r.json() : null
    setBusy(null)
    if (!d?.file_data) { flash("Impossible d'ouvrir le relevé — réessayez."); return null }
    return d.file_data as string
  }

  async function view(s: Statement) {
    const data = await fetchFile(s)
    if (data) openAttachment(data)
  }

  async function download(s: Statement) {
    const data = await fetchFile(s)
    if (!data) return
    const url = URL.createObjectURL(dataUrlToBlob(data))
    const a = document.createElement('a')
    a.href = url; a.download = s.filename
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  async function remove(s: Statement) {
    if (!confirm(`Supprimer le relevé ${STATEMENT_LABELS[source]} de ${monthLabel(s.period)} (${s.filename}) ?`)) return
    setBusy(s.id)
    const r = await fetch(`/api/statements/${s.id}`, { method: 'DELETE' }).catch(() => null)
    setBusy(null)
    if (r && r.ok) reload(); else flash('Suppression impossible — réessayez.')
  }

  const btn: React.CSSProperties = { background: 'none', border: '1px solid #ddd', borderRadius: '0.35rem', padding: '0.2rem 0.55rem', cursor: 'pointer', fontSize: '0.78rem' }

  return (
    <div>
      <div className="card" style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <strong style={{ color: '#3730A3' }}>Ajouter un relevé {STATEMENT_LABELS[source]}</strong>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
          Mois
          <input className="form-input" type="month" value={period} onChange={e => setPeriod(e.target.value)} style={{ width: 'auto', padding: '0.3rem 0.5rem' }} />
        </label>
        <button className="btn-primary" disabled={busy === 'upload' || !period} onClick={() => fileRef.current?.click()} style={{ background: '#3730A3', fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}>
          {busy === 'upload' ? 'Envoi…' : '📤 Choisir le fichier'}
        </button>
        <input ref={fileRef} type="file" accept="application/pdf,image/*,.xlsx,.xls,.csv" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }} />
        <span style={{ fontSize: '0.75rem', color: '#888' }}>PDF, image, Excel ou CSV — 3 Mo maximum</span>
        {msg && <span style={{ fontSize: '0.8rem', fontWeight: 600, color: msg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{msg}</span>}
      </div>

      {loading ? <p>Chargement…</p> : rows.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: '#aaa', padding: '2rem' }}>
          Aucun relevé {STATEMENT_LABELS[source]} pour l&apos;instant.
        </div>
      ) : (
        <div className="table-scroll">
          <table className="table-dep">
            <thead>
              <tr><th>Mois</th><th>Fichier</th><th>Taille</th><th>Ajouté</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{monthLabel(s.period)}</td>
                  <td className="col-wrap">{s.filename}</td>
                  <td style={{ whiteSpace: 'nowrap', color: '#888', fontSize: '0.8rem' }}>{sizeLabel(s.size)}</td>
                  <td style={{ whiteSpace: 'nowrap', color: '#888', fontSize: '0.8rem' }}>
                    {new Date(s.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('fr-FR')}{s.uploaded_by ? ` · ${s.uploaded_by}` : ''}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button style={btn} disabled={busy === s.id} onClick={() => view(s)} title="Ouvrir le relevé">{busy === s.id ? '…' : '👁 Voir'}</button>
                      <button style={btn} disabled={busy === s.id} onClick={() => download(s)} title="Télécharger le relevé">⬇ Télécharger</button>
                      {canCheck(s) && <button style={{ ...btn, borderColor: '#3730A3', color: '#3730A3' }} disabled={check.checking !== null} onClick={() => check.run(s.id)} title="Comparer le relevé aux mouvements saisis dans l'application">{check.checking === s.id ? 'Contrôle…' : '🔍 Contrôler'}</button>}
                      <button style={{ ...btn, color: 'var(--red)', borderColor: '#fca5a5' }} disabled={busy === s.id} onClick={() => remove(s)} title="Supprimer le relevé">🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {check.checking !== null && !check.result && <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#3730A3' }}>🔍 Lecture du relevé et comparaison avec les saisies… (jusqu&apos;à une ou deux minutes)</p>}
      {check.error && <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--red)' }}>{check.error}</p>}
      {check.result && <CheckReportView data={check.result} onClose={check.clear} refreshing={check.checking !== null}
        onRefresh={() => { const s = rows.find(x => x.period === check.result!.period && canCheck(x)); if (s) check.run(s.id, true) }} />}
    </div>
  )
}

// ─── Onglet Comptable : relevés du mois des trois banques, réunis en un PDF ───

const SOURCES: StatementSource[] = ['attijari', 'cmi', 'amex']

export function StatementsMonthPanel() {
  const [period, setPeriod] = useState(previousMonth())
  const [rows, setRows] = useState<Statement[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [msg, setMsg] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    const r = await fetch(`/api/statements?period=${period}`, { cache: 'no-store' }).catch(() => null)
    const d = r && r.ok ? await r.json() : []
    setRows(Array.isArray(d) ? d : [])
    setLoading(false)
  }, [period])
  useEffect(() => { reload() }, [reload])

  function shift(delta: number) {
    const d = new Date(parseInt(period.slice(0, 4), 10), parseInt(period.slice(5, 7), 10) - 1 + delta, 1)
    setPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const isLast = period >= previousMonth()

  async function getData(s: Statement): Promise<string | null> {
    const r = await fetch(`/api/statements/${s.id}`, { cache: 'no-store' }).catch(() => null)
    const d = r && r.ok ? await r.json() : null
    return d?.file_data ?? null
  }

  async function exportPdf() {
    setExporting(true); setMsg('')
    try {
      const files = await Promise.all(rows.map(async s => ({ bank: STATEMENT_LABELS[s.source as StatementSource], filename: s.filename, data: await getData(s) })))
      const { buildStatementsPdf } = await import('@/lib/statements-pdf')
      const blob = await buildStatementsPdf(files, SOURCES.map(s => STATEMENT_LABELS[s]), monthLabel(period))
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `Relevés bancaires - ${monthLabel(period)}.pdf`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      console.error(err)
      setMsg('Erreur lors de la création du PDF — réessayez.')
    }
    setExporting(false)
  }

  async function open(s: Statement) {
    const d = await getData(s)
    if (d) openAttachment(d)
  }

  const check = useStatementCheck()
  const attijari = rows.find(r => r.source === 'attijari' && /^(application\/pdf|image\/)/.test(r.mime || ''))
  const missing = SOURCES.filter(src => !rows.some(r => r.source === src))
  const separate = rows.filter(r => !/^(application\/pdf|image\/(jpeg|png))/.test(r.mime || ''))

  return (
    <div>
      <div className="card" style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={() => shift(-1)} style={{ border: '1px solid #ddd', background: 'white', borderRadius: '0.4rem', padding: '0.3rem 0.65rem', cursor: 'pointer', fontWeight: 600 }}>‹</button>
          <span style={{ fontWeight: 700, minWidth: 140, textAlign: 'center' }}>{monthLabel(period)}</span>
          <button onClick={() => shift(1)} disabled={isLast} style={{ border: '1px solid #ddd', background: 'white', borderRadius: '0.4rem', padding: '0.3rem 0.65rem', cursor: isLast ? 'default' : 'pointer', opacity: isLast ? 0.4 : 1, fontWeight: 600 }}>›</button>
        </div>
        <button className="btn-primary" onClick={exportPdf} disabled={exporting || rows.length === 0} style={{ background: '#0F766E', fontSize: '0.85rem', padding: '0.4rem 0.9rem', opacity: rows.length === 0 ? 0.5 : 1 }}>
          {exporting ? 'Création du PDF…' : `📄 Exporter les relevés — ${monthLabel(period)}`}
        </button>
        {attijari && <button onClick={() => check.run(attijari.id)} disabled={check.checking !== null} style={{ border: '1px solid #3730A3', color: '#3730A3', background: 'white', borderRadius: '0.4rem', padding: '0.35rem 0.8rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>{check.checking !== null ? 'Contrôle…' : '🔍 Contrôler le relevé Attijari'}</button>}
        {missing.length > 0 && !loading && <span style={{ fontSize: '0.8rem', color: 'var(--red)', fontWeight: 600 }}>Manquant : {missing.map(s => STATEMENT_LABELS[s]).join(', ')}</span>}
        {msg && <span style={{ fontSize: '0.8rem', color: 'var(--red)' }}>{msg}</span>}
      </div>

      {loading ? <p>Chargement…</p> : (
        <div className="table-scroll">
          <table className="table-dep">
            <thead><tr><th>Banque</th><th>Relevé</th><th></th></tr></thead>
            <tbody>
              {SOURCES.map(src => {
                const mine = rows.filter(r => r.source === src)
                return (
                  <tr key={src}>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{STATEMENT_LABELS[src]}</td>
                    <td className="col-wrap">
                      {mine.length === 0
                        ? <span style={{ color: 'var(--red)', fontWeight: 600, fontSize: '0.85rem' }}>Manquant — à déposer dans Banque › Relevés {STATEMENT_LABELS[src]}</span>
                        : mine.map(s => <div key={s.id} style={{ fontSize: '0.85rem' }}>{s.filename} <span style={{ color: '#999' }}>· {sizeLabel(s.size)}</span></div>)}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {mine.map(s => (
                        <button key={s.id} onClick={() => open(s)} style={{ background: 'none', border: '1px solid #ddd', borderRadius: '0.35rem', padding: '0.2rem 0.55rem', cursor: 'pointer', fontSize: '0.78rem', marginRight: '0.3rem' }}>👁 Voir</button>
                      ))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {check.error && <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--red)' }}>{check.error}</p>}
      {check.result && attijari && <CheckReportView data={check.result} onClose={check.clear} refreshing={check.checking !== null} onRefresh={() => check.run(attijari.id, true)} />}
      {separate.length > 0 && (
        <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.75rem' }}>
          Les fichiers Excel / CSV ({separate.map(s => s.filename).join(', ')}) ne peuvent pas être mis dans le PDF : téléchargez-les depuis Banque et envoyez-les à part.
        </p>
      )}
    </div>
  )
}

// ─── Contrôle du relevé Attijari par rapport aux saisies ──────────────────────

interface CheckLine { date: string; label: string; debit: number; credit: number }
interface CheckMove { id: number; date: string; type: 'cb' | 'cash'; amount: number; payment: string | null; label: string }
interface CheckResult {
  period: string; lines: number
  report: {
    matched: number
    missingInApp: CheckLine[]
    missingOnStatement: CheckMove[]
    amountMismatch: { line: CheckLine; movement: CheckMove }[]
    totals: { statementDebit: number; appDebit: number; statementCredit: number; appCredit: number }
    cards: { statement: number; app: number; lines: CheckLine[] }
    balances: { opening: number; closing: number }
    bigDifference: boolean
  }
}

const money = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dmy = (d: string) => d.split('-').reverse().join('/')

export function useStatementCheck() {
  const [result, setResult] = useState<CheckResult | null>(null)
  const [checking, setChecking] = useState<number | null>(null)
  const [error, setError] = useState('')
  async function run(id: number, refresh = false) {
    setChecking(id); setError('')
    const r = await fetch(`/api/statements/${id}/check${refresh ? '?refresh=1' : ''}`, { method: 'POST' }).catch(() => null)
    const d = r ? await r.json().catch(() => null) : null
    setChecking(null)
    if (!r || !r.ok || !d?.report) { setError(d?.error || 'Le relevé n’a pas pu être contrôlé — réessayez.'); return }
    setResult(d)
  }
  return { result, checking, error, run, clear: () => setResult(null) }
}

function Section({ title, color, count, children }: { title: string; color: string; count: number; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: '0.9rem' }}>
      <div style={{ fontWeight: 700, color, fontSize: '0.9rem', marginBottom: '0.35rem' }}>{title} ({count})</div>
      {count === 0 ? <div style={{ fontSize: '0.8rem', color: '#999' }}>Rien à signaler.</div> : children}
    </div>
  )
}

export function CheckReportView({ data, onClose, onRefresh, refreshing }: { data: CheckResult; onClose: () => void; onRefresh: () => void; refreshing: boolean }) {
  const r = data.report
  const issues = r.missingInApp.length + r.missingOnStatement.length + r.amountMismatch.length
  const cell: React.CSSProperties = { padding: '0.3rem 0.5rem', borderBottom: '1px solid #eee', fontSize: '0.8rem' }
  const row = (cols: React.ReactNode[], key: React.Key) => <tr key={key}>{cols.map((c, i) => <td key={i} style={{ ...cell, textAlign: i === cols.length - 1 ? 'right' : 'left', whiteSpace: i === 0 || i === cols.length - 1 ? 'nowrap' : 'normal' }}>{c}</td>)}</tr>
  const diffLine = (label: string, statement: number, app: number) => {
    const diff = Math.round((statement - app) * 100) / 100
    return (
      <tr>
        <td style={cell}>{label}</td>
        <td style={{ ...cell, textAlign: 'right' }}>{money(statement)}</td>
        <td style={{ ...cell, textAlign: 'right' }}>{money(app)}</td>
        <td style={{ ...cell, textAlign: 'right', fontWeight: 700, color: Math.abs(diff) < 0.01 ? 'var(--green)' : 'var(--red)' }}>{Math.abs(diff) < 0.01 ? '✓' : money(diff)}</td>
      </tr>
    )
  }

  return (
    <div className="card" style={{ marginTop: '1rem', borderLeft: `4px solid ${issues === 0 && !r.bigDifference ? 'var(--green)' : 'var(--red)'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '1rem' }}>🔍 Contrôle du relevé Attijari — {monthLabel(data.period)}</strong>
        <span style={{ fontSize: '0.8rem', color: '#666' }}>{data.lines} opérations lues · {r.matched} retrouvées dans l&apos;application</span>
        <button onClick={onRefresh} disabled={refreshing} title="Relire le relevé (si la lecture semble incomplète)" style={{ marginLeft: 'auto', background: 'none', border: '1px solid #ddd', borderRadius: '0.35rem', padding: '0.2rem 0.55rem', cursor: 'pointer', fontSize: '0.75rem' }}>{refreshing ? 'Lecture…' : '↻ Relire'}</button>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#999' }}>×</button>
      </div>
      <p style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '0.4rem', color: issues === 0 && !r.bigDifference ? 'var(--green)' : 'var(--red)' }}>
        {issues === 0 && !r.bigDifference ? '✓ Tout correspond.' : `${issues} point${issues > 1 ? 's' : ''} à vérifier${r.bigDifference ? ' · grosse différence sur les totaux' : ''}`}
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
        <thead><tr>{['', 'Relevé', 'Application', 'Écart'].map((h, i) => <th key={i} style={{ ...cell, textAlign: i ? 'right' : 'left', color: '#888', fontWeight: 600 }}>{h}</th>)}</tr></thead>
        <tbody>
          {diffLine('Sorties (débits)', r.totals.statementDebit, r.totals.appDebit)}
          {diffLine('Entrées (virements, chèques…)', r.totals.statementCredit, r.totals.appCredit)}
          {diffLine('Remises cartes (CMI / Amex)', r.cards.statement, r.cards.app)}
        </tbody>
      </table>
      <p style={{ fontSize: '0.72rem', color: '#999', marginTop: '0.3rem' }}>
        Remises cartes : le relevé est comparé au total net des encaissements CB du mois (le CMI et Amex versent par lots). Solde du relevé : {money(r.balances.opening)} → {money(r.balances.closing)} MAD.
      </p>

      <Section title="Sur le relevé mais pas dans l’application (oublis ?)" color="var(--red)" count={r.missingInApp.length}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
          {r.missingInApp.map((l, i) => row([dmy(l.date), l.label, l.debit > 0 ? `− ${money(l.debit)}` : `+ ${money(l.credit)}`], i))}
        </tbody></table>
      </Section>
      <Section title="Montant différent entre le relevé et la saisie" color="#B45309" count={r.amountMismatch.length}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
          {r.amountMismatch.map(({ line, movement }, i) => row([
            dmy(line.date),
            <>{line.label}<span style={{ color: '#888' }}> — saisi : {movement.label} le {dmy(movement.date)}</span></>,
            <>relevé {money(line.debit || line.credit)} / saisi {money(movement.amount)}</>,
          ], i))}
        </tbody></table>
      </Section>
      <Section title="Dans l’application mais pas sur le relevé (erreur ou pas encore passé ?)" color="#1D4ED8" count={r.missingOnStatement.length}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
          {r.missingOnStatement.map(m => row([dmy(m.date), <>{m.label || '—'} <span style={{ color: '#888' }}>({m.payment})</span></>, m.type === 'cb' ? `− ${money(m.amount)}` : `+ ${money(m.amount)}`], m.id))}
        </tbody></table>
      </Section>
    </div>
  )
}
