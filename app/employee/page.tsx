'use client'
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Entry, FondsEntry } from '@/types'
import { Suspense } from 'react'
import { openAttachment } from '@/lib/attachments'
import EmployeeGuide from './guide'
import { DateRangeFilter, EMPTY_RANGE, inRange, type DateRange } from '../manager/date-range'
 
const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u202F/g, '\u00A0') // espace insécable classique : la recherche Ctrl+F (Firefox) retrouve « 65 400 »
 
const DEPENSES_CATEGORIES = ['Client','Commission','Administratif','Nourriture','Spa','Prestataire','Banque','Salaire','Maroc Telecom','Travaux','Aménagement/Déco','Entretien','Livraison/Carrossa','Radeema','Impôts','Divers']
const ENCAISSEMENTS_CATEGORIES = ['Client','Commission','Administratif','Nourriture','Spa','Prestataire','Banque','Salaire','Maroc Telecom','Travaux','Radeema','Impôts','Divers']
const FONDS_CATEGORIES = ['Client','Commission','Administratif','Nourriture','Spa','Prestataire','Salaire','Maroc Telecom','Travaux','Impôts','Divers']
// Employés : seulement CB ou espèces (virements et chèques sont saisis par les administrateurs)
const PAYMENT_MODES = ['CB', 'Espèces']
const CURRENCIES = ['MAD', 'EUR']
 
 
type Tab = 'cb' | 'cash' | 'fonds' | 'history'
 
interface EmployeeInfo { id: number; name: string; poste: string; is_manager?: number | boolean }
 
