'use client'
// Sélecteur de période (du … au …) commun aux listes d'opérations
import { useEffect, useState } from 'react'

export interface DateRange { from: string; to: string }
export const EMPTY_RANGE: DateRange = { from: '', to: '' }

export const rangeActive = (r: DateRange) => !!(r.from || r.to)
export const inRange = (date: string, r: DateRange) =>
  (!r.from || date >= r.from) && (!r.to || date <= r.to)

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
// Écran d'ordinateur (sur téléphone, le sélecteur reste replié)
const isWide = () => window.matchMedia('(min-width: 768px)').matches
const dmy = (d: string) => d.split('-').reverse().join('/')

export function rangeLabel(r: DateRange) {
  if (r.from && r.to) return `du ${dmy(r.from)} au ${dmy(r.to)}`
  if (r.from) return `depuis le ${dmy(r.from)}`
  if (r.to) return `jusqu'au ${dmy(r.to)}`
  return ''
}

function presets(): { label: string; range: DateRange }[] {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()
  return [
    { label: 'Ce mois', range: { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) } },
    { label: 'Mois dernier', range: { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) } },
    { label: 'Ce trimestre', range: { from: iso(new Date(y, Math.floor(m / 3) * 3, 1)), to: iso(new Date(y, Math.floor(m / 3) * 3 + 3, 0)) } },
    { label: 'Cette année', range: { from: `${y}-01-01`, to: `${y}-12-31` } },
  ]
}

// Champs « 📅 Du … au … » avec quelques raccourcis : toujours visibles sur ordinateur,
// repliés derrière un bouton « 📅 Dates » sur téléphone
export function DateRangeFilter({ value, onChange, color = 'var(--terracotta)' }: { value: DateRange; onChange: (r: DateRange) => void; color?: string }) {
  const active = rangeActive(value)
  const [open, setOpen] = useState(active)
  useEffect(() => {
    if (isWide()) setOpen(true)
  }, [])
  const input: React.CSSProperties = { width: 'auto', padding: '0.3rem 0.45rem', fontSize: '0.85rem' }
  const chip: React.CSSProperties = { background: 'white', border: '1px solid #ddd', borderRadius: '999px', padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem' }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{ ...chip, padding: '0.4rem 0.75rem', fontSize: '0.85rem', fontWeight: 600 }}>
        📅 Dates
      </button>
    )
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.85rem', padding: '0.25rem 0.5rem', border: `1px solid ${active ? color : '#ddd'}`, borderRadius: '0.5rem', background: active ? '#FFFBF7' : 'white' }}>
      📅 Du
      <input className="form-input" type="date" value={value.from} max={value.to || undefined} onChange={e => onChange({ ...value, from: e.target.value })} style={input} />
      au
      <input className="form-input" type="date" value={value.to} min={value.from || undefined} onChange={e => onChange({ ...value, to: e.target.value })} style={input} />
      {presets().map(p => <button key={p.label} type="button" onClick={() => onChange(p.range)} style={chip}>{p.label}</button>)}
      {(active || !isWide()) && (
        <button type="button" title="Retirer le filtre de dates" style={{ ...chip, color: '#888' }}
          onClick={() => { onChange(EMPTY_RANGE); if (!isWide()) setOpen(false) }}>✕</button>
      )}
    </span>
  )
}
