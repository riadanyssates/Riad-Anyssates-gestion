'use client'
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { Entry, Employee, DashboardStats, FondsEntry } from '@/types'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { openAttachment, fileToDataUrl } from '@/lib/attachments'
import ManagerGuide from './guide'
import NotificationBell from './notifications'
import { StatementsPanel, StatementsMonthPanel, STATEMENT_LABELS, type StatementSource } from './statements'
import PayablesTab from './payables'
import { DateRangeFilter, EMPTY_RANGE, inRange, rangeActive, rangeLabel, type DateRange } from './date-range'
import { InvoiceModal, InvoiceEditor, TaxeSejourPanel, TvaRatesCard, useInvoices, downloadInvoice, emptyDraft, previewDraft, draftBody, type InvoiceDraft } from './invoices'
 
type Tab = 'dashboard' | 'depenses' | 'apayer' | 'encaissements' | 'fonds' | 'banque' | 'coffre' | 'comptable' | 'employees' | 'settings'
 
const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
 
function formatMonth(month: string) {
  const [y, m] = month.split('-')
  const names = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
  return `${names[parseInt(m) - 1]} ${y}`
}
 
function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
 
export default function ManagerPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [authChecked, setAuthChecked] = useState(false)
  const [managerName, setManagerName] = useState('Manager')
  const [showGuide, setShowGuide] = useState(false)
 
  useEffect(() => {
    fetch('/api/auth/check').then(async r => {
      if (!r.ok) { router.replace('/'); return }
      const d = await r.json().catch(() => ({}))
      if (d?.name) setManagerName(d.name)
      setAuthChecked(true)
    })
  }, [router])
 
  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.replace('/')
  }
 
  if (!authChecked) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ color: 'var(--terracotta)' }}>Chargement…</div>
    </div>
  )
 
  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'depenses', label: '💳 Dépenses' },
    { id: 'encaissements', label: '💵 Encaissements' },
    { id: 'apayer', label: '🧾 À payer' },
    { id: 'fonds', label: '💰 Fond de caisse' },
    { id: 'banque', label: '🏦 Banque' },
    { id: 'coffre', label: '🔐 Coffre fort' },
    { id: 'comptable', label: '📨 Comptable' },
    { id: 'employees', label: '👥 Employés' },
    { id: 'settings', label: '⚙️ Paramètres' },
  ]
 
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header className="mgr-header" style={{ background: 'var(--terracotta)', color: 'white', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>🏨 Riad Anyssates</div>
        <div className="mgr-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={() => window.location.href = '/api/export/excel'} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', color: 'white', padding: '0.3rem 0.75rem', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>📊 Excel</button>
          <button onClick={() => setShowGuide(true)} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', color: 'white', padding: '0.3rem 0.75rem', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>📖 Mode d&apos;emploi</button>
          <NotificationBell />
          <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>{managerName}</span>
          <button onClick={logout} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '0.3rem 0.75rem', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.8rem' }}>Déconnexion</button>
        </div>
      </header>
      {showGuide && <ManagerGuide onClose={() => setShowGuide(false)} />}
 
      <div style={{ background: 'white', borderBottom: '1px solid #EDE0D6', padding: '0 1rem', display: 'flex', gap: '0.25rem', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ whiteSpace: 'nowrap', padding: '0.75rem 0.875rem', border: 'none', borderBottom: tab === t.id ? '2px solid var(--terracotta)' : '2px solid transparent', background: 'transparent', color: tab === t.id ? 'var(--terracotta)' : 'var(--text)', fontWeight: tab === t.id ? 700 : 500, cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>
 
      <main className="mgr-main" style={{ padding: '1.5rem', maxWidth: 1440, margin: '0 auto' }}>
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'depenses' && <EntriesTab type="cb" label="Dépenses" color="var(--terracotta)" />}
        {tab === 'apayer' && <PayablesTab />}
        {tab === 'encaissements' && <EntriesTab type="cash" label="Encaissements" color="var(--green)" />}
        {tab === 'fonds' && <FondsTab />}
        {tab === 'banque' && <BanqueTab />}
        {tab === 'coffre' && <CoffreTab />}
        {tab === 'comptable' && <ComptableTab />}
        {tab === 'employees' && <EmployeesTab />}
        {tab === 'settings' && <SettingsTab onLogout={logout} />}
      </main>
    </div>
  )
}
 
// ─── Dashboard ─────────────────────────────────────────────────────────────────
 
const PIE_COLORS_DEP = ['#D97D4E','#E8956A','#F0A978','#F5BC90','#F8CFAA','#FADBB8','#FCE7CC','#FEF3E4']
const PIE_COLORS_ENC = ['#2D9E6B','#45B882','#5DC898','#74D8AD','#8BE3BE','#A2EDCF','#B9F5E0','#D0FAF0']
 
type TrendRow = { month: string; depenses: number; encaissements: number }
 
function DashboardTab() {
  const now = new Date()
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [trend, setTrend] = useState<TrendRow[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [range, setRange] = useState<DateRange>(EMPTY_RANGE)
  const useRange = rangeActive(range)
 
  useEffect(() => { setMounted(true) }, [])
 
  const fetchStats = useCallback(async () => {
    setLoading(true)
    // Période libre : les totaux portent sur la période, l'évolution sur les 6 mois qui se terminent à sa fin
    const trendMonth = useRange && range.to ? range.to.slice(0, 7) : month
    const [r1, r2] = await Promise.all([
      fetch(useRange ? `/api/dashboard?from=${range.from}&to=${range.to}` : `/api/dashboard?month=${month}`),
      fetch(`/api/dashboard/trend?month=${trendMonth}`),
    ])
    setStats(await r1.json())
    const t = await r2.json()
    setTrend(Array.isArray(t) ? t : [])
    setLoading(false)
  }, [month, useRange, range.from, range.to])
 
  useEffect(() => { fetchStats() }, [fetchStats])
 
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const isCurrentMonth = month === currentMonthStr
 
  const fmtShort = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v))
  const shortMonth = (mo: string) => {
    const [, m] = mo.split('-')
    return ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'][parseInt(m) - 1]
  }
 
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {useRange ? (
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--terracotta)' }}>Période {rangeLabel(range)}</h2>
        ) : <>
        <button onClick={() => setMonth(shiftMonth(month, -1))} style={{ border: '1px solid #ddd', background: 'white', borderRadius: '0.4rem', padding: '0.35rem 0.75rem', cursor: 'pointer', fontWeight: 600 }}>‹</button>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--terracotta)', minWidth: 180, textAlign: 'center' }}>{formatMonth(month)}</h2>
        <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={isCurrentMonth} style={{ border: '1px solid #ddd', background: 'white', borderRadius: '0.4rem', padding: '0.35rem 0.75rem', cursor: isCurrentMonth ? 'default' : 'pointer', opacity: isCurrentMonth ? 0.4 : 1, fontWeight: 600 }}>›</button>
        {!isCurrentMonth && (
          <button onClick={() => setMonth(currentMonthStr)} style={{ border: 'none', background: 'var(--terracotta)', color: 'white', borderRadius: '0.4rem', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem' }}>Mois actuel</button>
        )}
        </>}
        <DateRangeFilter value={range} onChange={setRange} />
      </div>
 
      {loading ? <p>Chargement…</p> : !stats ? <p>Erreur.</p> : (
        <>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div className="stat-card">
              <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>Total Dépenses</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--terracotta)' }}>{fmt(stats.total_depenses)}</div>
            </div>
            <div className="stat-card" style={{ borderLeftColor: 'var(--green)' }}>
              <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>Total Encaissements</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--green)' }}>{fmt(stats.total_encaissements)}</div>
            </div>
            <div className="stat-card" style={{ borderLeftColor: '#6366F1' }}>
              <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>Fond de caisse — Entrées</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#6366F1' }}>{fmt(stats.total_fonds_in)}</div>
            </div>
            <div className="stat-card" style={{ borderLeftColor: '#F59E0B' }}>
              <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>Fond de caisse — Sorties</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#D97706' }}>{fmt(stats.total_fonds_out)}</div>
            </div>
            <div className="stat-card" style={{ borderLeftColor: '#94A3B8' }}>
              <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>En attente</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#64748B' }}>{stats.pending_count}</div>
            </div>
            <div className="stat-card" style={{ borderLeftColor: 'var(--blue)' }}>
              <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>Validés</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--blue)' }}>{stats.validated_count}</div>
            </div>
          </div>
 
          {/* Bar chart — 6-month trend */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '1rem' }}>📈 Évolution sur 6 mois</h3>
            {mounted && trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trend.map(r => ({ ...r, month: shortMonth(r.month) }))} barGap={4}>
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11 }} width={50} />
                  <Tooltip formatter={(v: unknown) => typeof v === 'number' ? fmt(v) : String(v)} />
                  <Legend />
                  <Bar dataKey="depenses" name="Dépenses" fill="#D97D4E" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="encaissements" name="Encaissements" fill="#2D9E6B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Aucune donnée sur cette période.</p>}
          </div>
 
          {/* Pie charts + tables side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: '0.75rem', color: 'var(--terracotta)' }}>💳 Dépenses par catégorie</h3>
              {mounted && stats.depenses_by_category.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={stats.depenses_by_category} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                        {stats.depenses_by_category.map((_, i) => <Cell key={i} fill={PIE_COLORS_DEP[i % PIE_COLORS_DEP.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: unknown) => typeof v === 'number' ? fmt(v) : String(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ marginTop: '0.5rem' }}>
                    {stats.depenses_by_category.map((c, i) => {
                      const pct = stats.total_depenses > 0 ? Math.round(c.total / stats.total_depenses * 100) : 0
                      return (
                        <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', borderBottom: '1px solid #F5EDE4', fontSize: '0.85rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: PIE_COLORS_DEP[i % PIE_COLORS_DEP.length], display: 'inline-block' }} />
                            {c.category}
                          </span>
                          <span style={{ display: 'flex', gap: '0.75rem' }}>
                            <span style={{ color: '#888', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
                            <span style={{ fontWeight: 600, minWidth: 80, textAlign: 'right' }}>{fmt(c.total)}</span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Aucune dépense sur cette période.</p>}
            </div>
            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: '0.75rem', color: 'var(--green)' }}>💵 Encaissements par catégorie</h3>
              {mounted && stats.encaissements_by_category.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={stats.encaissements_by_category} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                        {stats.encaissements_by_category.map((_, i) => <Cell key={i} fill={PIE_COLORS_ENC[i % PIE_COLORS_ENC.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: unknown) => typeof v === 'number' ? fmt(v) : String(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ marginTop: '0.5rem' }}>
                    {stats.encaissements_by_category.map((c, i) => {
                      const pct = stats.total_encaissements > 0 ? Math.round(c.total / stats.total_encaissements * 100) : 0
                      return (
                        <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', borderBottom: '1px solid #EDF7F1', fontSize: '0.85rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: PIE_COLORS_ENC[i % PIE_COLORS_ENC.length], display: 'inline-block' }} />
                            {c.category}
                          </span>
                          <span style={{ display: 'flex', gap: '0.75rem' }}>
                            <span style={{ color: '#888', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
                            <span style={{ fontWeight: 600, color: 'var(--green)', minWidth: 80, textAlign: 'right' }}>{fmt(c.total)}</span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Aucun encaissement sur cette période.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
 
// ─── Entries Tab ───────────────────────────────────────────────────────────────
 
const DEPENSES_CATEGORIES = ['Client','Commission','Administratif','Nourriture','Spa','Prestataire','Banque','Salaire','Maroc Telecom','Travaux','Aménagement/Déco','Entretien','Livraison/Carrossa','Radeema','Impôts','Valérie','Divers']
 
const ENCAISSEMENTS_CATEGORIES = ['Client','Commission','Administratif','Nourriture','Spa','Prestataire','Banque','Salaire','Maroc Telecom','Travaux','Radeema','Impôts','Divers']
const PAYMENT_MODES_DEPENSES = ['CB', 'Virement', 'Chèque', 'Prélèvement', 'Espèces']
const PAYMENT_MODES_ENCAISSEMENTS = ['CB', 'Virement', 'Chèque', 'Prélèvement', 'Espèces']
const CURRENCIES = ['MAD', 'EUR']
 
function EntriesTab({ type, label, color }: { type: 'cb' | 'cash'; label: string; color: string }) {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [month, setMonth] = useState(currentMonth)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterEmployee, setFilterEmployee] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterPayment, setFilterPayment] = useState('')
  const [filterSupplier, setFilterSupplier] = useState('')
  const [filterNoInvoice, setFilterNoInvoice] = useState(false)
  const [deleteModal, setDeleteModal] = useState<number | null>(null)
  const [employees, setEmployees] = useState<string[]>([])
  const [showForm, setShowForm] = useState(false)
  const paymentModes = type === 'cb' ? PAYMENT_MODES_DEPENSES : PAYMENT_MODES_ENCAISSEMENTS
 
  // Form state
  const [fDate, setFDate] = useState(now.toISOString().split('T')[0])
  const [fCategory, setFCategory] = useState(type === 'cb' ? DEPENSES_CATEGORIES[0] : ENCAISSEMENTS_CATEGORIES[0])
  const [fAmount, setFAmount] = useState('')
  const [fAmountHT, setFAmountHT] = useState('')
  const [fTvaRate, setFTvaRate] = useState('')
  const [fCurrency, setFCurrency] = useState('MAD')
  const [fSupplier, setFSupplier] = useState('')
  const [fPayment, setFPayment] = useState('CB')
  const [fDescription, setFDescription] = useState('')
  const [fReference, setFReference] = useState('')
  const [fEmployee, setFEmployee] = useState('')
  const [fCashLocation, setFCashLocation] = useState<'fonds' | 'coffre'>('fonds')
  const [fToAccountant, setFToAccountant] = useState(false)
  const [fFile, setFFile] = useState<File | null>(null)
  const [fFilePreview, setFFilePreview] = useState<string | null>(null)
  const [fUploading, setFUploading] = useState(false)
  const [fExtracting, setFExtracting] = useState(false)
  const [fExtracted, setFExtracted] = useState(false)
  const [fDragCounter, setFDragCounter] = useState(0)
  const [fTransactionAmount, setFTransactionAmount] = useState('')
  const [fCardType, setFCardType] = useState<'amex' | 'other'>('amex')
  const [fClientName, setFClientName] = useState('')
  // Dernier encaissement enregistré : proposer d'en créer la facture
  const [fLastEntry, setFLastEntry] = useState<Entry | null>(null)
  const { byEntry: invoiceByEntry, taxRate, childRate, tvaRates, reload: reloadInvoices } = useInvoices()
  const [invoiceFor, setInvoiceFor] = useState<Entry | null>(null)
  // Facture client créée en même temps que l'encaissement
  const [fInvoice, setFInvoice] = useState(false)
  const [fInvDraft, setFInvDraft] = useState<InvoiceDraft>(emptyDraft())
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [uploadingEntryId, setUploadingEntryId] = useState<number | null>(null)
  const rowFileRef = useRef<HTMLInputElement>(null)
  const fFileRef = useRef<HTMLInputElement>(null)
  const fDropZoneRef = useRef<HTMLDivElement>(null)
  const processFileRef = useRef<(f: File) => void>((_f: File) => {})
  const [pendingUploadEntry, setPendingUploadEntry] = useState<number | null>(null)
 
  const categories = type === 'cb' ? DEPENSES_CATEGORIES : ENCAISSEMENTS_CATEGORIES
 
  // Période libre (du … au …) : remplace la navigation par mois tant qu'elle est remplie
  const [range, setRange] = useState<DateRange>(EMPTY_RANGE)
  const useRange = rangeActive(range)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ type })
    if (!useRange) params.set('month', month)
    if (filterStatus) params.set('status', filterStatus)
    if (filterEmployee) params.set('employee', filterEmployee)
    const r = await fetch(`/api/entries?${params}`)
    setEntries(await r.json())
    setLoading(false)
  }, [type, month, useRange, filterStatus, filterEmployee])
 
  useEffect(() => { fetchEntries() }, [fetchEntries])
  const [me, setMe] = useState('Valérie')
  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then((emps: Employee[]) => {
      setEmployees(Array.isArray(emps) ? emps.filter(e => e.active).map(e => e.name) : [])
    }).catch(() => {})
    fetch('/api/auth/check').then(r => r.json()).then(d => { if (d?.name) { setMe(d.name); setFEmployee(prev => prev || d.name) } }).catch(() => {})
  }, [])
  const employeeChoices = useMemo(() => Array.from(new Set([me, 'Valérie', ...employees])), [me, employees])
 
  // Reset defaults every time form opens
  useEffect(() => {
    if (showForm) {
      setFCurrency('MAD')
      setFCategory(type === 'cb' ? DEPENSES_CATEGORIES[0] : ENCAISSEMENTS_CATEGORIES[0])
      setFPayment('CB')
      setFDate(new Date().toISOString().split('T')[0])
      setFTransactionAmount('')
      setFCardType('amex')
      setFReference('')
      setFCashLocation('fonds')
      setFToAccountant(false)
      setFInvoice(false); setFInvDraft(emptyDraft())
    }
  }, [showForm, type])
 
  async function changePayment(entry: Entry, value: string) {
    const [payment, loc] = value.split('|')
    const r = await fetch(`/api/entries/${entry.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payment, cash_location: loc || null }) }).catch(() => null)
    if (r && r.ok) fetchEntries()
    else {
      setFormError('Impossible de modifier le mode de paiement — réessayez.')
      setTimeout(() => setFormError(''), 5000)
    }
  }

  async function changeDate(entry: Entry, newDate: string) {
    if (!newDate || newDate === entry.date) return
    const r = await fetch(`/api/entries/${entry.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: newDate }) }).catch(() => null)
    if (r && r.ok) {
      if (newDate.substring(0, 7) !== month) {
        setFormSuccess(`✓ Date modifiée — l'entrée est maintenant en ${formatMonth(newDate.substring(0, 7))}`)
        setTimeout(() => setFormSuccess(''), 5000)
      }
      fetchEntries()
    } else {
      setFormError('Impossible de modifier la date — réessayez.')
      setTimeout(() => setFormError(''), 5000)
    }
  }
 
  async function changeDescription(entry: Entry, value: string) {
    const v = value.trim()
    if (v === (entry.description || '')) return
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, description: v } : e))
    const r = await fetch(`/api/entries/${entry.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: v }) }).catch(() => null)
    if (!r || !r.ok) {
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, description: entry.description } : e))
      setFormError('Impossible de modifier la description — réessayez.')
      setTimeout(() => setFormError(''), 5000)
    }
  }

  async function toggleAccountant(entry: Entry) {
    const next = !entry.to_accountant
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, to_accountant: next } : e))
    const r = await fetch(`/api/entries/${entry.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to_accountant: next }) }).catch(() => null)
    if (!r || !r.ok) setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, to_accountant: entry.to_accountant } : e))
  }
 
  async function toggleStatus(entry: Entry) {
    await fetch(`/api/entries/${entry.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: entry.status === 'pending' ? 'validated' : 'pending' }) })
    fetchEntries()
  }
 
  async function deleteEntry(id: number) {
    await fetch(`/api/entries/${id}`, { method: 'DELETE' })
    setDeleteModal(null)
    fetchEntries()
    if (type === 'cash') reloadInvoices()
  }
 
  async function processFile(file: File) {
    setFFile(file)
    setFExtracted(false)
    if (file.type.startsWith('image/')) {
      setFFilePreview(URL.createObjectURL(file))
    } else {
      setFFilePreview(null)
    }
    setFExtracting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', type)
      const r = await fetch('/api/extract-invoice', { method: 'POST', body: fd })
      if (r.ok) {
        const data = await r.json()
        if (data.date) setFDate(data.date)
        if (data.supplier) setFSupplier(data.supplier)
        if (data.amount_ttc) {
          if (type === 'cash' && fPayment === 'CB') {
            setFTransactionAmount(String(data.amount_ttc))
            const autoRate = fCardType === 'amex' ? 0.033 : 0.0268
            const autoComm = Math.round(data.amount_ttc * autoRate * 100) / 100
            const autoTva  = fCardType === 'amex' ? 0 : Math.round(autoComm * 0.10 * 100) / 100
            setFAmount(String((data.amount_ttc - autoComm - autoTva).toFixed(2)))
          } else {
            setFAmount(String(data.amount_ttc))
          }
        }
        if (type === 'cb') {
          if (data.amount_ht) setFAmountHT(String(data.amount_ht))
          if (data.tva_rate) setFTvaRate(String(data.tva_rate))
        }
        setFExtracted(true)
      }
    } catch { /* silent */ }
    setFExtracting(false)
  }
 
  processFileRef.current = processFile
 
  useEffect(() => {
    const el = fDropZoneRef.current
    if (!el) return
    const onDragEnter = (e: DragEvent) => { e.preventDefault(); setFDragCounter(c => c + 1) }
    const onDragOver = (e: DragEvent) => { e.preventDefault() }
    const onDragLeave = (e: DragEvent) => { e.preventDefault(); setFDragCounter(c => Math.max(0, c - 1)) }
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setFDragCounter(0)
      const f = e.dataTransfer?.files[0]
      if (f) processFileRef.current(f)
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
  }, [showForm, fInvoice])
 
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    processFile(file)
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
 
  async function handleRowUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || pendingUploadEntry === null) return
    setUploadingEntryId(pendingUploadEntry)
    try {
      const url = await fileToBase64(file)
      await fetch(`/api/entries/${pendingUploadEntry}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoice_url: url }) })
      fetchEntries()
    } catch { /* ignore */ }
    setUploadingEntryId(null)
    setPendingUploadEntry(null)
    if (rowFileRef.current) rowFileRef.current.value = ''
  }
 
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFormError('')
    setFormSuccess('')
    // Côté administrateurs, le justificatif est facultatif : il peut être ajouté plus tard
    // (colonne Justificatif ou onglet Comptable).
    let invoice_url: string | undefined
    if (fFile) {
      setFUploading(true)
      try {
        invoice_url = await fileToBase64(fFile)
      } catch (err) { setFormError((err as Error).message); setFUploading(false); setSubmitting(false); return }
      setFUploading(false)
    }
    const cbRate       = fCardType === 'amex' ? 0.033 : 0.0268
    const cbCommission = type === 'cash' && fPayment === 'CB' && fTransactionAmount
      ? Math.round(parseFloat(fTransactionAmount) * cbRate * 100) / 100
      : 0
    const cbTva        = fCardType === 'amex' ? 0 : Math.round(cbCommission * 0.10 * 100) / 100
    const finalAmount  = type === 'cash' && fPayment === 'CB' && fTransactionAmount
      ? parseFloat(fTransactionAmount) - cbCommission - cbTva
      : parseFloat(fAmount)
 
    const body: Record<string, unknown> = { type, date: fDate, employee_name: fEmployee || me, category: fCategory, amount: finalAmount, currency: fCurrency, description: fDescription || null, invoice_url, reference: fReference || null, to_accountant: fToAccountant, cash_location: fPayment === 'Espèces' ? fCashLocation : null }
    if (type === 'cb') {
      body.supplier = fSupplier || null
      body.payment = fPayment
      if (fAmountHT) body.amount_ht = parseFloat(fAmountHT)
      if (fTvaRate) body.tva_rate = parseFloat(fTvaRate)
    } else {
      body.payment = fPayment
      body.supplier = fClientName || null
      if (fPayment === 'CB' && fTransactionAmount) {
        body.amount_ht = parseFloat(fTransactionAmount)
        body.tva_rate = fCardType === 'amex' ? 3.3 : 2.68
      }
    }
 
    if (type === 'cash' && fInvoice) {
      if (!invoicePreview.valid) { setFormError('La taxe de séjour et les lignes dépassent le montant encaissé.'); setSubmitting(false); return }
      body.category = 'Client'
      body.supplier = fInvDraft.clientName || null
      body.to_accountant = true
    }

    try {
      const r = await fetch('/api/entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (r.ok) {
        const created: Entry | null = await r.json().catch(() => null)
        let invoiceMsg = ''
        if (type === 'cash' && fInvoice && created) {
          const ri = await fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
            entry_id: created.id, date: fDate, ...draftBody(fInvDraft),
          }) }).catch(() => null)
          const inv = ri ? await ri.json().catch(() => null) : null
          if (ri && ri.ok && inv) {
            invoiceMsg = ` Facture ${inv.number} créée.`
            downloadInvoice(inv).catch(() => {})
            reloadInvoices()
          } else {
            invoiceMsg = ` ⚠️ La facture n'a pas pu être créée${inv?.error ? ` (${inv.error})` : ''} — utilisez « 🧾 Créer » dans la colonne Facture.`
          }
        }
        if (type === 'cash') setFLastEntry(created)
        setFAmount(''); setFAmountHT(''); setFTvaRate(''); setFSupplier(''); setFDescription('')
        setFFile(null); setFFilePreview(null); setFExtracted(false); setShowForm(false)
        setFTransactionAmount(''); setFClientName(''); setFReference(''); setFToAccountant(false)
        setFilterStatus(''); setFilterEmployee(''); setFilterCategory(''); setFilterPayment(''); setFilterSupplier('')
        setFormSuccess('✓ Entrée ajoutée avec succès !' + invoiceMsg)
        setTimeout(() => { setFormSuccess(''); setFLastEntry(null) }, type === 'cash' ? 15000 : 4000)
        setMonth(fDate.substring(0, 7))
      } else {
        const d = await r.json().catch(() => ({}))
        setFormError(d.error || `Erreur serveur (${r.status})`)
      }
    } catch (err) {
      setFormError('Erreur de connexion — réessayez.')
    }
    setSubmitting(false)
  }
 
  // Aperçu de la facture pendant la saisie de l'encaissement
  // (facture toujours en dirhams : pour un encaissement en euros, le montant en MAD est saisi dans la facture)
  const invoiceGross = fCurrency === 'EUR' ? null : parseFloat(fPayment === 'CB' && fTransactionAmount ? fTransactionAmount : fAmount) || 0
  const invoicePreview = previewDraft(fInvDraft, invoiceGross, taxRate ?? 0, childRate, tvaRates)

  // Encaissement : un seul montant (le total payé par le client). Par carte, l'encaissement
  // est enregistré net de la commission bancaire, le total restant dans « montant de la transaction ».
  const cashTotal = fPayment === 'CB' ? fTransactionAmount : fAmount
  function setCashTotal(v: string, payment = fPayment, card = fCardType) {
    if (payment === 'CB') {
      setFTransactionAmount(v)
      if (!v) { setFAmount(''); return }
      const a = parseFloat(v)
      const c = Math.round(a * (card === 'amex' ? 0.033 : 0.0268) * 100) / 100
      const t = card === 'amex' ? 0 : Math.round(c * 0.10 * 100) / 100
      setFAmount(String((a - c - t).toFixed(2)))
    } else {
      setFTransactionAmount('')
      setFAmount(v)
    }
  }
  function choosePayment(p: string) {
    if (type === 'cash') setCashTotal(cashTotal, p)
    else if (p !== 'CB') setFTransactionAmount('')
    setFPayment(p)
    if (p !== 'Espèces') setFCurrency('MAD')
  }
  const paymentFields = (
    <>
      {/* Mode paiement */}
      <div>
        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem' }}>Mode de paiement</label>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {paymentModes.map(p => (
            <button key={p} type="button" onClick={() => choosePayment(p)} style={{ flex: 1, minWidth: '4rem', padding: '0.5rem', border: `2px solid ${fPayment === p ? color : '#ddd'}`, borderRadius: '0.5rem', background: fPayment === p ? (type === 'cb' ? '#FFF5F0' : '#F0FDF4') : 'white', fontWeight: fPayment === p ? 700 : 400, cursor: 'pointer', color: fPayment === p ? color : 'var(--text)', fontSize: '0.85rem' }}>{p}</button>
          ))}
        </div>
      </div>
 
      {/* Devise — uniquement pour les espèces (Fond de caisse). Les mouvements bancaires (CB/Virement/Chèque) sont toujours en MAD. */}
      {fPayment === 'Espèces' && (
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem' }}>Devise</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={() => setFCurrency('MAD')} style={{ flex: 1, padding: '0.5rem', border: `2px solid ${fCurrency === 'MAD' ? 'var(--terracotta)' : '#ddd'}`, borderRadius: '0.5rem', background: fCurrency === 'MAD' ? '#FFF5F0' : 'white', fontWeight: fCurrency === 'MAD' ? 700 : 400, cursor: 'pointer', color: fCurrency === 'MAD' ? 'var(--terracotta)' : 'var(--text)' }}>MAD</button>
            <button type="button" onClick={() => setFCurrency('EUR')} style={{ flex: 1, padding: '0.5rem', border: `2px solid ${fCurrency === 'EUR' ? 'var(--terracotta)' : '#ddd'}`, borderRadius: '0.5rem', background: fCurrency === 'EUR' ? '#FFF5F0' : 'white', fontWeight: fCurrency === 'EUR' ? 700 : 400, cursor: 'pointer', color: fCurrency === 'EUR' ? 'var(--terracotta)' : 'var(--text)' }}>EUR</button>
          </div>
        </div>
      )}
 
      {/* Espèces : transitent par le fond de caisse ou le coffre fort */}
      {fPayment === 'Espèces' && (
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem' }}>{type === 'cb' ? 'Espèces sorties de' : 'Espèces déposées dans'}</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {([['fonds', '💰 Fond de caisse'], ['coffre', '🔐 Coffre fort']] as const).map(([val, lbl]) => (
              <button key={val} type="button" onClick={() => setFCashLocation(val)} style={{ flex: 1, padding: '0.5rem', border: `2px solid ${fCashLocation === val ? color : '#ddd'}`, borderRadius: '0.5rem', background: fCashLocation === val ? (type === 'cb' ? '#FFF5F0' : '#F0FDF4') : 'white', fontWeight: fCashLocation === val ? 700 : 400, cursor: 'pointer', color: fCashLocation === val ? color : 'var(--text)', fontSize: '0.85rem' }}>{lbl}</button>
            ))}
          </div>
        </div>
      )}
    </>
  )

  function exportCSV() { window.location.href = `/api/export/${type}?month=${month}` }
 
  // Filtres catégorie / paiement / fournisseur (appliqués sur le mois affiché)
  const supplierQuery = filterSupplier.trim().toLowerCase()
  // Encaissements clients sans facture (ex : saisis par un employé) : à compléter par Valérie ou Nicolas
  const needsInvoice = (e: Entry) => type === 'cash' && e.category === 'Client' && !invoiceByEntry[e.id]
  const toInvoiceCount = entries.filter(needsInvoice).length
  const shown = entries.filter(e =>
    (!useRange || inRange(e.date, range)) &&
    (!filterNoInvoice || needsInvoice(e)) &&
    (!filterCategory || e.category === filterCategory) &&
    (!filterPayment || e.payment === filterPayment) &&
    (!supplierQuery || `${e.supplier || ''} ${e.description || ''}`.toLowerCase().includes(supplierQuery)))
  const categoryOptions = Array.from(new Set([...categories, ...entries.map(e => e.category).filter(Boolean)]))
  const supplierOptions = Array.from(new Set(entries.map(e => (e.supplier || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fr'))
  const hasExtraFilter = !!(filterStatus || filterEmployee || filterCategory || filterPayment || filterSupplier || filterNoInvoice)
  const total = shown.reduce((s, e) => s + Number(e.amount), 0)
 
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {useRange ? (
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color }}>Période {rangeLabel(range)}</h2>
          ) : (
            <>
              <button onClick={() => setMonth(shiftMonth(month, -1))} style={{ border: '1px solid #ddd', background: 'white', borderRadius: '0.4rem', padding: '0.3rem 0.65rem', cursor: 'pointer', fontWeight: 600 }}>‹</button>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color }}>{formatMonth(month)}</h2>
              <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={month === currentMonth} style={{ border: '1px solid #ddd', background: 'white', borderRadius: '0.4rem', padding: '0.3rem 0.65rem', cursor: month === currentMonth ? 'default' : 'pointer', opacity: month === currentMonth ? 0.4 : 1, fontWeight: 600 }}>›</button>
            </>
          )}
          <DateRangeFilter value={range} onChange={setRange} color={color} />
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{showForm ? 'Annuler' : '+ Ajouter'}</button>
      </div>
 
      <div className="card filters-bar" style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-input" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Statut</option>
          <option value="pending">En attente</option>
          <option value="validated">Validés</option>
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}>
          <option value="">Employé</option>
          {employees.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">Catégorie</option>
          {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={filterPayment} onChange={e => setFilterPayment(e.target.value)}>
          <option value="">Paiement</option>
          {paymentModes.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input className="form-input" style={{ width: 'auto', minWidth: '9rem' }} list={`suppliers-${type}`} value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}
          placeholder={type === 'cb' ? '🔍 Fournisseur' : '🔍 Client'} />
        <datalist id={`suppliers-${type}`}>
          {supplierOptions.map(n => <option key={n} value={n} />)}
        </datalist>
        {hasExtraFilter && (
          <button type="button" onClick={() => { setFilterStatus(''); setFilterEmployee(''); setFilterCategory(''); setFilterPayment(''); setFilterSupplier(''); setFilterNoInvoice(false) }}
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}>Effacer les filtres</button>
        )}
        <span style={{ marginLeft: 'auto', fontWeight: 600, color }}>
          {hasExtraFilter && <span style={{ fontWeight: 400, fontSize: '0.8rem', color: '#888', marginRight: '0.5rem' }}>{shown.length} ligne{shown.length > 1 ? 's' : ''}</span>}
          Total : {fmt(total)}
        </span>
      </div>

      {type === 'cash' && toInvoiceCount > 0 && !filterNoInvoice && (
        <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: '#FAF6F2', border: '1px solid #EADBCB', borderRadius: '0.4rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          🧾 <strong>{toInvoiceCount} encaissement{toInvoiceCount > 1 ? 's' : ''} client{toInvoiceCount > 1 ? 's' : ''} sans facture</strong> ce mois (par exemple saisi{toInvoiceCount > 1 ? 's' : ''} par un employé).
          <button type="button" onClick={() => setFilterNoInvoice(true)} style={{ background: '#8B4513', color: 'white', border: 'none', borderRadius: '0.4rem', padding: '0.3rem 0.7rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Afficher</button>
        </div>
      )}
      {formSuccess && (
        <div style={{ color: 'var(--green)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: '#F0FDF4', borderRadius: '0.4rem', border: '1px solid #86efac', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {formSuccess}
          {type === 'cash' && fLastEntry && !invoiceByEntry[fLastEntry.id] && taxRate !== null && (
            <button type="button" onClick={() => setInvoiceFor(fLastEntry)} style={{ padding: '0.35rem 0.8rem', background: '#8B4513', color: 'white', border: 'none', borderRadius: '0.4rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
              🧾 Créer la facture client
            </button>
          )}
        </div>
      )}
      {!showForm && formError && <p style={{ color: 'var(--red)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: '#FEF2F2', borderRadius: '0.4rem', border: '1px solid #fca5a5' }}>{formError}</p>}
 
      {showForm && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
 
            {/* Encaissements : on commence par le montant total et le mode de paiement */}
            {type === 'cash' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.3rem' }}>Montant total encaissé *</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input className="form-input" type="number" step="0.01" min="0" inputMode="decimal" value={cashTotal} onChange={e => setCashTotal(e.target.value)} placeholder="0.00" required autoFocus
                      style={{ fontSize: '1.25rem', fontWeight: 700, maxWidth: 220 }} />
                    <span style={{ fontWeight: 700, color: '#666' }}>{fCurrency}</span>
                  </div>
                </div>
                {paymentFields}
                {fPayment === 'CB' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8rem', color: '#666' }}>
                    Carte :
                    {([['amex', 'American Express (3,3 %)'], ['other', 'Autre carte (2,68 %)']] as const).map(([val, lbl]) => (
                      <button key={val} type="button" onClick={() => { setFCardType(val); setCashTotal(cashTotal, 'CB', val) }}
                        style={{ padding: '0.25rem 0.6rem', border: `1px solid ${fCardType === val ? color : '#ddd'}`, borderRadius: '999px', background: fCardType === val ? '#F0FDF4' : 'white', color: fCardType === val ? color : '#555', fontWeight: fCardType === val ? 700 : 400, cursor: 'pointer', fontSize: '0.78rem' }}>{lbl}</button>
                    ))}
                    {fTransactionAmount && <span style={{ marginLeft: 'auto' }}>Commission {fmt(parseFloat(fTransactionAmount) - (parseFloat(fAmount) || 0))} · <strong style={{ color }}>Net reçu {fmt(parseFloat(fAmount) || 0)}</strong></span>}
                  </div>
                )}
              </div>
            )}

            {/* Upload zone — identique page employé */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                {type === 'cb' ? 'Facture' : fInvoice ? 'Facture client' : 'Ticket ou facture client'}
                {!fInvoice && <span style={{ color: '#888', fontWeight: 400 }}> (optionnel — peut être ajouté plus tard)</span>}
              </label>
              {type === 'cash' && fInvoice ? (
                <div style={{ position: 'relative', border: '2px solid #D9B99B', borderRadius: '0.5rem', padding: '1rem', background: '#FAF6F2' }}>
                  <button type="button" onClick={() => setFInvoice(false)} title="Ne pas créer de facture"
                    style={{ position: 'absolute', top: '0.35rem', right: '0.35rem', background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>×</button>
                  <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#8B4513', marginBottom: '0.75rem' }}>🧾 Facture client — numérotée automatiquement à l&apos;enregistrement</p>
                  <InvoiceEditor draft={fInvDraft} onChange={setFInvDraft} gross={invoiceGross} taxRate={taxRate ?? 0} childRate={childRate} rates={tvaRates} autoFocus />
                  <p style={{ fontSize: '0.72rem', color: '#999', marginTop: '0.5rem' }}>La taxe de séjour et les lignes sont déduites du montant total encaissé ; le reste correspond à l&apos;hébergement.</p>
                </div>
              ) : (
              <div
                ref={fDropZoneRef}
                style={{ position: 'relative', border: `2px dashed ${fDragCounter > 0 ? (type === 'cb' ? 'var(--terracotta)' : 'var(--green)') : fFile ? 'var(--green)' : '#ddd'}`, borderRadius: '0.5rem', padding: '1.25rem', textAlign: 'center', background: fDragCounter > 0 ? (type === 'cb' ? '#FFF5F0' : '#F0FDF4') : fExtracting ? '#FFFBF0' : fFile ? '#F0FDF4' : '#FAFAFA', transition: 'all 0.15s' }}
              >
                {fFile && !fExtracting && (
                  <button type="button" onClick={e => { e.stopPropagation(); setFFile(null); setFFilePreview(null); if (fFileRef.current) fFileRef.current.value = '' }}
                    style={{ position: 'absolute', top: '0.35rem', left: '0.35rem', background: 'rgba(239,68,68,0.9)', border: 'none', borderRadius: '50%', width: '1.3rem', height: '1.3rem', color: 'white', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, lineHeight: 1, padding: 0 }}>×</button>
                )}
                {fExtracting ? (
                  <div>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>⏳</div>
                    <div style={{ fontSize: '0.85rem', color: '#888' }}>Analyse du document en cours…</div>
                  </div>
                ) : fFile ? (
                  <div onClick={() => fFileRef.current?.click()} style={{ cursor: 'pointer' }}>
                    {fFilePreview && <img src={fFilePreview} alt="Aperçu" style={{ maxHeight: 120, maxWidth: '100%', marginBottom: '0.5rem', borderRadius: '0.3rem', objectFit: 'contain' }} />}
                    <div style={{ fontSize: '0.85rem', color: 'var(--green)', fontWeight: 600 }}>✓ {fFile.name}</div>
                    {fExtracted && <div style={{ fontSize: '0.75rem', color: 'var(--green)', marginTop: '0.2rem' }}>Données extraites automatiquement — vérifiez ci-dessous</div>}
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.2rem' }}>Cliquer ou glisser pour changer</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{fDragCounter > 0 ? '⬇️' : (type === 'cb' ? '📄' : '🧾')}</div>
                    <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.75rem' }}>{type === 'cb' ? 'Glisser la facture ici' : 'Glisser le ticket ici'}</div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <label style={{ padding: '0.5rem 0.875rem', background: type === 'cb' ? '#FFF5F0' : '#F0FDF4', border: `1px solid ${type === 'cb' ? 'var(--terracotta)' : 'var(--green)'}`, borderRadius: '0.5rem', color: type === 'cb' ? 'var(--terracotta)' : 'var(--green)', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                        📷 Photo
                        <input type="file" accept="image/*" capture="environment" onChange={handleFileSelect} style={{ display: 'none' }} />
                      </label>
                      <label style={{ padding: '0.5rem 0.875rem', background: '#F8F8F8', border: '1px solid #ddd', borderRadius: '0.5rem', color: '#555', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                        📁 Fichier
                        <input type="file" accept="image/*,application/pdf" onChange={handleFileSelect} style={{ display: 'none' }} />
                      </label>
                    </div>
                    {type === 'cash' && (
                      <button type="button" onClick={() => setFInvoice(true)} disabled={taxRate === null}
                        style={{ marginTop: '0.75rem', padding: '0.5rem 0.875rem', background: '#8B4513', border: 'none', borderRadius: '0.5rem', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                        🧾 Créer une facture client
                      </button>
                    )}
                    <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: '0.5rem' }}>Image ou PDF — les champs seront remplis automatiquement{type === 'cash' ? ' · ou créez la facture client (nuits, personnes, taxe de séjour)' : ''}</div>
                  </div>
                )}
              </div>
              )}
              <input ref={fFileRef} type="file" accept="image/*,application/pdf" onChange={handleFileSelect} style={{ display: 'none' }} />
            </div>
 
            {/* Champs auto-remplis et modifiables */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Date *</label>
                <input className="form-input" type="date" value={fDate} onChange={e => setFDate(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Employé</label>
                <select className="form-input" value={fEmployee || me} onChange={e => setFEmployee(e.target.value)}>
                  {employeeChoices.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              {type === 'cb' && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Fournisseur</label>
                  <input className="form-input" value={fSupplier} onChange={e => setFSupplier(e.target.value)} placeholder="Nom du fournisseur" />
                </div>
              )}
            </div>
 
            {/* Dépenses : montants HT / TVA / TTC puis mode de paiement */}
            {type === 'cb' && (
              <>
              <div style={{ background: '#F8F8F8', border: '1px solid #EEE', borderRadius: '0.5rem', padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#666', marginBottom: '0.1rem' }}>Montants</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '0.625rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}>Montant HT</label>
                    <input className="form-input" type="number" step="0.01" min="0" value={fAmountHT} onChange={e => {
                      setFAmountHT(e.target.value)
                      const ht = parseFloat(e.target.value)
                      const tva = parseFloat(fTvaRate)
                      if (!isNaN(ht) && !isNaN(tva)) setFAmount(String((ht * (1 + tva / 100)).toFixed(2)))
                    }} placeholder="0.00" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}>TVA %</label>
                    <input className="form-input" type="number" step="0.1" min="0" value={fTvaRate} onChange={e => {
                      setFTvaRate(e.target.value)
                      const ht = parseFloat(fAmountHT)
                      const tva = parseFloat(e.target.value)
                      if (!isNaN(ht) && !isNaN(tva)) setFAmount(String((ht * (1 + tva / 100)).toFixed(2)))
                    }} placeholder="20" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}>Montant TTC *</label>
                    <input className="form-input" type="number" step="0.01" min="0" value={fAmount} onChange={e => setFAmount(e.target.value)} placeholder="0.00" required />
                  </div>
                </div>
              </div>
                {paymentFields}
              </>
            )}

            {/* Catégorie + Description */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Catégorie *</label>
                <select className="form-input" value={fCategory} onChange={e => setFCategory(e.target.value)}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Description</label>
                <input className="form-input" value={fDescription} onChange={e => setFDescription(e.target.value)} placeholder="Note optionnelle" />
              </div>
            </div>
 
            {/* N° de chèque / facture */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                N° de facture/chèque
              </label>
              <input className="form-input" value={fReference} onChange={e => setFReference(e.target.value)} placeholder="Ex : FA-2026-045 ou 1234567" />
            </div>
 
            {/* Facture à envoyer au comptable */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
              <input type="checkbox" checked={fToAccountant} onChange={e => setFToAccountant(e.target.checked)} style={{ width: '1.1rem', height: '1.1rem', accentColor: color }} />
              Facture à envoyer au comptable
            </label>
 
            {/* Nom du client (pour encaissements) — saisi dans la facture si elle est créée */}
            {type === 'cash' && !fInvoice && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Nom du client</label>
                <input className="form-input" type="text" value={fClientName} onChange={e => setFClientName(e.target.value)} placeholder="(optionnel)" />
              </div>
            )}
 
            {formError && <p style={{ color: 'var(--red)', fontSize: '0.875rem' }}>{formError}</p>}
            <button className="btn-primary" type="submit" disabled={submitting || fUploading || fExtracting}>{fExtracting ? '🤖 Analyse document…' : fUploading ? '⬆️ Upload…' : submitting ? 'Enregistrement…' : 'Enregistrer'}</button>
          </form>
        </div>
      )}
 
 
      {loading ? <p>Chargement…</p> : shown.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: '#aaa', padding: '2rem' }}>{entries.length === 0 ? (useRange ? 'Aucune entrée sur cette période' : 'Aucune entrée pour ce mois') : 'Aucune entrée ne correspond aux filtres'}</div>
      ) : (
        <div className="table-scroll">
          <table className="table-dep">
            <thead>
              <tr>
                <th>Date</th><th>Employé</th><th>Catégorie</th>
                {type === 'cb' && <th>Fournisseur</th>}
                <th>Paiement</th>
                <th>N° fact./chèque</th>
                <th>Description</th>
                <th>Devise</th><th>Montant</th>
                <th>Justificatif</th>
                {type === 'cash' && <th title="Facture client (numérotée) avec la taxe de séjour">Facture</th>}
                <th title="Facture à envoyer au comptable">Compta.</th>
                <th>Statut</th><th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map(e => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <input type="date" defaultValue={e.date} key={`${e.id}-${e.date}`} title="Modifier la date"
                      onBlur={ev => changeDate(e, ev.target.value)}
                      onKeyDown={ev => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur() }}
                      style={{ border: '1px solid transparent', borderRadius: '0.3rem', background: 'transparent', font: 'inherit', fontSize: '0.8rem', padding: '0.1rem 0.1rem', cursor: 'pointer', width: '7.3rem' }}
                      onFocus={ev => { ev.target.style.borderColor = '#ddd'; ev.target.style.background = 'white' }} />
                  </td>
                  <td>{e.employee_name}</td>
                  <td>{e.category}</td>
                  {type === 'cb' && <td className="col-wrap">{e.supplier || '—'}</td>}
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <select
                      value={e.payment === 'Espèces' ? `Espèces|${e.cash_location === 'coffre' ? 'coffre' : 'fonds'}` : (e.payment || '')}
                      onChange={ev => changePayment(e, ev.target.value)}
                      title="Modifier le mode de paiement"
                      style={{ border: '1px solid transparent', background: 'transparent', borderRadius: '0.3rem', padding: '0.15rem 0', font: 'inherit', fontSize: '0.8rem', cursor: 'pointer', color: 'inherit', maxWidth: '8.5rem' }}
                      onMouseEnter={ev => { ev.currentTarget.style.borderColor = '#ddd' }}
                      onMouseLeave={ev => { ev.currentTarget.style.borderColor = 'transparent' }}>
                      {!e.payment && <option value="">—</option>}
                      {(type === 'cb' ? PAYMENT_MODES_DEPENSES : PAYMENT_MODES_ENCAISSEMENTS).filter(p => p !== 'Espèces').map(p => <option key={p} value={p}>{p}</option>)}
                      <option value="Espèces|fonds">Espèces · caisse</option>
                      <option value="Espèces|coffre">Espèces · coffre</option>
                    </select>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: '#666', whiteSpace: 'nowrap' }}>{e.reference || '—'}</td>
                  <td className="col-wrap" style={{ fontSize: '0.8rem', color: '#666' }}>
                    <textarea defaultValue={(e.description as string) || ''} key={`${e.id}-${e.description ?? ''}`} rows={1} placeholder="—" title="Modifier la description"
                      className="desc-edit"
                      onInput={ev => { const t = ev.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }}
                      onFocus={ev => { const t = ev.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }}
                      onBlur={ev => changeDescription(e, ev.target.value)}
                      onKeyDown={ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); (ev.target as HTMLTextAreaElement).blur() } if (ev.key === 'Escape') { (ev.target as HTMLTextAreaElement).value = (e.description as string) || ''; (ev.target as HTMLTextAreaElement).blur() } }} />
                  </td>
                  <td><span style={{ fontWeight: 600, fontSize: '0.8rem', background: '#F3F4F6', padding: '0.15rem 0.4rem', borderRadius: '0.3rem' }}>{(e.currency as string) || 'MAD'}</span></td>
                  <td style={{ fontWeight: 600, color, whiteSpace: 'nowrap' }}>{fmt(Number(e.amount))}</td>
                  <td>
                    {e.invoice_url
                      ? <a href={e.invoice_url as string} onClick={ev => { ev.preventDefault(); openAttachment(e.invoice_url as string) }} style={{ color: 'var(--blue)', fontSize: '0.8rem', cursor: 'pointer' }}>{type === 'cash' ? '🧾 Ticket' : '📄 Facture'}</a>
                      : <button onClick={() => { setPendingUploadEntry(e.id); rowFileRef.current?.click() }} disabled={uploadingEntryId === e.id} style={{ background: 'none', border: '1px dashed #aaa', borderRadius: '0.3rem', color: '#888', cursor: 'pointer', fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}>{uploadingEntryId === e.id ? '⬆️…' : '📎 Ajouter'}</button>
                    }
                  </td>
                  {type === 'cash' && (
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {invoiceByEntry[e.id] ? (
                        <>
                          <button onClick={() => downloadInvoice(invoiceByEntry[e.id])} title="Télécharger la facture" style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}>📄 {invoiceByEntry[e.id].number}</button>
                          <button onClick={() => setInvoiceFor(e)} title="Modifier la facture" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#999', marginLeft: '0.3rem', padding: 0 }}>✎</button>
                        </>
                      ) : (
                        <button onClick={() => setInvoiceFor(e)} disabled={taxRate === null} title="Créer la facture client (nuits, personnes, taxe de séjour)" style={{ background: '#FAF6F2', border: '1px solid #D9B99B', color: '#8B4513', borderRadius: '0.3rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.45rem' }}>🧾 Créer</button>
                      )}
                    </td>
                  )}
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox" checked={!!e.to_accountant} onChange={() => toggleAccountant(e)} title="Facture à envoyer au comptable" style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer', accentColor: color }} />
                  </td>
                  <td><span className={e.status === 'validated' ? 'badge-validated' : 'badge-pending'}>{e.status === 'validated' ? 'Validé' : 'En attente'}</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}><div style={{ display: 'flex', gap: '0.3rem' }}>
                    <button onClick={() => toggleStatus(e)} style={{ background: e.status === 'pending' ? 'var(--green)' : '#888', color: 'white', border: 'none', borderRadius: '0.4rem', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem' }}>{e.status === 'pending' ? '✓' : '↩'}</button>
                    <button onClick={() => setDeleteModal(e.id)} style={{ background: 'var(--red)', color: 'white', border: 'none', borderRadius: '0.4rem', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem' }}>🗑</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
 
      <input ref={rowFileRef} type="file" accept="image/*,application/pdf" onChange={handleRowUpload} style={{ display: 'none' }} />

      {invoiceFor && taxRate !== null && (
        <InvoiceModal entry={invoiceFor} invoice={invoiceByEntry[invoiceFor.id] ?? null} taxRate={taxRate} childRate={childRate} rates={tvaRates}
          onClose={() => setInvoiceFor(null)}
          onSaved={() => {
            setInvoiceFor(null); setFLastEntry(null); reloadInvoices()
            // La création de facture coche « à envoyer au comptable » côté serveur
            fetchEntries()
          }} />
      )}
 
      {deleteModal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ maxWidth: 340, width: '90%', textAlign: 'center' }}>
            <p style={{ marginBottom: invoiceByEntry[deleteModal] ? '0.4rem' : '1rem', fontWeight: 600 }}>Supprimer cette entrée ?</p>
            {invoiceByEntry[deleteModal] && <p style={{ marginBottom: '1rem', fontSize: '0.8rem', color: '#666' }}>Sa facture {invoiceByEntry[deleteModal].number} sera aussi supprimée et sa taxe de séjour ne sera plus comptée.</p>}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => setDeleteModal(null)}>Annuler</button>
              <button className="btn-red" onClick={() => deleteEntry(deleteModal)}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
 
// ─── Fond de caisse Tab ───────────────────────────────────────────────────────
 
function FondsTab() {
  const [cashEntries, setCashEntries] = useState<Entry[]>([])
  const [fondsEntries, setFondsEntries] = useState<FondsEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [compteMAD, setCompteMAD] = useState('')
  const [compteEUR, setCompteEUR] = useState('')
  const [recSaving, setRecSaving] = useState(false)
  const [recMsg, setRecMsg] = useState('')
  const [recs, setRecs] = useState<Array<{ id: number; employee_name: string; counted_mad: number | null; counted_eur: number | null; expected_mad: number | null; expected_eur: number | null; created_at: string }>>([])
  const loadRecs = useCallback(async () => {
    const r = await fetch('/api/reconciliations', { cache: 'no-store' }).catch(() => null)
    if (r && r.ok) setRecs(await r.json())
  }, [])
  useEffect(() => { loadRecs() }, [loadRecs])
  async function saveReconciliation() {
    setRecSaving(true); setRecMsg('')
    const r = await fetch('/api/reconciliations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ counted_mad: compteMAD, counted_eur: compteEUR }) }).catch(() => null)
    if (r && r.ok) { setRecMsg('✓ Rapprochement enregistré'); setCompteMAD(''); setCompteEUR(''); loadRecs() }
    else setRecMsg("Erreur : le rapprochement n'a pas été enregistré.")
    setRecSaving(false)
  }
  const [msg, setMsg] = useState('')
  const [deleteTransfer, setDeleteTransfer] = useState<string | null>(null)
 
  // Transfert coffre ↔ fond de caisse
  const [tDirection, setTDirection] = useState<'coffre_to_fonds' | 'fonds_to_coffre'>('coffre_to_fonds')
  const [tDate, setTDate] = useState(new Date().toISOString().split('T')[0])
  const [tAmount, setTAmount] = useState('')
  const [tCurrency, setTCurrency] = useState<'MAD' | 'EUR'>('MAD')
  const [tDescription, setTDescription] = useState('')
  const [tSubmitting, setTSubmitting] = useState(false)
  const [tError, setTError] = useState('')
 
  const reload = useCallback(async () => {
    setLoading(true)
    const [ents, fonds] = await Promise.all([
      fetch('/api/entries').then(r => r.json()),
      fetch('/api/fonds').then(r => r.json()),
    ])
    setCashEntries(Array.isArray(ents) ? ents : [])
    setFondsEntries(Array.isArray(fonds) ? fonds : [])
    setLoading(false)
  }, [])
 
  useEffect(() => { reload() }, [reload])
 
  // Solde = espèces passées par le fond de caisse (hors coffre) + mouvements du fond de caisse (transferts…)
  const balanceOf = useCallback((cur: 'MAD' | 'EUR') => {
    const isCur = (c?: string | null) => cur === 'MAD' ? (c === 'MAD' || !c) : c === 'EUR'
    const viaFonds = (e: Entry) => e.payment === 'Espèces' && e.cash_location !== 'coffre' && isCur(e.currency)
    const cashIn = cashEntries.filter(e => e.type === 'cash' && viaFonds(e)).reduce((s, e) => s + Number(e.amount), 0)
    const cashOut = cashEntries.filter(e => e.type === 'cb' && viaFonds(e)).reduce((s, e) => s + Number(e.amount), 0)
    const adj = fondsEntries.filter(e => isCur(e.currency)).reduce((s, e) => s + (e.direction === 'in' ? Number(e.amount) : -Number(e.amount)), 0)
    return cashIn - cashOut + adj
  }, [cashEntries, fondsEntries])
 
  const balanceMAD = useMemo(() => balanceOf('MAD'), [balanceOf])
  const balanceEUR = useMemo(() => balanceOf('EUR'), [balanceOf])

  // Historique complet de la caisse : dépenses et encaissements en espèces passés par la caisse
  // + mouvements propres à la caisse (transferts coffre ↔ caisse, ajustements), avec le solde après chaque ligne.
  type CaisseRow = {
    key: string; date: string; created: string; employee: string; kind: string; category: string
    label: string; currency: 'MAD' | 'EUR'; signed: number; invoice?: string | null; transferId?: string | null; solde: number
  }
  const [histMonth, setHistMonth] = useState('')
  const [histCurrency, setHistCurrency] = useState<'MAD' | 'EUR'>('MAD')
  const caisseRows = useMemo(() => {
    const rows: Omit<CaisseRow, 'solde'>[] = []
    for (const e of cashEntries) {
      if (e.payment !== 'Espèces' || e.cash_location === 'coffre') continue
      rows.push({
        key: `e${e.id}`, date: e.date, created: (e.created_at as string) || '', employee: e.employee_name,
        kind: e.type === 'cash' ? 'Encaissement' : 'Dépense', category: e.category,
        label: [e.supplier, e.description].filter(Boolean).join(' — '),
        currency: e.currency === 'EUR' ? 'EUR' : 'MAD',
        signed: (e.type === 'cash' ? 1 : -1) * Number(e.amount), invoice: (e.invoice_url as string) || null,
      })
    }
    for (const f of fondsEntries) {
      rows.push({
        key: `f${f.id}`, date: f.date, created: f.created_at || '', employee: f.employee_name,
        kind: f.transfer_id ? 'Transfert coffre' : 'Mouvement caisse', category: f.category,
        label: f.description || '', currency: f.currency === 'EUR' ? 'EUR' : 'MAD',
        signed: (f.direction === 'in' ? 1 : -1) * Number(f.amount), transferId: f.transfer_id || null,
      })
    }
    rows.sort((a, b) => a.date.localeCompare(b.date) || a.created.localeCompare(b.created))
    const run = { MAD: 0, EUR: 0 }
    const withSolde: CaisseRow[] = rows.map(r => { run[r.currency] += r.signed; return { ...r, solde: run[r.currency] } })
    return withSolde.reverse() // plus récent en premier
  }, [cashEntries, fondsEntries])
  const histMonths = useMemo(() => Array.from(new Set(caisseRows.map(r => r.date.substring(0, 7)))).sort().reverse(), [caisseRows])
  const [histRange, setHistRange] = useState<DateRange>(EMPTY_RANGE)
  const shownCaisse = caisseRows.filter(r => r.currency === histCurrency && (!histMonth || r.date.startsWith(histMonth)) && inRange(r.date, histRange))
  const histIn = shownCaisse.filter(r => r.signed > 0).reduce((s, r) => s + r.signed, 0)
  const histOut = shownCaisse.filter(r => r.signed < 0).reduce((s, r) => s - r.signed, 0)
 
  async function submitTransfer(e: React.FormEvent) {
    e.preventDefault()
    setTSubmitting(true); setTError('')
    const r = await fetch('/api/transfers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ direction: tDirection, date: tDate, amount: parseFloat(tAmount), currency: tCurrency, description: tDescription || null }) }).catch(() => null)
    if (r && r.ok) {
      setTAmount(''); setTDescription('')
      await reload()
      setMsg('✓ Transfert enregistré (visible aussi dans le Coffre fort)')
      setTimeout(() => setMsg(''), 4000)
    } else {
      const d = r ? await r.json().catch(() => ({})) : {}
      setTError(d.error || 'Erreur lors du transfert')
    }
    setTSubmitting(false)
  }
 
  async function confirmDeleteTransfer(id: string) {
    await fetch(`/api/transfers?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    setDeleteTransfer(null)
    reload()
  }
 
  if (loading) return <p>Chargement…</p>
 
  return (
    <div>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#6366F1', marginBottom: '1rem' }}>💰 Fond de caisse</h2>
 
      {/* Soldes auto-calculés */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {[{ cur: 'MAD', bal: balanceMAD }, { cur: 'EUR', bal: balanceEUR }].map(({ cur, bal }) => (
          <div key={cur} className="stat-card" style={{ borderLeftColor: '#6366F1' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6366F1', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Solde {cur}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4338CA' }}>{fmt(bal)} {cur}</div>
          </div>
        ))}
      </div>
 
      {/* Rapprochement */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.75rem', color: '#374151' }}>🔍 Rapprochement caisse</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
          {[{ cur: 'MAD', bal: balanceMAD, val: compteMAD, set: setCompteMAD }, { cur: 'EUR', bal: balanceEUR, val: compteEUR, set: setCompteEUR }].map(({ cur, bal, val, set }) => {
            const diff = parseFloat(val || '0') - bal
            return (
              <div key={cur}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>Montant compté {cur}</label>
                <input className="form-input" type="number" step="0.01" value={val} onChange={e => set(e.target.value)} placeholder={`0.00 ${cur}`} />
                {val && (
                  <div style={{ marginTop: '0.3rem', fontSize: '0.85rem', fontWeight: 600, color: Math.abs(diff) < 0.01 ? 'var(--green)' : 'var(--red)' }}>
                    {Math.abs(diff) < 0.01 ? '✓ OK' : `Écart : ${diff > 0 ? '+' : ''}${fmt(diff)} ${cur}`}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <button type="button" onClick={saveReconciliation} disabled={recSaving || (!compteMAD && !compteEUR)} className="btn-primary"
          style={{ marginTop: '0.75rem', background: '#6366F1', opacity: (!compteMAD && !compteEUR) ? 0.5 : 1 }}>
          {recSaving ? 'Enregistrement…' : '✓ Enregistrer le rapprochement'}
        </button>
        {recMsg && <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: recMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{recMsg}</span>}
        {recs.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', marginBottom: '0.35rem' }}>Derniers rapprochements</div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr><th>Date</th><th>Par</th><th>Compté MAD</th><th>Écart MAD</th><th>Compté EUR</th><th>Écart EUR</th></tr></thead>
                <tbody>
                  {recs.slice(0, 10).map(r => {
                    const d = new Date(r.created_at.replace(' ', 'T') + 'Z')
                    const ecart = (c: number | null, e: number | null) => {
                      if (c === null || c === undefined) return <span style={{ color: '#bbb' }}>—</span>
                      const diff = Math.round((Number(c) - Number(e || 0)) * 100) / 100
                      return <span style={{ fontWeight: 600, color: Math.abs(diff) < 0.01 ? 'var(--green)' : 'var(--red)' }}>{Math.abs(diff) < 0.01 ? '✓ 0' : `${diff > 0 ? '+' : ''}${fmt(diff)}`}</span>
                    }
                    return (
                      <tr key={r.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{d.toLocaleDateString('fr-FR')} {d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                        <td>{r.employee_name}</td>
                        <td>{r.counted_mad !== null ? fmt(Number(r.counted_mad)) : '—'}</td>
                        <td>{ecart(r.counted_mad, r.expected_mad)}</td>
                        <td>{r.counted_eur !== null ? fmt(Number(r.counted_eur)) : '—'}</td>
                        <td>{ecart(r.counted_eur, r.expected_eur)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
 
      {/* Transfert coffre ↔ fond de caisse */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.75rem', color: '#6366F1' }}>🔁 Transfert coffre fort ↔ fond de caisse</h3>
        <form onSubmit={submitTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {([['coffre_to_fonds', '🔐 Coffre → 💰 Caisse'], ['fonds_to_coffre', '💰 Caisse → 🔐 Coffre']] as const).map(([val, lbl]) => (
              <button key={val} type="button" onClick={() => setTDirection(val)} style={{ flex: 1, padding: '0.5rem', border: `2px solid ${tDirection === val ? '#6366F1' : '#ddd'}`, borderRadius: '0.5rem', background: tDirection === val ? '#EEF2FF' : 'white', fontWeight: tDirection === val ? 700 : 400, cursor: 'pointer', color: tDirection === val ? '#4338CA' : 'var(--text)', fontSize: '0.85rem' }}>{lbl}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Date *</label>
              <input className="form-input" type="date" value={tDate} onChange={e => setTDate(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Montant *</label>
              <input className="form-input" type="number" step="0.01" min="0.01" value={tAmount} onChange={e => setTAmount(e.target.value)} placeholder="0.00" required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Devise</label>
              <select className="form-input" value={tCurrency} onChange={e => setTCurrency(e.target.value as 'MAD' | 'EUR')}>
                <option value="MAD">MAD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Description</label>
              <input className="form-input" value={tDescription} onChange={e => setTDescription(e.target.value)} placeholder="Note optionnelle" />
            </div>
          </div>
          {tError && <p style={{ color: 'var(--red)', fontSize: '0.85rem' }}>{tError}</p>}
          {msg && <p style={{ color: 'var(--green)', fontSize: '0.85rem' }}>{msg}</p>}
          <button className="btn-primary" type="submit" disabled={tSubmitting || !tAmount} style={{ background: '#6366F1', opacity: !tAmount ? 0.5 : 1 }}>
            {tSubmitting ? 'Enregistrement…' : 'Enregistrer le transfert'}
          </button>
        </form>
      </div>
 
      {/* Historique complet de la caisse */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#374151' }}>📋 Historique de la caisse</h3>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <DateRangeFilter value={histRange} onChange={setHistRange} />
            <select className="form-input" style={{ width: 'auto' }} value={histMonth} onChange={e => setHistMonth(e.target.value)}>
              <option value="">Tous les mois</option>
              {histMonths.map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
            </select>
            <select className="form-input" style={{ width: 'auto' }} value={histCurrency} onChange={e => setHistCurrency(e.target.value as 'MAD' | 'EUR')}>
              <option value="MAD">MAD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.75rem' }}>
          Toutes les dépenses et encaissements en espèces passés par la caisse, et les transferts avec le coffre.
          {' '}<span style={{ color: 'var(--green)', fontWeight: 600 }}>Entrées {fmt(histIn)}</span>
          {' · '}<span style={{ color: 'var(--red)', fontWeight: 600 }}>Sorties {fmt(histOut)}</span>
        </p>
        {shownCaisse.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#aaa', padding: '1.5rem' }}>Aucun mouvement</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr><th>Date</th><th>Employé</th><th>Type</th><th>Catégorie</th><th className="col-wrap">Description</th><th>Entrée</th><th>Sortie</th><th>Solde</th><th>Justif.</th><th></th></tr>
              </thead>
              <tbody>
                {shownCaisse.map(r => (
                  <tr key={r.key}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(r.date + 'T00:00:00').toLocaleDateString('fr-FR')}</td>
                    <td>{r.employee}</td>
                    <td style={{ fontSize: '0.8rem', fontWeight: 600, color: r.kind === 'Dépense' ? 'var(--terracotta)' : r.kind === 'Encaissement' ? 'var(--green)' : '#6366F1' }}>{r.kind}</td>
                    <td>{r.category}</td>
                    <td className="col-wrap" style={{ fontSize: '0.85rem', color: '#666' }}>{r.label || '—'}</td>
                    <td style={{ fontWeight: 600, color: 'var(--green)', whiteSpace: 'nowrap' }}>{r.signed > 0 ? fmt(r.signed) : ''}</td>
                    <td style={{ fontWeight: 600, color: 'var(--red)', whiteSpace: 'nowrap' }}>{r.signed < 0 ? fmt(-r.signed) : ''}</td>
                    <td style={{ fontWeight: 700, color: '#4338CA', whiteSpace: 'nowrap' }}>{fmt(r.solde)}</td>
                    <td>{r.invoice ? <a href={r.invoice} onClick={ev => { ev.preventDefault(); openAttachment(r.invoice) }} style={{ color: 'var(--blue)', fontSize: '0.8rem', cursor: 'pointer' }}>📄 Voir</a> : <span style={{ color: '#bbb', fontSize: '0.8rem' }}>—</span>}</td>
                    <td>
                      {r.transferId && (
                        <button onClick={() => setDeleteTransfer(r.transferId!)} title="Supprimer le transfert (des deux côtés)" style={{ background: 'var(--red)', color: 'white', border: 'none', borderRadius: '0.4rem', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem' }}>🗑</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteTransfer !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ maxWidth: 360, width: '90%', textAlign: 'center' }}>
            <p style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Supprimer ce transfert ?</p>
            <p style={{ marginBottom: '1rem', fontSize: '0.85rem', color: '#888' }}>Il sera retiré du fond de caisse et du coffre fort.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => setDeleteTransfer(null)}>Annuler</button>
              <button className="btn-red" onClick={() => confirmDeleteTransfer(deleteTransfer)}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
 
// ─── Banque Tab ───────────────────────────────────────────────────────────────
 
// ─── Banque : mouvements et relevés (Attijari, CMI, Amex) ─────────────────────

function BanqueTab() {
  const [section, setSection] = useState<'mouvements' | StatementSource>('mouvements')
  const sections: { id: 'mouvements' | StatementSource; label: string }[] = [
    { id: 'mouvements', label: '🏦 Mouvements' },
    ...(['attijari', 'cmi', 'amex'] as const).map(id => ({ id, label: `📄 Relevés ${STATEMENT_LABELS[id]}` })),
  ]
  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{ padding: '0.45rem 0.9rem', borderRadius: '999px', border: `1px solid ${section === s.id ? '#3730A3' : '#ddd'}`, background: section === s.id ? '#3730A3' : 'white', color: section === s.id ? 'white' : 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>{s.label}</button>
        ))}
      </div>
      {section === 'mouvements' ? <BanqueMouvements /> : <StatementsPanel key={section} source={section} />}
    </div>
  )
}

function BanqueMouvements() {
  const [allEntries, setAllEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [soldeInitMAD, setSoldeInitMAD] = useState('')
  const [targetMAD, setTargetMAD] = useState(0)
  const [savingSolde, setSavingSolde] = useState(false)
  const [msg, setMsg] = useState('')
 
  const reload = useCallback(async () => {
    setLoading(true)
    const [ents, settings] = await Promise.all([
      fetch('/api/entries').then(r => r.json()),
      fetch('/api/settings/solde-bancaire').then(r => r.json()).catch(() => ({})),
    ])
    setAllEntries(Array.isArray(ents) ? ents : [])
    if (settings?.solde_bancaire_mad !== undefined) setTargetMAD(settings.solde_bancaire_mad)
    setLoading(false)
  }, [])
 
  useEffect(() => { reload() }, [reload])
 
  async function togglePointed(entry: Entry) {
    const next = !entry.pointed
    // Mise à jour optimiste : on affiche le changement tout de suite, avant la réponse du serveur
    setAllEntries(prev => prev.map(e => (e.id === entry.id && e.type === entry.type ? { ...e, pointed: next } : e)))
    try {
      const r = await fetch(`/api/entries/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pointed: next }),
      })
      if (!r.ok) throw new Error()
    } catch {
      // en cas d'échec, on annule le changement affiché
      setAllEntries(prev => prev.map(e => (e.id === entry.id && e.type === entry.type ? { ...e, pointed: entry.pointed } : e)))
    }
  }
 
  // Mouvements bancaires = tout ce qui n'est PAS payé en espèces (CB, Virement, Chèque),
  // uniquement en MAD (les mouvements en EUR ne sont pas suivis dans cet onglet)
  const bankEntries = useMemo(
    () => allEntries.filter(e => e.payment && e.payment !== 'Espèces' && (!e.currency || e.currency === 'MAD')),
    [allEntries]
  )
 
  function computeBalance(target: number) {
    const inflow = bankEntries.filter(e => e.type === 'cash').reduce((s, e) => s + Number(e.amount), 0)
    const outflow = bankEntries.filter(e => e.type === 'cb').reduce((s, e) => s + Number(e.amount), 0)
    return { balance: target + inflow - outflow, inflow, outflow }
  }
 
  const madStats = useMemo(() => computeBalance(targetMAD), [bankEntries, targetMAD])
 
  // Théorique / Réel / Écart — cumul chronologique, comme dans l'Excel :
  // Théorique compte tous les mouvements, Réel ne compte que les mouvements pointés.
  const bankRows = useMemo(() => {
    const sorted = [...bankEntries].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
    let theorique = targetMAD
    let reel = targetMAD
    return sorted.map(e => {
      const isIn = e.type === 'cash'
      const amt = Number(e.amount)
      theorique += isIn ? amt : -amt
      if (e.pointed) reel += isIn ? amt : -amt
      return { ...e, theorique, reel, ecart: reel - theorique }
    })
  }, [bankEntries, targetMAD])
 
  async function saveSolde() {
    setSavingSolde(true)
    const body: Record<string, number> = {}
    if (soldeInitMAD !== '') body.solde_bancaire_mad = parseFloat(soldeInitMAD)
    await fetch('/api/settings/solde-bancaire', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    await reload()
    setSoldeInitMAD('')
    setMsg('✓ Solde initial mis à jour')
    setTimeout(() => setMsg(''), 4000)
    setSavingSolde(false)
  }
 
  // Filtre de dates sur la liste (les soldes Théorique / Réel restent cumulés)
  const [bankRange, setBankRange] = useState<DateRange>(EMPTY_RANGE)
  const bankShown = bankRows.filter(e => inRange(e.date, bankRange))

  const byMode = useMemo(() => {
    const modes: Record<string, { in: number; out: number }> = {}
    for (const e of bankEntries) {
      const mode = e.payment || '—'
      if (!modes[mode]) modes[mode] = { in: 0, out: 0 }
      if (e.type === 'cash') modes[mode].in += Number(e.amount)
      else modes[mode].out += Number(e.amount)
    }
    return modes
  }, [bankEntries])
 
  if (loading) return <p>Chargement…</p>
 
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#3730A3' }}>🏦 Banque</h2>
        <DateRangeFilter value={bankRange} onChange={setBankRange} color="#3730A3" />
      </div>
      {rangeActive(bankRange) && (
        <div className="card" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
          <b>{bankShown.length} mouvement{bankShown.length > 1 ? 's' : ''} {rangeLabel(bankRange)}</b> · encaissé <span style={{ color: 'var(--green)', fontWeight: 600 }}>+{fmt(bankShown.filter(e => e.type === 'cash').reduce((t, e) => t + Number(e.amount), 0))}</span> · dépensé <span style={{ color: 'var(--red)', fontWeight: 600 }}>−{fmt(bankShown.filter(e => e.type === 'cb').reduce((t, e) => t + Number(e.amount), 0))}</span> MAD
        </div>
      )}
      <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '1rem' }}>
        Regroupe tous les mouvements payés/encaissés par CB, Virement, Chèque ou Prélèvement (hors espèces, suivies dans le Fond de caisse ou le Coffre fort).
      </p>
 
      <div className="stat-card" style={{ borderLeftColor: '#3730A3', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3730A3', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Solde net MAD</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3730A3' }}>{fmt(madStats.balance)} MAD</div>
        <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.3rem' }}>+{fmt(madStats.inflow)} / -{fmt(madStats.outflow)}</div>
      </div>
 
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.75rem', color: '#374151' }}>🏁 Solde bancaire initial</h3>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>Solde initial MAD (actuel : {fmt(targetMAD)})</label>
          <input className="form-input" type="number" step="0.01" value={soldeInitMAD} onChange={e => setSoldeInitMAD(e.target.value)} placeholder={`${targetMAD}`} />
        </div>
        {msg && <p style={{ color: 'var(--green)', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>{msg}</p>}
        <button onClick={saveSolde} disabled={savingSolde || soldeInitMAD === ''} className="btn-primary" style={{ marginTop: '0.75rem', opacity: soldeInitMAD === '' ? 0.5 : 1 }}>
          {savingSolde ? 'Enregistrement…' : 'Mettre à jour le solde initial'}
        </button>
      </div>
 
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.75rem', color: '#374151' }}>📊 Par mode de paiement</h3>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Mode</th><th>Encaissé</th><th>Dépensé</th></tr></thead>
            <tbody>
              {Object.entries(byMode).map(([mode, v]) => (
                <tr key={mode}>
                  <td>{mode}</td>
                  <td style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt(v.in)}</td>
                  <td style={{ color: 'var(--red)', fontWeight: 600 }}>{fmt(v.out)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
 
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#374151' }}>📋 Mouvements bancaires</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table-compact">
            <colgroup>
              <col style={{ width: '9%' }} /><col style={{ width: '8%' }} /><col style={{ width: '7%' }} />
              <col style={{ width: '9%' }} /><col style={{ width: '18%' }} />
              <col style={{ width: '8%' }} /><col style={{ width: '8%' }} /><col style={{ width: '9%' }} />
              <col style={{ width: '5%' }} /><col style={{ width: '9%' }} /><col style={{ width: '10%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Date</th><th>Employé</th><th>Mode</th><th>Catégorie</th><th className="col-wrap">Description</th>
                <th>Sortie</th><th>Entrée</th><th>Théorique</th><th>Pointé</th><th>Réel</th><th>Écart</th>
              </tr>
            </thead>
            <tbody>
              {[...bankShown].reverse().map(e => {
                const isIn = e.type === 'cash'
                const amt = Number(e.amount)
                return (
                  <tr key={`${e.type}-${e.id}`}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(e.date + 'T00:00:00').toLocaleDateString('fr-FR')}</td>
                    <td title={e.employee_name}>{e.employee_name}</td>
                    <td title={e.payment}>{e.payment}</td>
                    <td title={e.category}>{e.category}</td>
                    <td className="col-wrap" style={{ color: '#666' }}>{e.description || '—'}</td>
                    <td style={{ fontWeight: 600, color: 'var(--red)' }}>{!isIn ? fmt(amt) : '—'}</td>
                    <td style={{ fontWeight: 600, color: 'var(--green)' }}>{isIn ? fmt(amt) : '—'}</td>
                    <td style={{ fontWeight: 600, color: '#3730A3' }}>{fmt(e.theorique)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={!!e.pointed}
                        onChange={() => togglePointed(e)}
                        style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer', accentColor: 'var(--green)' }}
                        title={e.pointed ? 'Cliquer pour dépointer' : 'Cliquer pour pointer'}
                      />
                    </td>
                    <td style={{ fontWeight: 600, color: '#3730A3' }}>{fmt(e.reel)}</td>
                    <td style={{ fontWeight: 600, color: Math.abs(e.ecart) > 0.005 ? 'var(--red)' : '#aaa', overflow: 'visible' }} title={fmt(e.ecart)}>{fmt(e.ecart)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
 
// ─── Coffre Fort Tab ──────────────────────────────────────────────────────────
 
const COFFRE_CATEGORIES = ['Client', 'Commission', 'Administratif', 'Nourriture', 'Spa', 'Prestataire', 'Banque', 'Salaire', 'Maroc Telecom', 'Travaux', 'Impôts', 'Change', 'Caisse rouge', 'Entretien', 'Livraison mob', 'Alcool', 'Divers']
 
interface CoffreEntry {
  id: number
  employee_name: string
  direction: 'in' | 'out'
  date: string
  amount: number
  currency: string
  category: string
  description: string | null
  invoice_url: string | null
  status: string
  transfer_id?: string | null
  created_at: string
  // 'entry' = espèces saisies dans Dépenses/Encaissements avec « Coffre fort »
  source?: 'coffre' | 'entry'
}
 
function CoffreTab() {
  const now = new Date()
  const [allEntries, setAllEntries] = useState<CoffreEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteModal, setDeleteModal] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [coffreEmployees, setCoffreEmployees] = useState<string[]>([])
 
  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const [date, setDate] = useState(now.toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('MAD')
  const [category, setCategory] = useState(COFFRE_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [employeeName, setEmployeeName] = useState('Valérie')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
 
  // Facture (optionnelle) — glisser/déposer, photo ou fichier, avec auto-remplissage
  const [fFile, setFFile] = useState<File | null>(null)
  const [fFilePreview, setFFilePreview] = useState<string | null>(null)
  const [fExtracting, setFExtracting] = useState(false)
  const [fExtracted, setFExtracted] = useState(false)
  const [fDragCounter, setFDragCounter] = useState(0)
  const fFileRef = useRef<HTMLInputElement>(null)
  const fDropZoneRef = useRef<HTMLDivElement>(null)
  const processFileRef = useRef<(f: File) => void>((_f: File) => {})
  const [pendingUploadEntry, setPendingUploadEntry] = useState<number | null>(null)
  const [uploadingEntryId, setUploadingEntryId] = useState<number | null>(null)
  const rowFileRef = useRef<HTMLInputElement>(null)
 
  // On charge tout l'historique (pas seulement le mois affiché) : le Solde DHS/€
  // de chaque ligne est un cumul depuis le début, comme dans l'Excel — il faut
  // donc connaître les mouvements des mois précédents pour le calculer juste.
  const fetchEntries = useCallback(async () => {
    setLoading(true)
    const [r, rEnt] = await Promise.all([fetch('/api/coffre'), fetch('/api/entries')])
    const data = await r.json()
    const ents = await rEnt.json().catch(() => [])
    const coffreRows: CoffreEntry[] = (Array.isArray(data) ? data : []).map((e: CoffreEntry) => ({ ...e, source: 'coffre' as const }))
    // Espèces des Dépenses / Encaissements passées par le coffre fort
    const entryRows: CoffreEntry[] = (Array.isArray(ents) ? ents as Entry[] : [])
      .filter(e => e.payment === 'Espèces' && e.cash_location === 'coffre')
      .map(e => ({
        id: e.id,
        employee_name: e.employee_name,
        direction: e.type === 'cash' ? 'in' as const : 'out' as const,
        date: e.date,
        amount: Number(e.amount),
        currency: e.currency || 'MAD',
        category: e.category,
        description: [e.type === 'cash' ? 'Encaissement' : 'Dépense', e.supplier, e.description].filter(Boolean).join(' — '),
        invoice_url: (e.invoice_url as string) || null,
        status: e.status,
        created_at: e.created_at,
        source: 'entry' as const,
      }))
    setAllEntries([...coffreRows, ...entryRows])
    setLoading(false)
  }, [])
 
  useEffect(() => { fetchEntries() }, [fetchEntries])
  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then((emps: Employee[]) => {
      setCoffreEmployees(emps.filter(e => e.active).map(e => e.name))
    })
  }, [])
 
  // Cumul Solde DHS / Solde € — dans l'ordre chronologique, comme dans l'Excel
  const rowsWithSolde = useMemo(() => {
    const sorted = [...allEntries].sort((a, b) => a.date.localeCompare(b.date) || (a.created_at || '').localeCompare(b.created_at || '') || a.id - b.id)
    let soldeDhs = 0, soldeEur = 0
    return sorted.map(e => {
      const amt = Number(e.amount)
      const signed = e.direction === 'in' ? amt : -amt
      if ((e.currency || 'MAD') === 'EUR') soldeEur += signed
      else soldeDhs += signed
      return { ...e, soldeDhs, soldeEur }
    })
  }, [allEntries])
 
  // Soldes actuels (cumul depuis le début — c'est le vrai solde du coffre, pas remis à zéro chaque mois)
  const currentSoldeDhs = rowsWithSolde.length > 0 ? rowsWithSolde[rowsWithSolde.length - 1].soldeDhs : 0
  const currentSoldeEur = rowsWithSolde.length > 0 ? rowsWithSolde[rowsWithSolde.length - 1].soldeEur : 0
 
  // Dépôts / retraits — tout l'historique, par devise
  // Filtre de dates : n'affiche que les lignes de la période (les soldes restent cumulés)
  const [range, setRange] = useState<DateRange>(EMPTY_RANGE)
  const periodRows = rowsWithSolde.filter(e => inRange(e.date, range))
  const periodSum = (dir: 'in' | 'out', cur: string) => periodRows.filter(e => e.direction === dir && (e.currency || 'MAD') === cur).reduce((s, e) => s + Number(e.amount), 0)
  const totalInDhs  = rowsWithSolde.filter(e => e.direction === 'in'  && (e.currency || 'MAD') === 'MAD').reduce((s, e) => s + Number(e.amount), 0)
  const totalOutDhs = rowsWithSolde.filter(e => e.direction === 'out' && (e.currency || 'MAD') === 'MAD').reduce((s, e) => s + Number(e.amount), 0)
  const totalInEur  = rowsWithSolde.filter(e => e.direction === 'in'  && e.currency === 'EUR').reduce((s, e) => s + Number(e.amount), 0)
  const totalOutEur = rowsWithSolde.filter(e => e.direction === 'out' && e.currency === 'EUR').reduce((s, e) => s + Number(e.amount), 0)
 
  async function toggleStatus(entry: CoffreEntry) {
    await fetch(`/api/coffre/${entry.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: entry.status === 'pending' ? 'validated' : 'pending' }) })
    fetchEntries()
  }
 
  async function deleteEntry(id: number) {
    await fetch(`/api/coffre/${id}`, { method: 'DELETE' })
    setDeleteModal(null)
    fetchEntries()
  }
 
  async function processFile(file: File) {
    setFFile(file)
    setFExtracted(false)
    setFFilePreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null)
    setFExtracting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', 'coffre')
      const r = await fetch('/api/extract-invoice', { method: 'POST', body: fd })
      if (r.ok) {
        const data = await r.json()
        if (data.date) setDate(data.date)
        if (data.amount_ttc) setAmount(String(data.amount_ttc))
        setFExtracted(true)
      }
    } catch { /* silent */ }
    setFExtracting(false)
  }
 
  processFileRef.current = processFile
 
  useEffect(() => {
    const el = fDropZoneRef.current
    if (!el) return
    const onDragEnter = (e: DragEvent) => { e.preventDefault(); setFDragCounter(c => c + 1) }
    const onDragOver = (e: DragEvent) => { e.preventDefault() }
    const onDragLeave = (e: DragEvent) => { e.preventDefault(); setFDragCounter(c => Math.max(0, c - 1)) }
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setFDragCounter(0)
      const f = e.dataTransfer?.files[0]
      if (f) processFileRef.current(f)
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
  }, [showForm])
 
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    processFile(file)
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
 
  async function handleRowUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || pendingUploadEntry === null) return
    setUploadingEntryId(pendingUploadEntry)
    try {
      const url = await fileToBase64(file)
      await fetch(`/api/coffre/${pendingUploadEntry}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoice_url: url }) })
      fetchEntries()
    } catch { /* ignore */ }
    setUploadingEntryId(null)
    setPendingUploadEntry(null)
    if (rowFileRef.current) rowFileRef.current.value = ''
  }
 
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true); setFormError('')
    let invoice_url: string | undefined
    if (fFile) {
      try {
        invoice_url = await fileToBase64(fFile)
      } catch (err) { setFormError((err as Error).message); setSubmitting(false); return }
    }
    const r = await fetch('/api/coffre', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction, date, amount: parseFloat(amount), currency, category, description, employee_name: employeeName, invoice_url }),
    })
    if (r.ok) {
      setAmount(''); setDescription(''); setShowForm(false)
      setFFile(null); setFFilePreview(null); setFExtracted(false)
      fetchEntries()
    } else {
      const d = await r.json()
      setFormError(d.error || 'Erreur')
    }
    setSubmitting(false)
  }
 
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#374151' }}>🔐 Coffre fort</h2>
        <DateRangeFilter value={range} onChange={setRange} color="#B8860B" />
        <button className="btn-primary" onClick={() => setShowForm(!showForm)} style={{ background: '#374151' }}>{showForm ? 'Annuler' : '+ Ajouter'}</button>
      </div>
 
      {/* Solde — cumul depuis le début (pas remis à zéro chaque mois) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div className="stat-card" style={{ borderLeftColor: '#B8860B' }}>
          <div style={{ fontSize: '0.8rem', color: '#888' }}>Solde DHS</div>
          <div style={{ fontWeight: 700, fontSize: '1.5rem', color: '#B8860B' }}>{fmt(currentSoldeDhs)}</div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: '#B8860B' }}>
          <div style={{ fontSize: '0.8rem', color: '#888' }}>Solde €</div>
          <div style={{ fontWeight: 700, fontSize: '1.5rem', color: '#B8860B' }}>{fmt(currentSoldeEur)}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div className="stat-card" style={{ borderLeftColor: 'var(--green)' }}>
          <div style={{ fontSize: '0.8rem', color: '#888' }}>Dépôts DHS</div>
          <div style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--green)' }}>+{totalInDhs.toFixed(2)}</div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--red)' }}>
          <div style={{ fontSize: '0.8rem', color: '#888' }}>Retraits DHS</div>
          <div style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--red)' }}>-{totalOutDhs.toFixed(2)}</div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--green)' }}>
          <div style={{ fontSize: '0.8rem', color: '#888' }}>Dépôts €</div>
          <div style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--green)' }}>+{totalInEur.toFixed(2)}</div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--red)' }}>
          <div style={{ fontSize: '0.8rem', color: '#888' }}>Retraits €</div>
          <div style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--red)' }}>-{totalOutEur.toFixed(2)}</div>
        </div>
      </div>
 
      {showForm && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <form onSubmit={handleSubmit}>
            {/* Upload zone justificatif — optionnel */}
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                Facture <span style={{ color: '#888', fontWeight: 400 }}>(optionnel)</span>
              </label>
              <div
                ref={fDropZoneRef}
                style={{ position: 'relative', border: `2px dashed ${fDragCounter > 0 ? '#374151' : fFile ? 'var(--green)' : '#ddd'}`, borderRadius: '0.5rem', padding: '1.25rem', textAlign: 'center', background: fDragCounter > 0 ? '#F3F4F6' : fExtracting ? '#FFFBF0' : fFile ? '#F0FDF4' : '#FAFAFA', transition: 'all 0.15s' }}
              >
                {fFile && !fExtracting && (
                  <button type="button" onClick={e => { e.stopPropagation(); setFFile(null); setFFilePreview(null); if (fFileRef.current) fFileRef.current.value = '' }}
                    style={{ position: 'absolute', top: '0.35rem', left: '0.35rem', background: 'rgba(239,68,68,0.9)', border: 'none', borderRadius: '50%', width: '1.3rem', height: '1.3rem', color: 'white', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, lineHeight: 1, padding: 0 }}>×</button>
                )}
                {fExtracting ? (
                  <div>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>⏳</div>
                    <div style={{ fontSize: '0.85rem', color: '#888' }}>Analyse du document en cours…</div>
                  </div>
                ) : fFile ? (
                  <div onClick={() => fFileRef.current?.click()} style={{ cursor: 'pointer' }}>
                    {fFilePreview && <img src={fFilePreview} alt="Aperçu" style={{ maxHeight: 120, maxWidth: '100%', marginBottom: '0.5rem', borderRadius: '0.3rem', objectFit: 'contain' }} />}
                    <div style={{ fontSize: '0.85rem', color: 'var(--green)', fontWeight: 600 }}>✓ {fFile.name}</div>
                    {fExtracted && <div style={{ fontSize: '0.75rem', color: 'var(--green)', marginTop: '0.2rem' }}>Données extraites automatiquement — vérifiez ci-dessous</div>}
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.2rem' }}>Cliquer ou glisser pour changer</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{fDragCounter > 0 ? '⬇️' : '📄'}</div>
                    <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.75rem' }}>Glisser la facture ici</div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <label style={{ padding: '0.5rem 0.875rem', background: '#F3F4F6', border: '1px solid #374151', borderRadius: '0.5rem', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                        📷 Photo
                        <input type="file" accept="image/*" capture="environment" onChange={handleFileSelect} style={{ display: 'none' }} />
                      </label>
                      <label style={{ padding: '0.5rem 0.875rem', background: '#F8F8F8', border: '1px solid #ddd', borderRadius: '0.5rem', color: '#555', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                        📁 Fichier
                        <input type="file" accept="image/*,application/pdf" onChange={handleFileSelect} style={{ display: 'none' }} />
                      </label>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: '0.5rem' }}>Image ou PDF — les champs date/montant seront remplis automatiquement</div>
                  </div>
                )}
              </div>
              <input ref={fFileRef} type="file" accept="image/*,application/pdf" onChange={handleFileSelect} style={{ display: 'none' }} />
            </div>
 
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Sens *</label>
                <select className="form-input" value={direction} onChange={e => setDirection(e.target.value as 'in' | 'out')}>
                  <option value="in">🔒 Dépôt (entrée)</option>
                  <option value="out">🔓 Retrait (sortie)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Date *</label>
                <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Montant *</label>
                <input className="form-input" type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Devise</label>
                <select className="form-input" value={currency} onChange={e => setCurrency(e.target.value)}>
                  <option value="MAD">MAD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Catégorie *</label>
                <select className="form-input" value={category} onChange={e => setCategory(e.target.value)}>
                  {COFFRE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Par</label>
                <select className="form-input" value={employeeName} onChange={e => setEmployeeName(e.target.value)}>
                  {Array.from(new Set(['Valérie', ...coffreEmployees])).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Description</label>
                <input className="form-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Note optionnelle" />
              </div>
            </div>
            {formError && <p style={{ color: 'var(--red)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>{formError}</p>}
            <button className="btn-primary" type="submit" disabled={submitting} style={{ background: '#374151' }}>{submitting ? 'Enregistrement…' : 'Enregistrer'}</button>
          </form>
        </div>
      )}
 
      {rangeActive(range) && (
        <div className="card" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
          <span>
            <b>{periodRows.length} mouvement{periodRows.length > 1 ? 's' : ''} {rangeLabel(range)}</b> · DHS : <span style={{ color: 'var(--green)', fontWeight: 600 }}>+{fmt(periodSum('in', 'MAD'))}</span> / <span style={{ color: 'var(--red)', fontWeight: 600 }}>−{fmt(periodSum('out', 'MAD'))}</span>
            {' '}· € : <span style={{ color: 'var(--green)', fontWeight: 600 }}>+{fmt(periodSum('in', 'EUR'))}</span> / <span style={{ color: 'var(--red)', fontWeight: 600 }}>−{fmt(periodSum('out', 'EUR'))}</span>
          </span>
        </div>
      )}

      {loading ? <p>Chargement…</p> : periodRows.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: '#aaa', padding: '2rem' }}>{rowsWithSolde.length === 0 ? 'Aucun mouvement' : 'Aucun mouvement sur cette période'}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table-compact">
            <colgroup>
              <col style={{ width: '6%' }} /><col style={{ width: '8%' }} /><col style={{ width: '8%' }} />
              <col style={{ width: '18%' }} /><col style={{ width: '7%' }} /><col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} /><col style={{ width: '5%' }} /><col style={{ width: '6%' }} />
              <col style={{ width: '6%' }} /><col style={{ width: '6%' }} /><col style={{ width: '7%' }} />
              <col style={{ width: '9%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Date</th><th>Employé</th><th>Catégorie</th><th className="col-wrap">Libellé</th>
                <th>Sortie DHS</th><th>Entrée DHS</th><th>Solde DHS</th><th>AF/SF</th>
                <th>Sortie €</th><th>Entrée €</th><th>Solde €</th>
                <th>Statut</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...periodRows].reverse().map(e => {
                const isEur = e.currency === 'EUR'
                const amt = Number(e.amount)
                const hasInvoice = !!e.invoice_url
                return (
                  <tr key={`${e.source}-${e.id}`}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(e.date + 'T00:00:00').toLocaleDateString('fr-FR')}</td>
                    <td title={e.employee_name}>{e.employee_name}</td>
                    <td title={e.category}>{e.category}</td>
                    <td className="col-wrap" style={{ color: '#666' }}>{e.description || '—'}</td>
                    <td style={{ fontWeight: 600, color: 'var(--red)' }}>{!isEur && e.direction === 'out' ? amt.toFixed(2) : '—'}</td>
                    <td style={{ fontWeight: 600, color: 'var(--green)' }}>{!isEur && e.direction === 'in' ? amt.toFixed(2) : '—'}</td>
                    <td style={{ fontWeight: 600, color: '#B8860B' }}>{!isEur ? fmt(e.soldeDhs) : '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      {hasInvoice
                        ? <a href={e.invoice_url!} onClick={ev => { ev.preventDefault(); openAttachment(e.invoice_url) }} style={{ color: 'var(--green)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>AF</a>
                        : e.source === 'entry' ? <span style={{ color: '#9CA3AF', fontWeight: 700, fontSize: '0.8rem' }}>SF</span>
                        : <button onClick={() => { setPendingUploadEntry(e.id); rowFileRef.current?.click() }} disabled={uploadingEntryId === e.id} style={{ background: 'none', border: 'none', color: '#9CA3AF', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>{uploadingEntryId === e.id ? '⬆️…' : 'SF 📎'}</button>
                      }
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--red)' }}>{isEur && e.direction === 'out' ? amt.toFixed(2) : '—'}</td>
                    <td style={{ fontWeight: 600, color: 'var(--green)' }}>{isEur && e.direction === 'in' ? amt.toFixed(2) : '—'}</td>
                    <td style={{ fontWeight: 600, color: '#B8860B' }}>{isEur ? fmt(e.soldeEur) : '—'}</td>
                    <td><span className={e.status === 'validated' ? 'badge-validated' : 'badge-pending'}>{e.status === 'validated' ? 'Validé' : 'En attente'}</span></td>
                    {e.source === 'entry' ? (
                      <td style={{ fontSize: '0.72rem', color: '#888' }}>via {e.direction === 'in' ? 'Encaissements' : 'Dépenses'}</td>
                    ) : (
                      <td style={{ display: 'flex', gap: '0.4rem' }}>
                        <button onClick={() => toggleStatus(e)} style={{ background: e.status === 'pending' ? 'var(--green)' : '#888', color: 'white', border: 'none', borderRadius: '0.4rem', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem' }}>{e.status === 'pending' ? '✓' : '↩'}</button>
                        <button onClick={() => setDeleteModal(e.id)} title={e.transfer_id ? 'Supprime le transfert des deux côtés' : undefined} style={{ background: 'var(--red)', color: 'white', border: 'none', borderRadius: '0.4rem', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem' }}>🗑</button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
 
      <input ref={rowFileRef} type="file" accept="image/*,application/pdf" onChange={handleRowUpload} style={{ display: 'none' }} />
 
      {deleteModal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ maxWidth: 340, width: '90%', textAlign: 'center' }}>
            <p style={{ marginBottom: '1rem', fontWeight: 600 }}>Supprimer ce mouvement ?</p>
            {allEntries.find(x => x.source === 'coffre' && x.id === deleteModal)?.transfer_id && (
              <p style={{ marginTop: '-0.5rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#888' }}>C&apos;est un transfert : il sera aussi retiré du fond de caisse.</p>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => setDeleteModal(null)}>Annuler</button>
              <button className="btn-red" onClick={() => deleteEntry(deleteModal)}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
 
// ─── Comptable Tab ─────────────────────────────────────────────────────────────
// Factures cochées « à envoyer au comptable », séparées en factures d'achat (dépenses)
// et factures de vente (encaissements), plus le relevé trimestriel de la taxe de séjour.

type ComptableSection = 'achats' | 'ventes' | 'taxes' | 'releves'

function ComptableTab() {
  const [section, setSection] = useState<ComptableSection>('achats')
  const sections: { id: ComptableSection; label: string }[] = [
    { id: 'achats', label: '📥 Factures d’achat' },
    { id: 'ventes', label: '📤 Factures de vente' },
    { id: 'taxes', label: '🏨 Taxe de séjour et TPT' },
    { id: 'releves', label: '🏦 Relevés bancaires' },
  ]
  return (
    <div>
      {/* Quatre rubriques sur deux lignes (deux par ligne) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.5rem', marginBottom: '1rem', maxWidth: 560 }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{ padding: '0.45rem 0.6rem', borderRadius: '0.75rem', textAlign: 'center', lineHeight: 1.25, border: `1px solid ${section === s.id ? '#0F766E' : '#ddd'}`, background: section === s.id ? '#0F766E' : 'white', color: section === s.id ? 'white' : 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>{s.label}</button>
        ))}
      </div>
      {section === 'achats' && <ComptableInvoices type="cb" />}
      {section === 'ventes' && <><TvaRatesCard /><ComptableInvoices type="cash" /></>}
      {section === 'taxes' && <TaxeSejourPanel />}
      {section === 'releves' && <StatementsMonthPanel />}
    </div>
  )
}

function ComptableInvoices({ type }: { type: 'cb' | 'cash' }) {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [allEntries, setAllEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(currentMonth)
  const [allMonths, setAllMonths] = useState(false)
  const { byEntry: invoiceByEntry, taxRate, childRate, tvaRates, reload: reloadInvoices } = useInvoices()
  // Création / modification d'une facture de vente directement depuis l'onglet Comptable
  const [invoiceFor, setInvoiceFor] = useState<Entry | null>(null)
 
  const reload = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/entries', { cache: 'no-store' })
    const d = await r.json().catch(() => [])
    setAllEntries(Array.isArray(d) ? d : [])
    setLoading(false)
  }, [])
 
  useEffect(() => { reload() }, [reload])
 
  // Période libre (du … au …) : prioritaire sur le mois choisi
  const [range, setRange] = useState<DateRange>(EMPTY_RANGE)
  const useRange = rangeActive(range)
  const rows = useMemo(() => allEntries
    .filter(e => !!e.to_accountant)
    .filter(e => useRange ? inRange(e.date, range) : (allMonths || e.date.substring(0, 7) === month))
    .filter(e => e.type === type)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id), [allEntries, allMonths, month, type, useRange, range])
 
  const totals = useMemo(() => {
    const t: Record<string, { dep: number; enc: number }> = {}
    for (const e of rows) {
      const cur = (e.currency as string) || 'MAD'
      if (!t[cur]) t[cur] = { dep: 0, enc: 0 }
      if (e.type === 'cb') t[cur].dep += Number(e.amount)
      else t[cur].enc += Number(e.amount)
    }
    return t
  }, [rows])
 
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const kindLabel = type === 'cb' ? 'Factures d’achat' : 'Factures de vente'
  const periodTitle = useRange ? rangeLabel(range) : allMonths ? 'Tous les mois' : formatMonth(month)
  const exportTitle = `${kindLabel} - ${periodTitle}`
 
  async function exportPdf() {
    if (rows.length === 0) return
    setExporting(true); setExportError('')
    try {
      const { buildAccountantPdf } = await import('@/lib/pdf-export')
      const blob = await buildAccountantPdf(rows, exportTitle, type === 'cash' ? invoiceByEntry : {})
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Comptable - ${exportTitle}.pdf`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      console.error(err)
      setExportError("Erreur lors de la création du PDF — réessayez.")
    }
    setExporting(false)
  }
 
  // Ajout / remplacement d'un justificatif directement depuis l'onglet Comptable
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadFor, setUploadFor] = useState<number | null>(null)
  const [uploadingId, setUploadingId] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState('')

  function pickFile(id: number) {
    setUploadFor(id); setUploadError('')
    fileRef.current?.click()
  }

  async function handleFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0]
    const id = uploadFor
    if (fileRef.current) fileRef.current.value = ''
    if (!file || id === null) return
    setUploadingId(id)
    try {
      const url = await fileToDataUrl(file)
      const r = await fetch(`/api/entries/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoice_url: url }) })
      if (!r.ok) throw new Error(String(r.status))
      setAllEntries(prev => prev.map(e => e.id === id ? { ...e, invoice_url: url } : e))
    } catch (err) {
      console.error(err)
      setUploadError("La facture n'a pas pu être ajoutée — réessayez (fichier trop lourd ?).")
    }
    setUploadingId(null); setUploadFor(null)
  }

  const missingCount = rows.filter(e => !e.invoice_url && !invoiceByEntry[e.id]).length
  // Ventes sans facture (ex : encaissements saisis par un employé) : facture à compléter ici
  const toComplete = type === 'cash' ? rows.filter(e => !invoiceByEntry[e.id]) : []
  const [onlyToComplete, setOnlyToComplete] = useState(false)
  const shownRows = onlyToComplete ? toComplete : rows

  async function removeFromList(entry: Entry) {
    setAllEntries(prev => prev.map(e => e.id === entry.id ? { ...e, to_accountant: false } : e))
    const r = await fetch(`/api/entries/${entry.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to_accountant: false }) }).catch(() => null)
    if (!r || !r.ok) setAllEntries(prev => prev.map(e => e.id === entry.id ? { ...e, to_accountant: entry.to_accountant } : e))
  }
 
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F766E' }}>{type === 'cb' ? '📥 Factures d’achat (dépenses)' : '📤 Factures de vente (encaissements)'}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={() => { setAllMonths(false); setMonth(shiftMonth(month, -1)) }} disabled={allMonths} style={{ border: '1px solid #ddd', background: 'white', borderRadius: '0.4rem', padding: '0.3rem 0.65rem', cursor: allMonths ? 'default' : 'pointer', opacity: allMonths ? 0.4 : 1, fontWeight: 600 }}>‹</button>
          <span style={{ fontWeight: 700, minWidth: 140, textAlign: 'center', color: allMonths ? '#aaa' : 'var(--text)' }}>{formatMonth(month)}</span>
          <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={allMonths || month === currentMonth} style={{ border: '1px solid #ddd', background: 'white', borderRadius: '0.4rem', padding: '0.3rem 0.65rem', cursor: (allMonths || month === currentMonth) ? 'default' : 'pointer', opacity: (allMonths || month === currentMonth) ? 0.4 : 1, fontWeight: 600 }}>›</button>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', marginLeft: '0.5rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={allMonths} onChange={e => setAllMonths(e.target.checked)} style={{ accentColor: '#0F766E' }} />
            Tous les mois
          </label>
          <DateRangeFilter value={range} onChange={setRange} color="#0F766E" />
        </div>
      </div>
 
      {type === 'cash' && toComplete.length > 0 && (
        <div style={{ marginBottom: '0.75rem', padding: '0.55rem 0.8rem', background: '#FAF6F2', border: '1px solid #EADBCB', borderRadius: '0.4rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          🧾 <strong>{toComplete.length} facture{toComplete.length > 1 ? 's' : ''} à compléter</strong>
          <span style={{ color: '#666' }}>— encaissements saisis sans facture (par exemple par un employé) : cliquez sur « Compléter » pour indiquer le client, les adultes, enfants et nuits.</span>
          <button type="button" onClick={() => setOnlyToComplete(v => !v)} style={{ marginLeft: 'auto', background: onlyToComplete ? 'white' : '#8B4513', color: onlyToComplete ? '#8B4513' : 'white', border: '1px solid #8B4513', borderRadius: '0.4rem', padding: '0.3rem 0.7rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
            {onlyToComplete ? 'Tout afficher' : 'Afficher seulement celles-ci'}
          </button>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.85rem', color: '#666' }}>
          {rows.length} facture{rows.length > 1 ? 's' : ''}
          {missingCount > 0 && <span style={{ color: 'var(--red)', fontWeight: 600 }}> · {missingCount} justificatif{missingCount > 1 ? 's' : ''} manquant{missingCount > 1 ? 's' : ''}</span>}
        </span>
        <button className="btn-primary" onClick={exportPdf} disabled={exporting || rows.length === 0} style={{ background: '#0F766E', fontSize: '0.85rem', padding: '0.4rem 0.9rem', opacity: rows.length === 0 ? 0.5 : 1 }}>
          {exporting ? 'Création du PDF…' : `📄 Exporter le PDF — ${periodTitle}`}
        </button>
        {exportError && <span style={{ color: 'var(--red)', fontSize: '0.8rem' }}>{exportError}</span>}
        {uploadError && <span style={{ color: 'var(--red)', fontSize: '0.8rem' }}>{uploadError}</span>}
        <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleFile} style={{ display: 'none' }} />
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
          {Object.entries(totals).map(([cur, t]) => (
            <span key={cur}>
              {t.dep > 0 && <span style={{ color: 'var(--terracotta)', fontWeight: 600 }}>Dépenses {fmt(t.dep)} {cur}</span>}
              {t.dep > 0 && t.enc > 0 && ' · '}
              {t.enc > 0 && <span style={{ color: 'var(--green)', fontWeight: 600 }}>Encaissements {fmt(t.enc)} {cur}</span>}
            </span>
          ))}
        </span>
      </div>
 
      {loading ? <p>Chargement…</p> : rows.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: '#aaa', padding: '2rem' }}>
          Aucune facture à envoyer {useRange ? rangeLabel(range) : allMonths ? '' : 'pour ce mois'}.<br />
          <span style={{ fontSize: '0.8rem' }}>{type === 'cb'
            ? <>Cochez « Facture à envoyer au comptable » dans Dépenses pour qu&apos;elle apparaisse ici.</>
            : <>Créez la facture client depuis Encaissements (colonne « Facture »), ou cochez « Compta. », pour qu&apos;elle apparaisse ici.</>}</span>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="table-dep">
            <thead>
              <tr>
                <th>Date</th>{type === 'cash' && <th>Facture</th>}<th>Employé</th><th>Catégorie</th><th>{type === 'cb' ? 'Fournisseur' : 'Client'}</th>
                <th>Paiement</th><th>N° fact./chèque</th><th>Description</th>
                <th>Devise</th><th>Montant</th><th>Justificatif</th><th title="Retirer de la liste du comptable">Retirer</th>
              </tr>
            </thead>
            <tbody>
              {shownRows.map(e => {
                const color = e.type === 'cb' ? 'var(--terracotta)' : 'var(--green)'
                return (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(e.date + 'T00:00:00').toLocaleDateString('fr-FR')}</td>
                    {type === 'cash' && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {invoiceByEntry[e.id] ? (
                          <>
                            <button onClick={() => downloadInvoice(invoiceByEntry[e.id])} title="Télécharger la facture" style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: '0.8rem', padding: 0, fontWeight: 600 }}>📄 {invoiceByEntry[e.id].number}</button>
                            <button onClick={() => setInvoiceFor(e)} title="Modifier la facture" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#999', marginLeft: '0.3rem', padding: 0 }}>✎</button>
                          </>
                        ) : (
                          <button onClick={() => setInvoiceFor(e)} disabled={taxRate === null} title="Compléter la facture client (client, adultes, enfants, nuits)" style={{ background: '#8B4513', border: 'none', color: 'white', borderRadius: '0.3rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.55rem' }}>🧾 Compléter</button>
                        )}
                      </td>
                    )}
                    <td>{e.employee_name}</td>
                    <td>{e.category}</td>
                    <td className="col-wrap">{e.supplier || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{e.payment || '—'}</td>
                    <td style={{ fontSize: '0.8rem', color: '#666', whiteSpace: 'nowrap' }}>{e.reference || '—'}</td>
                    <td className="col-wrap" style={{ fontSize: '0.8rem', color: '#666' }}>{e.description || '—'}</td>
                    <td><span style={{ fontWeight: 600, fontSize: '0.8rem', background: '#F3F4F6', padding: '0.15rem 0.4rem', borderRadius: '0.3rem' }}>{(e.currency as string) || 'MAD'}</span></td>
                    <td style={{ fontWeight: 600, color, whiteSpace: 'nowrap' }}>{fmt(Number(e.amount))}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {uploadingId === e.id ? (
                        <span style={{ fontSize: '0.75rem', color: '#666' }}>Envoi…</span>
                      ) : e.invoice_url ? (
                        <>
                          <a href={e.invoice_url as string} onClick={ev => { ev.preventDefault(); openAttachment(e.invoice_url as string) }} style={{ color: 'var(--blue)', fontSize: '0.8rem', cursor: 'pointer' }}>📄 Voir</a>
                          <button onClick={() => pickFile(e.id)} title="Remplacer le justificatif" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#999', marginLeft: '0.35rem', padding: 0 }}>↻</button>
                        </>
                      ) : (
                        <button onClick={() => pickFile(e.id)} title="Ajouter la facture (photo ou PDF)" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: 'var(--red)', borderRadius: '0.3rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.5rem' }}>+ Ajouter</button>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => removeFromList(e)} title="Retirer de la liste du comptable" style={{ background: 'none', border: '1px solid #ddd', borderRadius: '0.3rem', cursor: 'pointer', fontSize: '0.75rem', padding: '0.2rem 0.45rem', color: '#666' }}>✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {invoiceFor && taxRate !== null && (
        <InvoiceModal entry={invoiceFor} invoice={invoiceByEntry[invoiceFor.id] ?? null} taxRate={taxRate} childRate={childRate} rates={tvaRates}
          onClose={() => setInvoiceFor(null)}
          onSaved={() => { setInvoiceFor(null); reloadInvoices(); reload() }} />
      )}
    </div>
  )
}
 
// ─── Employees Tab ─────────────────────────────────────────────────────────────
 
function EmployeesTab() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [poste, setPoste] = useState('')
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)
 
  const fetchEmployees = useCallback(async () => {
    const r = await fetch('/api/employees')
    setEmployees(await r.json())
    setLoading(false)
  }, [])
 
  useEffect(() => { fetchEmployees() }, [fetchEmployees])
 
  async function addEmployee(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setAdding(true)
    await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), poste: poste.trim() || 'Employé' }) })
    setName(''); setPoste(''); setShowForm(false); setAdding(false)
    fetchEmployees()
  }
 
  async function toggleActive(emp: Employee) {
    await fetch(`/api/employees/${emp.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !emp.active }) })
    fetchEmployees()
  }
 
  async function toggleManager(emp: Employee) {
    await fetch(`/api/employees/${emp.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_manager: !emp.is_manager }) })
    fetchEmployees()
  }
 
  function copyLink(emp: Employee) {
    navigator.clipboard.writeText(`${window.location.origin}/employee?emp=${emp.token}`)
    setCopiedId(emp.id)
    setTimeout(() => setCopiedId(null), 2000)
  }
 
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--terracotta)' }}>👥 Employés</h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{showForm ? 'Annuler' : '+ Ajouter'}</button>
      </div>
 
      {showForm && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <form onSubmit={addEmployee} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Nom *</label>
              <input className="form-input" style={{ width: 180 }} value={name} onChange={e => setName(e.target.value)} placeholder="Prénom Nom" required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Poste</label>
              <input className="form-input" style={{ width: 180 }} value={poste} onChange={e => setPoste(e.target.value)} placeholder="Employé" />
            </div>
            <button className="btn-primary" type="submit" disabled={adding}>{adding ? 'Ajout…' : 'Ajouter'}</button>
          </form>
        </div>
      )}
 
      {loading ? <p>Chargement…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {employees.map(emp => (
            <div key={emp.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', opacity: emp.active ? 1 : 0.55 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{emp.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>{emp.poste}{emp.is_manager && <span style={{ marginLeft: '0.4rem', color: 'var(--terracotta)', fontWeight: 600 }}>· accès manager</span>}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {emp.active && <button onClick={() => copyLink(emp)} style={{ background: '#EEF2FF', color: 'var(--blue)', border: 'none', borderRadius: '0.4rem', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>{copiedId === emp.id ? '✓ Copié' : '🔗 Copier lien'}</button>}
                {emp.active && <button onClick={() => toggleManager(emp)} title="Son lien personnel ouvre l'interface manager" style={{ background: emp.is_manager ? '#FFF5F0' : '#F3F4F6', color: emp.is_manager ? 'var(--terracotta)' : '#555', border: `1px solid ${emp.is_manager ? 'var(--terracotta)' : '#ddd'}`, borderRadius: '0.4rem', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>{emp.is_manager ? '✓ Accès manager' : 'Donner accès manager'}</button>}
                <button onClick={() => toggleActive(emp)} style={{ background: emp.active ? '#FEE2E2' : '#D1FAE5', color: emp.active ? 'var(--red)' : 'var(--green)', border: 'none', borderRadius: '0.4rem', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>{emp.active ? 'Désactiver' : 'Réactiver'}</button>
              </div>
            </div>
          ))}
          {employees.length === 0 && <div className="card" style={{ textAlign: 'center', color: '#aaa', padding: '2rem' }}>Aucun employé</div>}
        </div>
      )}
    </div>
  )
}
 
// ─── Settings Tab ──────────────────────────────────────────────────────────────
 
function SettingsTab({ onLogout }: { onLogout: () => void }) {
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinMsg, setPinMsg] = useState('')
  const [pinError, setPinError] = useState('')
  const [resetModal, setResetModal] = useState(false)
  const [resetEntriesModal, setResetEntriesModal] = useState(false)
  const [resetEntriesLoading, setResetEntriesLoading] = useState(false)
  const [importBanqueModal, setImportBanqueModal] = useState(false)
  const [importBanqueLoading, setImportBanqueLoading] = useState(false)
  const [importBanqueMsg, setImportBanqueMsg] = useState('')
  const [importBanqueError, setImportBanqueError] = useState('')
  const [importCoffreModal, setImportCoffreModal] = useState(false)
  const [importCoffreLoading, setImportCoffreLoading] = useState(false)
  const [importCoffreMsg, setImportCoffreMsg] = useState('')
  const [importCoffreError, setImportCoffreError] = useState('')
  const [importCoffreEurModal, setImportCoffreEurModal] = useState(false)
  const [importCoffreEurLoading, setImportCoffreEurLoading] = useState(false)
  const [importCoffreEurMsg, setImportCoffreEurMsg] = useState('')
  const [importCoffreEurError, setImportCoffreEurError] = useState('')
  const [fixCoffreLoading, setFixCoffreLoading] = useState(false)
  const [fixCoffreMsg, setFixCoffreMsg] = useState('')
  const [fixCoffreError, setFixCoffreError] = useState('')
  const [moveAllModal, setMoveAllModal] = useState(false)
  const [moveAllLoading, setMoveAllLoading] = useState(false)
  const [moveAllMsg, setMoveAllMsg] = useState('')
  const [moveAllError, setMoveAllError] = useState('')
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [excelUploading, setExcelUploading] = useState(false)
  const [excelMsg, setExcelMsg] = useState('')
  const [excelError, setExcelError] = useState('')
  const [hasBaseFile, setHasBaseFile] = useState<boolean | null>(null)
  const [dbUpdating, setDbUpdating] = useState(false)
  const [dbMsg, setDbMsg] = useState('')
 
  useEffect(() => {
    fetch('/api/excel/status').then(r => r.ok ? r.json() : null).then(d => { if (d) setHasBaseFile(d.hasFile) })
  }, [])
 
  async function uploadExcel(e: React.FormEvent) {
    e.preventDefault()
    if (!excelFile) return
    setExcelUploading(true); setExcelMsg(''); setExcelError('')
    const form = new FormData()
    form.append('file', excelFile)
    const r = await fetch('/api/excel/upload', { method: 'POST', body: form })
    if (r.ok) { setExcelMsg('Fichier Excel enregistré ! L\'export Excel intégrera maintenant vos onglets existants.'); setHasBaseFile(true); setExcelFile(null) }
    else { const d = await r.json(); setExcelError(d.error || 'Erreur upload.') }
    setExcelUploading(false)
  }
 
  async function removeExcel() {
    await fetch('/api/excel/upload', { method: 'DELETE' })
    setHasBaseFile(false); setExcelMsg('Fichier supprimé.')
  }
 
  async function changePin(e: React.FormEvent) {
    e.preventDefault()
    setPinMsg(''); setPinError('')
    if (newPin !== confirmPin) { setPinError('Les PINs ne correspondent pas.'); return }
    if (newPin.length < 4) { setPinError('Le PIN doit faire au moins 4 caractères.'); return }
    const r = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPin, newPin }) })
    if (r.ok) { setPinMsg('PIN modifié.'); setCurrentPin(''); setNewPin(''); setConfirmPin('') }
    else { const d = await r.json(); setPinError(d.error || 'Erreur.') }
  }
 
  async function resetAll() {
    await fetch('/api/settings/reset', { method: 'DELETE' })
    setResetModal(false)
    onLogout()
  }
 
  async function resetEntries() {
    setResetEntriesLoading(true)
    await fetch('/api/settings/reset-entries', { method: 'DELETE' })
    setResetEntriesLoading(false)
    setResetEntriesModal(false)
    window.location.reload()
  }
 
  async function importBanque2026() {
    setImportBanqueLoading(true); setImportBanqueMsg(''); setImportBanqueError('')
    const r = await fetch('/api/settings/import-banque-2026', { method: 'POST' })
    if (r.ok) {
      const d = await r.json()
      setImportBanqueMsg(`✓ ${d.inserted} lignes importées, solde initial fixé à ${d.soldeInitial.toLocaleString('fr-FR')} MAD.`)
      setImportBanqueModal(false)
    } else {
      const d = await r.json().catch(() => ({}))
      setImportBanqueError(d.error || 'Erreur lors de l\'import.')
    }
    setImportBanqueLoading(false)
  }
 
  async function importCoffre2026() {
    setImportCoffreLoading(true); setImportCoffreMsg(''); setImportCoffreError('')
    const r = await fetch('/api/settings/import-coffre-2026', { method: 'POST' })
    if (r.ok) {
      const d = await r.json()
      setImportCoffreMsg(`✓ ${d.inserted} lignes importées dans le Coffre-fort.`)
      setImportCoffreModal(false)
    } else {
      const d = await r.json().catch(() => ({}))
      setImportCoffreError(d.error || 'Erreur lors de l\'import.')
    }
    setImportCoffreLoading(false)
  }
 
  async function importCoffreEur2026() {
    setImportCoffreEurLoading(true); setImportCoffreEurMsg(''); setImportCoffreEurError('')
    const r = await fetch('/api/settings/import-coffre-eur-2026', { method: 'POST' })
    if (r.ok) {
      const d = await r.json()
      setImportCoffreEurMsg(`✓ ${d.inserted} lignes en euros importées dans le Coffre-fort.`)
      setImportCoffreEurModal(false)
    } else {
      const d = await r.json().catch(() => ({}))
      setImportCoffreEurError(d.error || 'Erreur lors de l\'import.')
    }
    setImportCoffreEurLoading(false)
  }
 
  async function fixCoffreLocation() {
    setFixCoffreLoading(true); setFixCoffreMsg(''); setFixCoffreError('')
    const r = await fetch('/api/settings/fix-coffre-location', { method: 'POST' })
    if (r.ok) {
      const d = await r.json()
      setFixCoffreMsg(`✓ Vérifié ${d.total} lignes — ${d.alreadyInCoffre} déjà correctement en Coffre, ${d.foundInFonds} trouvées en Fond de caisse et déplacées vers le Coffre (${d.deletedFromFonds} supprimées de Fond de caisse, ${d.inserted} ajoutées au Coffre).`)
    } else {
      const d = await r.json().catch(() => ({}))
      setFixCoffreError(d.error || 'Erreur lors de la correction.')
    }
    setFixCoffreLoading(false)
  }
 
  async function moveAllFondsToCoffre() {
    setMoveAllLoading(true); setMoveAllMsg(''); setMoveAllError('')
    const r = await fetch('/api/settings/move-all-fonds-to-coffre', { method: 'POST' })
    if (r.ok) {
      const d = await r.json()
      setMoveAllMsg(`✓ ${d.moved} lignes déplacées de Fond de caisse vers Coffre-fort. Fond de caisse est maintenant vide.`)
      setMoveAllModal(false)
    } else {
      const d = await r.json().catch(() => ({}))
      setMoveAllError(d.error || 'Erreur lors du déplacement.')
    }
    setMoveAllLoading(false)
  }
 
  return (
    <div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--terracotta)' }}>⚙️ Paramètres</h2>
 
      {/* DB migration */}
      <div className="card" style={{ maxWidth: 500, marginBottom: '1.5rem', borderLeft: '4px solid var(--terracotta)' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>🗄️ Mise à jour base de données</h3>
        <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
          À effectuer une fois après une mise à jour de l&apos;application pour ajouter les nouvelles colonnes.
        </p>
        <button className="btn-primary" disabled={dbUpdating} onClick={async () => {
          setDbUpdating(true); setDbMsg('')
          const r = await fetch('/api/init', { method: 'POST' })
          setDbMsg(r.ok ? '✓ Base de données à jour !' : '✗ Erreur, réessayez.')
          setDbUpdating(false)
        }}>
          {dbUpdating ? 'Mise à jour…' : '🔄 Mettre à jour'}
        </button>
        {dbMsg && <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: dbMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{dbMsg}</p>}
      </div>
 
      {/* Excel base file */}
      <div className="card" style={{ maxWidth: 500, marginBottom: '1.5rem', borderLeft: '4px solid #2D6A4F' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>📎 Fichier Excel de référence</h3>
        <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
          Uploadez votre <strong>COMPTES RIAD 2026.xlsx</strong> ici. Lors du téléchargement Excel (bouton 📊 en haut), vos onglets existants seront préservés et les 3 nouveaux onglets (Encaissements, Dépenses, Fond de caisse) seront automatiquement mis à jour avec les données actuelles.
        </p>
        {hasBaseFile && (
          <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '0.4rem', padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: '#2D6A4F', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>✓ Fichier Excel enregistré</span>
            <button onClick={removeExcel} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: '0.8rem' }}>✕ Supprimer</button>
          </div>
        )}
        <form onSubmit={uploadExcel} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="file" accept=".xlsx" onChange={e => setExcelFile(e.target.files?.[0] || null)} style={{ fontSize: '0.85rem', flex: 1, minWidth: 200 }} />
          <button className="btn-primary" type="submit" disabled={!excelFile || excelUploading} style={{ background: '#2D6A4F', whiteSpace: 'nowrap' }}>
            {excelUploading ? 'Upload…' : hasBaseFile ? '🔄 Remplacer' : '⬆️ Uploader'}
          </button>
        </form>
        {excelMsg && <p style={{ color: 'var(--green)', fontSize: '0.825rem', marginTop: '0.5rem' }}>{excelMsg}</p>}
        {excelError && <p style={{ color: 'var(--red)', fontSize: '0.825rem', marginTop: '0.5rem' }}>{excelError}</p>}
      </div>
 
      <div className="card" style={{ maxWidth: 420, marginBottom: '1.5rem' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Changer le PIN</h3>
        <form onSubmit={changePin} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div><label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>PIN actuel</label><input className="form-input" type="password" value={currentPin} onChange={e => setCurrentPin(e.target.value)} required /></div>
          <div><label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Nouveau PIN</label><input className="form-input" type="password" value={newPin} onChange={e => setNewPin(e.target.value)} required /></div>
          <div><label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Confirmer</label><input className="form-input" type="password" value={confirmPin} onChange={e => setConfirmPin(e.target.value)} required /></div>
          {pinError && <p style={{ color: 'var(--red)', fontSize: '0.875rem' }}>{pinError}</p>}
          {pinMsg && <p style={{ color: 'var(--green)', fontSize: '0.875rem' }}>{pinMsg}</p>}
          <button className="btn-primary" type="submit">Enregistrer</button>
        </form>
      </div>
      <div className="card" style={{ maxWidth: 420, marginBottom: '1.5rem', borderLeft: '4px solid #6366F1' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#6366F1' }}>Importer l&apos;historique BANQUE 2026</h3>
        <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: '1rem' }}>Import ponctuel des 705 mouvements du relevé banque (nov. 2025 → sept. 2026) fournis par Valérie, avec le solde initial correspondant. À ne déclencher qu&apos;une seule fois — relancer dupliquerait toutes les lignes.</p>
        <button style={{ background: '#6366F1', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1.25rem', cursor: 'pointer', fontWeight: 600 }} onClick={() => setImportBanqueModal(true)}>Importer les 705 lignes</button>
        {importBanqueMsg && <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--green)', fontWeight: 600 }}>{importBanqueMsg}</p>}
        {importBanqueError && <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--red)', fontWeight: 600 }}>{importBanqueError}</p>}
      </div>
      {importBanqueModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ maxWidth: 380, width: '90%', textAlign: 'center' }}>
            <p style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem', color: '#6366F1' }}>Importer l&apos;historique BANQUE 2026</p>
            <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: '1.5rem' }}>705 mouvements seront ajoutés aux Dépenses/Encaissements et le solde bancaire initial sera fixé à 138 704,39 MAD. Ne clique qu&apos;une seule fois : relancer l&apos;import dupliquerait toutes les lignes.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => setImportBanqueModal(false)} disabled={importBanqueLoading}>Annuler</button>
              <button className="btn-primary" style={{ background: '#6366F1' }} onClick={importBanque2026} disabled={importBanqueLoading}>{importBanqueLoading ? 'Import…' : 'Importer'}</button>
            </div>
          </div>
        </div>
      )}
 
      <div className="card" style={{ maxWidth: 420, marginBottom: '1.5rem', borderLeft: '4px solid #0D9488' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#0D9488' }}>Importer l&apos;historique Coffre-fort 2025-2026</h3>
        <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: '1rem' }}>Import ponctuel des 623 mouvements du cahier &quot;caisse rouge&quot; (janv. 2025 → août 2026) fournis par Valérie. Nouvelles catégories ajoutées pour l&apos;occasion : Change, Caisse rouge, Entretien, Livraison mob, Alcool — les retraits banque et les sorties perso Valérie sont classés en Divers. À ne déclencher qu&apos;une seule fois — relancer dupliquerait toutes les lignes.</p>
        <button style={{ background: '#0D9488', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1.25rem', cursor: 'pointer', fontWeight: 600 }} onClick={() => setImportCoffreModal(true)}>Importer les 623 lignes</button>
        {importCoffreMsg && <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--green)', fontWeight: 600 }}>{importCoffreMsg}</p>}
        {importCoffreError && <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--red)', fontWeight: 600 }}>{importCoffreError}</p>}
      </div>
      {importCoffreModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ maxWidth: 380, width: '90%', textAlign: 'center' }}>
            <p style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem', color: '#0D9488' }}>Importer l&apos;historique Coffre-fort 2025-2026</p>
            <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: '1.5rem' }}>623 mouvements seront ajoutés au Coffre-fort (solde de départ de 4 769,00 MAD du 01/01/2025 inclus). Ne clique qu&apos;une seule fois : relancer l&apos;import dupliquerait toutes les lignes.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => setImportCoffreModal(false)} disabled={importCoffreLoading}>Annuler</button>
              <button className="btn-primary" style={{ background: '#0D9488' }} onClick={importCoffre2026} disabled={importCoffreLoading}>{importCoffreLoading ? 'Import…' : 'Importer'}</button>
            </div>
          </div>
        </div>
      )}
 
      <div className="card" style={{ maxWidth: 420, marginBottom: '1.5rem', borderLeft: '4px solid #0D9488' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#0D9488' }}>Importer les transactions en euros du Coffre-fort</h3>
        <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: '1rem' }}>Complète l&apos;import précédent (qui ne contenait que les montants en DHS) avec les 123 mouvements en EUR du même cahier &quot;caisse rouge&quot; (janv. 2025 → juin 2026) : pourboires et paiements clients en euros, changes, et sorties Valérie en euros. À ne déclencher qu&apos;une seule fois — relancer dupliquerait toutes les lignes.</p>
        <button style={{ background: '#0D9488', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1.25rem', cursor: 'pointer', fontWeight: 600 }} onClick={() => setImportCoffreEurModal(true)}>Importer les 123 lignes en euros</button>
        {importCoffreEurMsg && <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--green)', fontWeight: 600 }}>{importCoffreEurMsg}</p>}
        {importCoffreEurError && <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--red)', fontWeight: 600 }}>{importCoffreEurError}</p>}
      </div>
      {importCoffreEurModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ maxWidth: 380, width: '90%', textAlign: 'center' }}>
            <p style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem', color: '#0D9488' }}>Importer les transactions en euros</p>
            <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: '1.5rem' }}>123 mouvements en EUR seront ajoutés au Coffre-fort (16 902,00 € en entrées, 16 902,00 € en sorties). Ne clique qu&apos;une seule fois : relancer l&apos;import dupliquerait toutes les lignes.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => setImportCoffreEurModal(false)} disabled={importCoffreEurLoading}>Annuler</button>
              <button className="btn-primary" style={{ background: '#0D9488' }} onClick={importCoffreEur2026} disabled={importCoffreEurLoading}>{importCoffreEurLoading ? 'Import…' : 'Importer'}</button>
            </div>
          </div>
        </div>
      )}
 
      <div className="card" style={{ maxWidth: 420, marginBottom: '1.5rem', borderLeft: '4px solid var(--red)' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--red)' }}>Tout déplacer de Fond de caisse vers Coffre-fort</h3>
        <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: '1rem' }}>Déplace TOUTES les lignes actuellement dans Fond de caisse vers le Coffre-fort. Fond de caisse sera vidé. Action définitive.</p>
        <button style={{ background: 'var(--red)', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1.25rem', cursor: 'pointer', fontWeight: 600 }} onClick={() => setMoveAllModal(true)}>Tout déplacer vers le Coffre-fort</button>
        {moveAllMsg && <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--green)', fontWeight: 600 }}>{moveAllMsg}</p>}
        {moveAllError && <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--red)', fontWeight: 600 }}>{moveAllError}</p>}
      </div>
      {moveAllModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ maxWidth: 380, width: '90%', textAlign: 'center' }}>
            <p style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--red)' }}>Tout déplacer vers le Coffre-fort</p>
            <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: '1.5rem' }}>Toutes les lignes actuellement dans Fond de caisse seront copiées dans le Coffre-fort, puis supprimées de Fond de caisse (qui sera vide). Cette action est définitive.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => setMoveAllModal(false)} disabled={moveAllLoading}>Annuler</button>
              <button className="btn-primary" style={{ background: 'var(--red)' }} onClick={moveAllFondsToCoffre} disabled={moveAllLoading}>{moveAllLoading ? 'Déplacement…' : 'Confirmer'}</button>
            </div>
          </div>
        </div>
      )}
 
      <div className="card" style={{ maxWidth: 420, marginBottom: '1.5rem', borderLeft: '4px solid #B45309' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#B45309' }}>Vérifier / corriger emplacement import Coffre</h3>
        <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: '1rem' }}>Vérifie pour chacune des 623 lignes importées si elle est bien dans le Coffre-fort. Si des lignes se trouvent en Fond de caisse, elles sont automatiquement déplacées vers le Coffre-fort. Sans danger à relancer plusieurs fois.</p>
        <button style={{ background: '#B45309', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1.25rem', cursor: 'pointer', fontWeight: 600 }} onClick={fixCoffreLocation} disabled={fixCoffreLoading}>{fixCoffreLoading ? 'Vérification…' : 'Vérifier et corriger'}</button>
        {fixCoffreMsg && <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--green)', fontWeight: 600 }}>{fixCoffreMsg}</p>}
        {fixCoffreError && <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--red)', fontWeight: 600 }}>{fixCoffreError}</p>}
      </div>
 
      <div className="card" style={{ maxWidth: 420, marginBottom: '1.5rem', borderLeft: '4px solid var(--red)' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--red)' }}>Vider les entrées</h3>
        <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: '1rem' }}>Supprime toutes les Encaissements, Dépenses, entrées de Fond de caisse et de Coffre. Les employés, le PIN et les soldes de départ ne sont pas touchés.</p>
        <button style={{ background: 'var(--red)', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1.25rem', cursor: 'pointer', fontWeight: 600 }} onClick={() => setResetEntriesModal(true)}>Vider toutes les entrées</button>
      </div>
      {resetEntriesModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ maxWidth: 380, width: '90%', textAlign: 'center' }}>
            <p style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--red)' }}>⚠️ Vider les entrées</p>
            <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: '1.5rem' }}>Toutes les Encaissements, Dépenses, entrées de Fond de caisse et de Coffre seront supprimées définitivement. Les employés, le PIN et les soldes de départ resteront inchangés.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => setResetEntriesModal(false)} disabled={resetEntriesLoading}>Annuler</button>
              <button className="btn-red" onClick={resetEntries} disabled={resetEntriesLoading}>{resetEntriesLoading ? 'Suppression…' : 'Vider'}</button>
            </div>
          </div>
        </div>
      )}
      <div className="card" style={{ maxWidth: 420, borderLeft: '4px solid var(--red)' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--red)' }}>Zone dangereuse</h3>
        <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: '1rem' }}>Réinitialiser supprime toutes les données et remet le PIN par défaut.</p>
        <button style={{ background: 'var(--red)', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1.25rem', cursor: 'pointer', fontWeight: 600 }} onClick={() => setResetModal(true)}>Réinitialiser toutes les données</button>
      </div>
      {resetModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ maxWidth: 360, width: '90%', textAlign: 'center' }}>
            <p style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--red)' }}>⚠️ Réinitialisation</p>
            <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: '1.5rem' }}>Toutes les données seront supprimées.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => setResetModal(false)}>Annuler</button>
              <button className="btn-red" onClick={resetAll}>Réinitialiser</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
 
 
 
 