function EmployeeApp() {
  const searchParams = useSearchParams()
  const token = searchParams.get('emp')
  const [employee, setEmployee] = useState<EmployeeInfo | null>(null)
  const [authError, setAuthError] = useState('')
  const [tab, setTab] = useState<Tab>('cb')
  const [showGuide, setShowGuide] = useState(false)
 
  useEffect(() => {
    if (!token) { setAuthError('Lien invalide.'); return }
    fetch(`/api/employees/verify?token=${token}`)
      .then(r => r.json())
      .then(async data => {
        if (data.error) { setAuthError(data.error); return }
        // Employé avec accès manager (ex : Nicolas) : son lien ouvre l'interface manager
        if (data.is_manager) {
          const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
          if (r.ok) { window.location.replace('/manager'); return }
        }
        setEmployee(data)
      })
      .catch(() => setAuthError('Erreur de connexion.'))
  }, [token])
 
  if (authError) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="card" style={{ textAlign: 'center', maxWidth: 320 }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
        <p style={{ color: 'var(--red)', fontWeight: 600 }}>{authError}</p>
        <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.5rem' }}>Contactez votre manager pour obtenir votre lien.</p>
      </div>
    </div>
  )
 
  if (!employee) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--terracotta)' }}>Chargement…</div>
    </div>
  )
 
  const tabs: { id: Tab; label: string }[] = [
    { id: 'cb', label: '💳 Dépense' },
    { id: 'cash', label: '💵 Encaissement' },
    { id: 'fonds', label: '💰 Fond de caisse' },
    { id: 'history', label: '📋 Mon historique' },
  ]
 
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header className="emp-header" style={{ background: 'var(--terracotta)', color: 'white', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
        <div style={{ fontWeight: 700 }}>🏨 Riad Anyssates</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button onClick={() => setShowGuide(true)} style={{ background: 'rgba(255,255,255,0.18)', color: 'white', border: '1px solid rgba(255,255,255,0.45)', borderRadius: '0.4rem', padding: '0.3rem 0.6rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>📖 Mode d&apos;emploi</button>
          <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>{employee.name}</div>
        </div>
      </header>
      {showGuide && <EmployeeGuide onClose={() => setShowGuide(false)} />}
      <div style={{ background: 'white', borderBottom: '1px solid #EDE0D6', padding: '0 1rem', display: 'flex', gap: '0.25rem', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '0.75rem 0.875rem', border: 'none', borderBottom: tab === t.id ? '2px solid var(--terracotta)' : '2px solid transparent', background: 'transparent', color: tab === t.id ? 'var(--terracotta)' : 'var(--text)', fontWeight: tab === t.id ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>
      <main style={{ padding: '1.5rem', maxWidth: 640, margin: '0 auto' }}>
        {tab === 'cb' && <DepenseForm token={token!} />}
        {tab === 'cash' && <EncaissementForm token={token!} />}
        {tab === 'fonds' && <FondsCaisse token={token!} />}
        {tab === 'history' && <EmployeeHistory token={token!} />}
      </main>
    </div>
  )
}
 
// ─── Dépense Form (with mandatory invoice upload + split) ─────────────────────
 
interface SplitLine { id: number; category: string; amount: string }
 
function DepenseForm({ token }: { token: string }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('MAD')
  const [category, setCategory] = useState(DEPENSES_CATEGORIES[0])
  const [supplier, setSupplier] = useState('')
  const [payment, setPayment] = useState(PAYMENT_MODES[0])
  const [description, setDescription] = useState('')
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [invoicePreview, setInvoicePreview] = useState<string | null>(null)
  const [amountHT, setAmountHT] = useState('')
  const [tvaRate, setTvaRate] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [dragCounter, setDragCounter] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const processInvoiceFileRef = useRef<(f: File) => void>((_f: File) => {})
 
  // Split feature
  const [splitMode, setSplitMode] = useState(false)
  const [splitLines, setSplitLines] = useState<SplitLine[]>([
    { id: 1, category: DEPENSES_CATEGORIES[0], amount: '' },
    { id: 2, category: DEPENSES_CATEGORIES[1], amount: '' },
  ])
  const splitTotal = splitLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
  const ticketTotal = parseFloat(amount) || 0
  const splitDiff = Math.abs(ticketTotal - splitTotal)
  const splitValid = ticketTotal > 0 && splitDiff < 0.01 && splitLines.every(l => parseFloat(l.amount) > 0)
 
  function addSplitLine() {
    setSplitLines(prev => [...prev, { id: Date.now(), category: DEPENSES_CATEGORIES[0], amount: '' }])
  }
  function removeSplitLine(id: number) {
    setSplitLines(prev => prev.filter(l => l.id !== id))
  }
  function updateSplitLine(id: number, field: 'category' | 'amount', value: string) {
    setSplitLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l))
  }
 
  async function processInvoiceFile(f: File) {
    setInvoiceFile(f)
    if (f.type.startsWith('image/')) setInvoicePreview(URL.createObjectURL(f))
    else setInvoicePreview(null)
    setExtracting(true)
    try {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('type', 'cb')
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 20000)
      const r = await fetch('/api/extract-invoice', { method: 'POST', body: fd, headers: { 'x-employee-token': token }, signal: ctrl.signal })
      clearTimeout(timer)
      if (r.ok) {
        const data = await r.json()
        if (data.date) setDate(data.date)
        if (data.supplier) setSupplier(data.supplier)
        if (data.amount_ttc) setAmount(String(data.amount_ttc))
        if (data.amount_ht) setAmountHT(String(data.amount_ht))
        if (data.tva_rate) setTvaRate(String(data.tva_rate))
        if (data.is_supermarche && Array.isArray(data.items) && data.items.length > 0) {
          setSplitMode(true)
          setSplitLines(data.items.map((item: { category: string; amount: number; label?: string }) => ({
            category: item.category,
            amount: String(item.amount),
            description: item.label || '',
          })))
        }
      }
    } catch { /* silent */ }
    setExtracting(false)
  }
 
  processInvoiceFileRef.current = processInvoiceFile
 
  useEffect(() => {
    const el = dropZoneRef.current
    if (!el) return
    const onDragEnter = (e: DragEvent) => { e.preventDefault(); setDragCounter(c => c + 1) }
    const onDragOver = (e: DragEvent) => { e.preventDefault() }
    const onDragLeave = (e: DragEvent) => { e.preventDefault(); setDragCounter(c => Math.max(0, c - 1)) }
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragCounter(0)
      const f = e.dataTransfer?.files[0]
      if (f) processInvoiceFileRef.current(f)
    }
    el.addEventListener('dragenter', onDragEnter)
    el.addEventListener('dragover', onDragOver)
    el.addEventListener('dragleave', onDragLeave)
    el.addEventListener('drop', onDrop)
    return () => {
      el.removeEventListener('dragenter', onDragEnter)
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('dragleave', onDragLeave)
      el.removeEventListener('drop', onDrop)
    }
  }, [])
 
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) processInvoiceFile(f)
  }
 
  async function fileToBase64(file: File): Promise<string> {
    if (file.type.startsWith('image/')) {
      return new Promise((resolve, reject) => {
        const img = new Image()
        const url = URL.createObjectURL(file)
        img.onload = () => {
          const maxW = 1200
          const scale = Math.min(1, maxW / img.width)
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(img.width * scale)
          canvas.height = Math.round(img.height * scale)
          canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
          URL.revokeObjectURL(url)
          resolve(canvas.toDataURL('image/jpeg', 0.75))
        }
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Erreur image')) }
        img.src = url
      })
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Erreur lecture fichier'))
      reader.readAsDataURL(file)
    })
  }
 
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess('')
 
    if (!invoiceFile && payment !== 'Espèces') { setError('La facture est obligatoire.'); return }
    if (splitMode && !splitValid) { setError(`La somme des lignes (${fmt(splitTotal)}) doit égaler le total du ticket (${amount}).`); return }
 
    let invoice_url: string | undefined
    if (invoiceFile) {
      setUploading(true)
      try {
        invoice_url = await fileToBase64(invoiceFile)
      } catch (err) {
        setError((err as Error).message || 'Erreur traitement facture.')
        setUploading(false); return
      }
      setUploading(false)
    }
    setSubmitting(true)
 
    try {
      if (splitMode) {
        // Create one entry per split line
        const results = await Promise.all(splitLines.map(line =>
          fetch('/api/entries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'cb', date, amount: parseFloat(line.amount), currency, category: line.category, supplier, payment, description: `${description ? description + ' — ' : ''}Ticket ventilé`, invoice_url, token }),
          })
        ))
        if (results.every(r => r.ok)) {
          setSuccess(`Ticket ventilé en ${splitLines.length} postes ✓`)
          setAmount(''); setSupplier(''); setDescription(''); setInvoiceFile(null); setInvoicePreview(null)
          setCategory(DEPENSES_CATEGORIES[0]); setPayment(PAYMENT_MODES[0]); setCurrency('MAD')
          setDate(new Date().toISOString().split('T')[0]); setSplitMode(false)
          setSplitLines([{ id: 1, category: DEPENSES_CATEGORIES[0], amount: '' }, { id: 2, category: DEPENSES_CATEGORIES[1], amount: '' }])
          if (fileRef.current) fileRef.current.value = ''
        } else { setError('Erreur lors de la création des lignes.') }
      } else {
        const r = await fetch('/api/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'cb', date, amount: parseFloat(amount), currency, category, supplier, payment, description, invoice_url, token, amount_ht: amountHT ? parseFloat(amountHT) : null, tva_rate: tvaRate ? parseFloat(tvaRate) : null }),
        })
        if (r.ok) {
          setSuccess('Dépense enregistrée avec succès !')
          setAmount(''); setAmountHT(''); setTvaRate(''); setSupplier(''); setDescription(''); setInvoiceFile(null); setInvoicePreview(null)
          setCategory(DEPENSES_CATEGORIES[0]); setPayment(PAYMENT_MODES[0]); setCurrency('MAD')
          setDate(new Date().toISOString().split('T')[0])
          if (fileRef.current) fileRef.current.value = ''
        } else { const d = await r.json(); setError(d.error || 'Erreur.') }
      }
    } catch { setError('Erreur de connexion.') }
    setSubmitting(false)
  }
 
  return (
    <div className="card">
      <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1.25rem', color: 'var(--terracotta)' }}>💳 Nouvelle dépense</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {/* Mandatory invoice upload */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            Facture {payment !== 'Espèces' && '* '}<span style={{ color: payment === 'Espèces' ? '#888' : 'var(--red)', fontWeight: 400 }}>({payment === 'Espèces' ? 'optionnel' : 'obligatoire'})</span>
          </label>
          <div
            ref={dropZoneRef}
            style={{ position: 'relative', border: `2px dashed ${dragCounter > 0 ? 'var(--terracotta)' : invoiceFile ? 'var(--green)' : '#ddd'}`, borderRadius: '0.5rem', padding: '1rem', textAlign: 'center', background: dragCounter > 0 ? '#FFF5F0' : invoiceFile ? '#F0FDF4' : '#FAFAFA', transition: 'all 0.15s' }}
          >
            {invoiceFile && !extracting && (
              <button type="button" onClick={e => { e.stopPropagation(); setInvoiceFile(null); setInvoicePreview(null); if (fileRef.current) fileRef.current.value = '' }} style={{ position: 'absolute', top: '0.35rem', left: '0.35rem', background: 'rgba(239,68,68,0.9)', border: 'none', borderRadius: '50%', width: '1.3rem', height: '1.3rem', color: 'white', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, lineHeight: 1, padding: 0 }}>×</button>
            )}
            {invoiceFile ? (
              <div onClick={() => fileRef.current?.click()} style={{ cursor: 'pointer' }}>
                {invoicePreview && <img src={invoicePreview} alt="Aperçu" style={{ maxHeight: 120, maxWidth: '100%', marginBottom: '0.5rem', borderRadius: '0.3rem' }} />}
                <div style={{ fontSize: '0.85rem', color: 'var(--green)', fontWeight: 600 }}>✓ {invoiceFile.name}</div>
                {extracting
                  ? <div style={{ fontSize: '0.75rem', color: 'var(--terracotta)', marginTop: '0.2rem' }}>⏳ Analyse en cours…</div>
                  : <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.2rem' }}>Cliquer ou glisser pour changer</div>
                }
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{dragCounter > 0 ? '⬇️' : '📄'}</div>
                <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.75rem' }}>Glisser votre facture ici</div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                  <label style={{ padding: '0.5rem 0.875rem', background: '#FFF5F0', border: '1px solid var(--terracotta)', borderRadius: '0.5rem', color: 'var(--terracotta)', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                    📷 Photo
                    <input type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />
                  </label>
                  <label style={{ padding: '0.5rem 0.875rem', background: '#F8F8F8', border: '1px solid #ddd', borderRadius: '0.5rem', color: '#555', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                    📁 Fichier
                    <input type="file" accept="image/*,application/pdf" onChange={handleFile} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleFile} style={{ display: 'none' }} />
        </div>
 

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Date *</label>
          <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} required />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Mode de paiement</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {PAYMENT_MODES.map(p => (
              <button key={p} type="button" onClick={() => setPayment(p)} style={{ flex: 1, padding: '0.5rem', border: `2px solid ${payment === p ? 'var(--terracotta)' : '#ddd'}`, borderRadius: '0.5rem', background: payment === p ? '#FFF5F0' : 'white', fontWeight: payment === p ? 700 : 400, cursor: 'pointer', color: payment === p ? 'var(--terracotta)' : 'var(--text)', fontSize: '0.85rem' }}>{p === 'CB' ? '💳 CB' : p === 'Espèces' ? '💵 Espèces' : p}</button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Devise</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(['MAD', 'EUR'] as const).map(c => (
              <button key={c} type="button" onClick={() => setCurrency(c)} style={{ flex: 1, padding: '0.5rem', border: `2px solid ${currency === c ? 'var(--terracotta)' : '#ddd'}`, borderRadius: '0.5rem', background: currency === c ? '#FFF5F0' : 'white', fontWeight: currency === c ? 700 : 400, cursor: 'pointer', color: currency === c ? 'var(--terracotta)' : 'var(--text)' }}>{c}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '0.5rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Montant HT</label>
            <input className="form-input" type="number" step="0.01" min="0" value={amountHT} onChange={e => {
              setAmountHT(e.target.value)
              const ht = parseFloat(e.target.value)
              const tva = parseFloat(tvaRate)
              if (!isNaN(ht) && !isNaN(tva)) setAmount((ht * (1 + tva / 100)).toFixed(2))
            }} placeholder="0.00" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>TVA %</label>
            <input className="form-input" type="number" step="0.1" min="0" value={tvaRate} onChange={e => {
              setTvaRate(e.target.value)
              const ht = parseFloat(amountHT)
              const tva = parseFloat(e.target.value)
              if (!isNaN(ht) && !isNaN(tva)) setAmount((ht * (1 + tva / 100)).toFixed(2))
            }} placeholder="20" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Montant TTC *</label>
            <input className="form-input" type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Fournisseur / Lieu</label>
          <input className="form-input" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Nom du fournisseur" />
        </div>

        {!splitMode && (
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Catégorie *</label>
            <select className="form-input" value={category} onChange={e => setCategory(e.target.value)}>
              {DEPENSES_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {/* Split ticket toggle */}
        <div style={{ background: '#FFF5F0', border: '1px solid #FDDCCA', borderRadius: '0.5rem', padding: '0.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={splitMode} onChange={e => setSplitMode(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--terracotta)' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--terracotta)' }}>✂️ Ventiler ce ticket en plusieurs catégories</span>
          </label>
          {splitMode && (
            <div style={{ marginTop: '0.75rem' }}>
              <p style={{ fontSize: '0.78rem', color: '#888', marginBottom: '0.5rem' }}>Total ticket : <strong>{fmt(ticketTotal)} {currency}</strong> — Répartissez le montant ci-dessous :</p>
              {splitLines.map((line, idx) => (
                <div key={line.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <select className="form-input" value={line.category} onChange={e => updateSplitLine(line.id, 'category', e.target.value)} style={{ flex: 2 }}>
                    {DEPENSES_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input className="form-input" type="number" step="0.01" min="0" value={line.amount} onChange={e => updateSplitLine(line.id, 'amount', e.target.value)} placeholder="0.00" style={{ flex: 1, minWidth: 80 }} />
                  {splitLines.length > 2 && (
                    <button type="button" onClick={() => removeSplitLine(line.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '1rem', padding: '0 0.2rem' }}>✕</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addSplitLine} style={{ fontSize: '0.8rem', color: 'var(--terracotta)', background: 'none', border: '1px dashed var(--terracotta)', borderRadius: '0.4rem', padding: '0.3rem 0.75rem', cursor: 'pointer', marginBottom: '0.5rem' }}>+ Ajouter une ligne</button>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: splitValid ? 'var(--green)' : (splitTotal > 0 ? 'var(--red)' : '#888') }}>
                Réparti : {fmt(splitTotal)} / {fmt(ticketTotal)} {currency}
                {splitValid && ' ✓'}
                {!splitValid && splitTotal > 0 && ` (différence : ${fmt(splitDiff)})`}
              </div>
            </div>
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Description</label>
          <textarea className="form-input" rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Notes optionnelles…" />
        </div>
 
        {extracting && <p style={{ color: '#888', fontSize: '0.8rem', textAlign: 'center' }}>🤖 Extraction IA en cours…</p>}
        {error && <p style={{ color: 'var(--red)', fontSize: '0.875rem' }}>{error}</p>}
        {success && <p style={{ color: 'var(--green)', fontSize: '0.875rem', fontWeight: 600 }}>{success}</p>}
 
        <button className="btn-primary" type="submit" disabled={uploading || submitting || extracting}>
          {extracting ? '🤖 Analyse facture…' : uploading ? '⬆️ Upload facture…' : submitting ? 'Envoi…' : 'Soumettre'}
        </button>
      </form>
    </div>
  )
}
 
// ─── Encaissement Form ─────────────────────────────────────────────────────────
 
function EncaissementForm({ token }: { token: string }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('MAD')
  const [category, setCategory] = useState(ENCAISSEMENTS_CATEGORIES[0])
  const [payment, setPayment] = useState(PAYMENT_MODES[0])
  const [description, setDescription] = useState('')
  const [ticketFile, setTicketFile] = useState<File | null>(null)
  const [ticketPreview, setTicketPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [dragCounter, setDragCounter] = useState(0)
  const [transactionAmount, setTransactionAmount] = useState('')
  const [clientName, setClientName] = useState('')
  const ticketRef = useRef<HTMLInputElement>(null)
  const ticketDropZoneRef = useRef<HTMLDivElement>(null)
  const processTicketFileRef = useRef<(f: File) => void>((_f: File) => {})
 
  async function processTicketFile(f: File) {
    setTicketFile(f)
    if (f.type.startsWith('image/')) setTicketPreview(URL.createObjectURL(f))
    else setTicketPreview(null)
    setExtracting(true)
    try {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('type', 'cash')
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 20000)
      const r = await fetch('/api/extract-invoice', { method: 'POST', body: fd, headers: { 'x-employee-token': token }, signal: ctrl.signal })
      clearTimeout(timer)
      if (r.ok) {
        const data = await r.json()
        if (data.date) setDate(data.date)
        if (data.amount_ttc) {
          if (payment === 'CB') {
            setTransactionAmount(String(data.amount_ttc))
            setAmount(String((data.amount_ttc * 0.97).toFixed(2)))
          } else {
            setAmount(String(data.amount_ttc))
          }
        }
      }
    } catch { /* silent */ }
    setExtracting(false)
  }
 
  processTicketFileRef.current = processTicketFile
 
  useEffect(() => {
    const el = ticketDropZoneRef.current
    if (!el) return
    const onDragEnter = (e: DragEvent) => { e.preventDefault(); setDragCounter(c => c + 1) }
    const onDragOver = (e: DragEvent) => { e.preventDefault() }
    const onDragLeave = (e: DragEvent) => { e.preventDefault(); setDragCounter(c => Math.max(0, c - 1)) }
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragCounter(0)
      const f = e.dataTransfer?.files[0]
      if (f) processTicketFileRef.current(f)
    }
    el.addEventListener('dragenter', onDragEnter)
    el.addEventListener('dragover', onDragOver)
    el.addEventListener('dragleave', onDragLeave)
    el.addEventListener('drop', onDrop)
    return () => {
      el.removeEventListener('dragenter', onDragEnter)
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('dragleave', onDragLeave)
      el.removeEventListener('drop', onDrop)
    }
  }, [])
 
  function handleTicket(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) processTicketFile(f)
  }
 
  async function fileToBase64(file: File): Promise<string> {
    if (file.type.startsWith('image/')) {
      return new Promise((resolve, reject) => {
        const img = new Image()
        const url = URL.createObjectURL(file)
        img.onload = () => {
          const maxW = 1200
          const scale = Math.min(1, maxW / img.width)
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(img.width * scale)
          canvas.height = Math.round(img.height * scale)
          canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
          URL.revokeObjectURL(url)
          resolve(canvas.toDataURL('image/jpeg', 0.75))
        }
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Erreur image')) }
        img.src = url
      })
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Erreur lecture fichier'))
      reader.readAsDataURL(file)
    })
  }
 
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess('')
 
    // For CB: use net amount (after 3% fees); for Espèces: use direct amount
    const finalAmount = payment === 'CB' && transactionAmount
      ? parseFloat(transactionAmount) * 0.97
      : parseFloat(amount)
    if (!finalAmount || isNaN(finalAmount)) { setError('Veuillez saisir un montant.'); return }
    if (!ticketFile && payment !== 'Espèces') { setError('Le ticket est obligatoire.'); return }
 
    let invoice_url: string | undefined
    if (ticketFile) {
      setUploading(true)
      try { invoice_url = await fileToBase64(ticketFile) }
      catch (err) { setError((err as Error).message || 'Erreur traitement ticket.'); setUploading(false); return }
      setUploading(false)
    }
 
    const extraFields = payment === 'CB' && transactionAmount
      ? { amount_ht: parseFloat(transactionAmount), tva_rate: 3 }
      : {}
 
    setSubmitting(true)
    try {
      const r = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'cash', date, amount: finalAmount, currency, category, payment, description, invoice_url, token, supplier: clientName || null, ...extraFields }),
      })
      if (r.ok) {
        setSuccess('Encaissement enregistré !')
        setAmount(''); setTransactionAmount(''); setDescription('')
        setClientName('')
        setCategory(ENCAISSEMENTS_CATEGORIES[0]); setPayment('CB'); setCurrency('MAD')
        setDate(new Date().toISOString().split('T')[0]); setTicketFile(null); setTicketPreview(null)
        if (ticketRef.current) ticketRef.current.value = ''
      } else { const d = await r.json(); setError(d.error || 'Erreur.') }
    } catch { setError('Erreur de connexion.') }
    setSubmitting(false)
  }
 
  return (
    <div className="card">
      <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1.25rem', color: 'var(--green)' }}>💵 Nouvel encaissement</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {/* Ticket upload */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            Ticket {payment !== 'Espèces' && '* '}<span style={{ color: payment === 'Espèces' ? '#888' : 'var(--red)', fontWeight: 400 }}>({payment === 'Espèces' ? 'optionnel' : 'obligatoire'})</span>
          </label>
          <div
            ref={ticketDropZoneRef}
            style={{ position: 'relative', border: `2px dashed ${dragCounter > 0 ? 'var(--green)' : ticketFile ? 'var(--green)' : '#ddd'}`, borderRadius: '0.5rem', padding: '1rem', textAlign: 'center', background: dragCounter > 0 ? '#F0FDF4' : ticketFile ? '#F0FDF4' : '#FAFAFA', transition: 'all 0.15s' }}
          >
            {ticketFile && !extracting && (
              <button type="button" onClick={e => { e.stopPropagation(); setTicketFile(null); setTicketPreview(null); if (ticketRef.current) ticketRef.current.value = '' }} style={{ position: 'absolute', top: '0.35rem', left: '0.35rem', background: 'rgba(239,68,68,0.9)', border: 'none', borderRadius: '50%', width: '1.3rem', height: '1.3rem', color: 'white', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, lineHeight: 1, padding: 0 }}>×</button>
            )}
            {ticketFile ? (
              <div onClick={() => ticketRef.current?.click()} style={{ cursor: 'pointer' }}>
                {ticketPreview && <img src={ticketPreview} alt="Aperçu" style={{ maxHeight: 100, maxWidth: '100%', marginBottom: '0.5rem', borderRadius: '0.3rem' }} />}
                <div style={{ fontSize: '0.85rem', color: 'var(--green)', fontWeight: 600 }}>✓ {ticketFile.name}</div>
                {extracting
                  ? <div style={{ fontSize: '0.75rem', color: 'var(--terracotta)', marginTop: '0.2rem' }}>⏳ Analyse en cours…</div>
                  : <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.2rem' }}>Cliquer ou glisser pour changer</div>
                }
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{dragCounter > 0 ? '⬇️' : '🧾'}</div>
                <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.75rem' }}>Glisser votre ticket ici</div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                  <label style={{ padding: '0.5rem 0.875rem', background: '#F0FDF4', border: '1px solid var(--green)', borderRadius: '0.5rem', color: 'var(--green)', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                    📷 Photo
                    <input type="file" accept="image/*" capture="environment" onChange={handleTicket} style={{ display: 'none' }} />
                  </label>
                  <label style={{ padding: '0.5rem 0.875rem', background: '#F8F8F8', border: '1px solid #ddd', borderRadius: '0.5rem', color: '#555', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                    📁 Fichier
                    <input type="file" accept="image/*,application/pdf" onChange={handleTicket} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>
            )}
          </div>
          <input ref={ticketRef} type="file" accept="image/*,application/pdf" onChange={handleTicket} style={{ display: 'none' }} />
        </div>
 

 
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Date *</label>
          <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} required />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Mode de paiement *</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(['CB', 'Espèces'] as const).map(p => (
              <button key={p} type="button" onClick={() => { setPayment(p); setTransactionAmount(''); setAmount('') }} style={{ flex: 1, padding: '0.6rem', border: `2px solid ${payment === p ? 'var(--green)' : '#ddd'}`, borderRadius: '0.5rem', background: payment === p ? '#F0FDF4' : 'white', fontWeight: payment === p ? 700 : 400, cursor: 'pointer', color: payment === p ? 'var(--green)' : 'var(--text)', fontSize: '0.9rem' }}>
                {p === 'CB' ? '💳 CB' : '💵 Espèces'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Devise</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(['MAD', 'EUR'] as const).map(c => (
              <button key={c} type="button" onClick={() => setCurrency(c)} style={{ flex: 1, padding: '0.5rem', border: `2px solid ${currency === c ? 'var(--green)' : '#ddd'}`, borderRadius: '0.5rem', background: currency === c ? '#F0FDF4' : 'white', fontWeight: currency === c ? 700 : 400, cursor: 'pointer', color: currency === c ? 'var(--green)' : 'var(--text)' }}>{c}</button>
            ))}
          </div>
        </div>

        {payment === 'CB' ? (
          <div style={{ background: '#F0FDF4', border: '1px solid #86efac', borderRadius: '0.5rem', padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Montant de la transaction *</label>
              <input className="form-input" type="number" step="0.01" min="0" value={transactionAmount} onChange={e => { setTransactionAmount(e.target.value); setAmount(e.target.value ? String((parseFloat(e.target.value) * 0.97).toFixed(2)) : '') }} placeholder="0.00" required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--red)' }}>Frais bancaires (3%)</label>
                <div style={{ background: '#FEF2F2', border: '1px solid #fca5a5', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontWeight: 600, color: 'var(--red)', fontSize: '0.95rem' }}>
                  {transactionAmount ? `− ${fmt(parseFloat(transactionAmount) * 0.03)}` : '—'}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--green)' }}>Encaissement perçu</label>
                <div style={{ background: '#F0FDF4', border: '2px solid var(--green)', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontWeight: 700, color: 'var(--green)', fontSize: '1rem' }}>
                  {transactionAmount ? fmt(parseFloat(transactionAmount) * 0.97) : '—'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Montant encaissé *</label>
            <input className="form-input" type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
          </div>
        )}

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Nom du client</label>
          <input className="form-input" type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="(optionnel)" />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Catégorie *</label>
          <select className="form-input" value={category} onChange={e => setCategory(e.target.value)}>
            {ENCAISSEMENTS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Description</label>
          <textarea className="form-input" rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Notes optionnelles…" />
        </div>
 
        {error && <p style={{ color: 'var(--red)', fontSize: '0.875rem' }}>{error}</p>}
        {success && (
          <div>
            <p style={{ color: 'var(--green)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>{success}</p>
            <p style={{ fontSize: '0.78rem', color: '#888' }}>La facture client sera établie par Valérie ou Nicolas.</p>
          </div>
        )}
 
        <button className="btn-primary" type="submit" disabled={uploading || submitting || extracting} style={{ background: 'var(--green)' }}>
          {extracting ? '🤖 Analyse ticket…' : uploading ? '⬆️ Upload ticket…' : submitting ? 'Envoi…' : 'Soumettre'}
        </button>
      </form>
    </div>
  )
}
 
// ─── Fond de caisse (automatique) ─────────────────────────────────────────────
 
function FondsCaisse({ token }: { token: string }) {
  const [balanceMAD, setBalanceMAD] = useState(0)
  const [balanceEUR, setBalanceEUR] = useState(0)
  const [loading, setLoading] = useState(true)
  const [compteMAD, setCompteMAD] = useState('')
  const [compteEUR, setCompteEUR] = useState('')
  const [recSaving, setRecSaving] = useState(false)
  const [recMsg, setRecMsg] = useState('')

  // Enregistre le rapprochement : les administrateurs sont prévenus
  async function saveReconciliation() {
    setRecSaving(true); setRecMsg('')
    const r = await fetch('/api/reconciliations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, counted_mad: compteMAD, counted_eur: compteEUR }) }).catch(() => null)
    if (r && r.ok) {
      setRecMsg('✓ Rapprochement enregistré — Valérie et Nicolas sont prévenus.')
      setCompteMAD(''); setCompteEUR('')
    } else setRecMsg("Erreur : le rapprochement n'a pas été enregistré, réessayez.")
    setRecSaving(false)
  }
 
  const [updatedAt, setUpdatedAt] = useState<string>('')
 
  // Solde commun du fond de caisse : le même pour tous les employés (et le manager)
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const r = await fetch(`/api/fonds/balance?token=${token}&t=${Date.now()}`, { cache: 'no-store' })
      const d = await r.json()
      if (r.ok) {
        setBalanceMAD(Number(d.mad) || 0); setBalanceEUR(Number(d.eur) || 0)
        setUpdatedAt(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [token])
 
  // Mise à jour automatique : toutes les 15 s, et dès que l'appli revient au premier plan
  useEffect(() => {
    fetchData()
    const id = setInterval(() => { if (document.visibilityState === 'visible') fetchData(true) }, 15000)
    const onVisible = () => { if (document.visibilityState === 'visible') fetchData(true) }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible) }
  }, [fetchData])
 
  // Rapprochement
  const diffMAD = compteMAD !== '' ? parseFloat(compteMAD) - balanceMAD : null
  const diffEUR = compteEUR !== '' ? parseFloat(compteEUR) - balanceEUR : null
 
  if (loading) return <div className="card" style={{ textAlign: 'center', color: '#888' }}>Chargement…</div>
 
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Solde actuel */}
      <div className="card">
        <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.875rem', color: '#6366F1' }}>💰 Solde fond de caisse</h2>
        <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.75rem' }}>Solde commun à toute l&apos;équipe, calculé automatiquement depuis les encaissements et dépenses en espèces de tous les employés et les transferts coffre ↔ caisse.</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.75rem', color: '#888' }}>
          <span>{updatedAt ? `Mis à jour à ${updatedAt}` : ''}</span>
          <button type="button" onClick={() => fetchData(true)} style={{ background: '#EEF2FF', color: '#4338CA', border: 'none', borderRadius: '0.4rem', padding: '0.3rem 0.7rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>🔄 Actualiser</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {[{ cur: 'MAD', bal: balanceMAD }, { cur: 'EUR', bal: balanceEUR }].map(({ cur, bal }) => (
            <div key={cur} style={{ background: bal >= 0 ? '#F0FDF4' : '#FEF2F2', border: `2px solid ${bal >= 0 ? 'var(--green)' : 'var(--red)'}`, borderRadius: '0.5rem', padding: '0.875rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#888', marginBottom: '0.2rem' }}>{cur}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: bal >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(bal)}</div>
            </div>
          ))}
        </div>
      </div>
 
      {/* Rapprochement */}
      <div className="card">
        <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.5rem', color: '#6366F1' }}>🔍 Rapprochement caisse</h2>
        <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.75rem' }}>Comptez le contenu physique de la caisse et saisissez les montants.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>MAD compté</label>
            <input className="form-input" type="number" step="0.01" value={compteMAD} onChange={e => setCompteMAD(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>EUR compté</label>
            <input className="form-input" type="number" step="0.01" value={compteEUR} onChange={e => setCompteEUR(e.target.value)} placeholder="0.00" />
          </div>
        </div>
        {(diffMAD !== null || diffEUR !== null) && (
          <div style={{ background: '#F8F8F8', borderRadius: '0.5rem', padding: '0.75rem' }}>
            {diffMAD !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.85rem' }}>Écart MAD</span>
                <span style={{ fontWeight: 700, color: Math.abs(diffMAD) < 1 ? 'var(--green)' : 'var(--red)' }}>{diffMAD > 0 ? '+' : ''}{fmt(diffMAD)} {Math.abs(diffMAD) < 1 ? '✓' : '⚠️'}</span>
              </div>
            )}
            {diffEUR !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem' }}>Écart EUR</span>
                <span style={{ fontWeight: 700, color: Math.abs(diffEUR) < 0.5 ? 'var(--green)' : 'var(--red)' }}>{diffEUR > 0 ? '+' : ''}{fmt(diffEUR)} {Math.abs(diffEUR) < 0.5 ? '✓' : '⚠️'}</span>
              </div>
            )}
          </div>
        )}
        <button type="button" onClick={saveReconciliation} disabled={recSaving || (!compteMAD && !compteEUR)} className="btn-primary"
          style={{ width: '100%', marginTop: '0.75rem', background: '#6366F1', opacity: (!compteMAD && !compteEUR) ? 0.5 : 1 }}>
          {recSaving ? 'Enregistrement…' : '✓ Enregistrer le rapprochement'}
        </button>
        {recMsg && <p style={{ fontSize: '0.8rem', marginTop: '0.4rem', color: recMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{recMsg}</p>}
      </div>
 
    </div>
  )
}
 
// ─── History ───────────────────────────────────────────────────────────────────
 
function EmployeeHistory({ token }: { token: string }) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [fondsEntries, setFondsEntries] = useState<FondsEntry[]>([])
  const [activeSection, setActiveSection] = useState<'entries' | 'fonds'>('entries')
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<DateRange>(EMPTY_RANGE)
 
  const fetchHistory = useCallback(async () => {
    const [entriesR, fondsR] = await Promise.all([
      fetch(`/api/entries?token=${token}`),
      fetch(`/api/fonds?token=${token}`),
    ])
    setEntries(await entriesR.json())
    setFondsEntries(await fondsR.json())
    setLoading(false)
  }, [token])
 
  useEffect(() => { fetchHistory() }, [fetchHistory])
 
  if (loading) return <p>Chargement…</p>
 
  return (
    <div>
      <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--terracotta)' }}>📋 Mon historique</h2>
 
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setActiveSection('entries')} style={{ padding: '0.4rem 0.9rem', border: 'none', borderRadius: '0.5rem', background: activeSection === 'entries' ? 'var(--terracotta)' : '#EDE0D6', color: activeSection === 'entries' ? 'white' : 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>Dépenses & Encaissements</button>
        <button onClick={() => setActiveSection('fonds')} style={{ padding: '0.4rem 0.9rem', border: 'none', borderRadius: '0.5rem', background: activeSection === 'fonds' ? '#6366F1' : '#EEF2FF', color: activeSection === 'fonds' ? 'white' : '#6366F1', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>Fond de caisse</button>
        <DateRangeFilter value={range} onChange={setRange} />
      </div>
 
      {activeSection === 'entries' && (
        entries.filter(e => inRange(e.date, range)).length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: '#aaa', padding: '2rem' }}>Aucune entrée pour le moment.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {entries.filter(e => inRange(e.date, range)).map(e => (
              <div key={e.id} className="card" style={{ borderLeft: `4px solid ${e.type === 'cb' ? 'var(--terracotta)' : 'var(--green)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: e.type === 'cb' ? 'var(--terracotta)' : 'var(--green)', textTransform: 'uppercase' }}>{e.type === 'cb' ? 'Dépense' : 'Encaissement'}</span>
                    <div style={{ fontWeight: 600, marginTop: '0.1rem' }}>{e.category}</div>
                    {e.supplier && <div style={{ fontSize: '0.8rem', color: '#888' }}>{e.supplier}</div>}
                    {e.payment && <div style={{ fontSize: '0.8rem', color: '#888' }}>{e.payment}</div>}
                    {e.description && <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.15rem' }}>{e.description}</div>}
                    {e.invoice_url && <a href={e.invoice_url as string} onClick={ev => { ev.preventDefault(); openAttachment(e.invoice_url as string) }} style={{ fontSize: '0.78rem', color: 'var(--blue)', display: 'inline-block', marginTop: '0.2rem', cursor: 'pointer' }}>📄 Voir facture</a>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '1rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: e.type === 'cb' ? 'var(--terracotta)' : 'var(--green)' }}>{fmt(Number(e.amount))} <span style={{ fontSize: '0.8rem' }}>{(e.currency as string) || 'MAD'}</span></div>
                    <div style={{ fontSize: '0.75rem', color: '#888' }}>{new Date(e.date + 'T00:00:00').toLocaleDateString('fr-FR')}</div>
                    <span className={e.status === 'validated' ? 'badge-validated' : 'badge-pending'} style={{ display: 'inline-block', marginTop: '0.25rem' }}>{e.status === 'validated' ? 'Validé' : 'En attente'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
 
      {activeSection === 'fonds' && (
        fondsEntries.filter(e => inRange(e.date, range)).length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: '#aaa', padding: '2rem' }}>Aucun mouvement de fonds.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {fondsEntries.filter(e => inRange(e.date, range)).map(e => (
              <div key={e.id} className="card" style={{ borderLeft: `4px solid ${e.direction === 'in' ? 'var(--green)' : 'var(--red)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: e.direction === 'in' ? 'var(--green)' : 'var(--red)', textTransform: 'uppercase' }}>{e.direction === 'in' ? '↑ Entrée' : '↓ Sortie'}</span>
                    <div style={{ fontWeight: 600, marginTop: '0.1rem' }}>{e.category}</div>
                    {e.description && <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.15rem' }}>{e.description}</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '1rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: e.direction === 'in' ? 'var(--green)' : 'var(--red)' }}>{e.direction === 'in' ? '+' : '-'}{fmt(Number(e.amount))} <span style={{ fontSize: '0.8rem' }}>{(e.currency as string) || 'MAD'}</span></div>
                    <div style={{ fontSize: '0.75rem', color: '#888' }}>{new Date(e.date + 'T00:00:00').toLocaleDateString('fr-FR')}</div>
                    <span className={e.status === 'validated' ? 'badge-validated' : 'badge-pending'} style={{ display: 'inline-block', marginTop: '0.25rem' }}>{e.status === 'validated' ? 'Validé' : 'En attente'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
 
export default function EmployeePage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>Chargement…</div>}>
      <EmployeeApp />
    </Suspense>
  )
}
 
