import { NextRequest, NextResponse } from 'next/server'
import { getManagerSession } from '@/lib/auth'
import sql from '@/lib/db'
 
export const dynamic = 'force-dynamic'
 
export async function POST(req: NextRequest) {
  // Accept manager session OR employee token
  const isManager = await getManagerSession()
  if (!isManager) {
    // Check employee token from header or form
    const token = req.headers.get('x-employee-token')
    if (token) {
      const emp = await sql`SELECT id FROM employees WHERE token = ${token} AND active = 1`
      if (!emp[0]) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    } else {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
  }
 
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY non configurée' }, { status: 500 })
 
  const form = await req.formData()
  const file = form.get('file') as File | null
  const entryType = form.get('type') as string // 'cb' or 'cash'
  if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
 
  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
 
  let mediaType = file.type
  if (!mediaType || mediaType === 'application/octet-stream') {
    mediaType = file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'
  }
 
  const isImage = mediaType.startsWith('image/')
  const isPdf = mediaType === 'application/pdf'
 
  if (!isImage && !isPdf) {
    return NextResponse.json({ error: 'Format non supporté (image ou PDF uniquement)' }, { status: 400 })
  }
 
  const DEPENSES_CATEGORIES = ['Client','Commission','Administratif','Nourriture','Spa','Prestataire','Banque','Salaire','Maroc Telecom','Travaux','Aménagement/Déco','Entretien','Livraison/Carrossa','Radeema','Impôts','Divers']
 
  // Date du jour (heure du Maroc = UTC) : sert à dater correctement un document sans année
  const today = new Date().toISOString().slice(0, 10)
  const currentYear = today.slice(0, 4)
  const dateRule = `Nous sommes aujourd'hui le ${today}. Les documents sont marocains : TOUTE date écrite avec des chiffres est au format JOUR/MOIS/ANNÉE (JJ/MM/AAAA ou JJ/MM/AA, séparateurs / - . possibles), JAMAIS au format américain MOIS/JOUR. Exemple : "05/11/2026" = 5 novembre 2026 → "2026-11-05". Pour "date" : si l'année n'apparaît pas sur le document (ex : "29/09"), utilise l'année en cours (${currentYear}). Recopie aussi dans "date_raw" la date exactement telle qu'elle est imprimée sur le document (ou null).`
 
  const prompt = entryType === 'cb'
    ? `Analyse cette facture/reçu. Réponds UNIQUEMENT avec un JSON strict (aucun texte autour).
${dateRule}
 
Si c'est un ticket de supermarché/épicerie/grande surface avec plusieurs produits, détecte les catégories présentes et utilise ce format :
{
  "date": "YYYY-MM-DD ou null",
  "date_raw": "date telle qu'imprimée ou null",
  "supplier": "nom du magasin ou null",
  "amount_ttc": montant total en nombre décimal ou null,
  "is_supermarche": true,
  "items": [
    {"category": "une des catégories ci-dessous", "amount": nombre décimal, "label": "description courte"}
  ]
}
 
Sinon (facture normale), utilise ce format :
{
  "date": "YYYY-MM-DD ou null",
  "date_raw": "date telle qu'imprimée ou null",
  "supplier": "nom du fournisseur ou null",
  "amount_ht": nombre décimal ou null,
  "tva_rate": taux TVA en % (ex: 20) ou null,
  "amount_ttc": montant total TTC en nombre décimal ou null,
  "is_supermarche": false
}
 
Catégories disponibles : ${DEPENSES_CATEGORIES.join(', ')}.
Pour les supermarché : regroupe les produits par catégorie (ex: légumes/viande/épicerie → "Nourriture", produits d'entretien/fournitures → "Administratif").
Si une information n'est pas visible, mets null. Réponds UNIQUEMENT avec le JSON.`
    : `Analyse ce ticket CB/reçu et extrait en JSON strict.
${dateRule}
{
  "date": "YYYY-MM-DD ou null",
  "date_raw": "date telle qu'imprimée ou null",
  "supplier": "nom établissement ou null",
  "amount_ttc": montant total en nombre décimal ou null
}
Réponds UNIQUEMENT avec le JSON.`
 
  const contentItem = isImage
    ? { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } }
    : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
 
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [contentItem, { type: 'text', text: prompt }],
        }],
      }),
    })
 
    if (!r.ok) {
      const err = await r.text()
      console.error('Anthropic error:', err)
      return NextResponse.json({ error: 'Erreur API extraction' }, { status: 500 })
    }
 
    const data = await r.json()
    const text: string = data.content?.[0]?.text ?? '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({})
    const extracted = JSON.parse(jsonMatch[0])
    // La date imprimée est relue ici en JJ/MM/AAAA : elle prime sur l'interprétation du modèle
    const fromRaw = parseDayFirstDate(extracted.date_raw, currentYear)
    extracted.date = sanitizeDate(fromRaw ?? extracted.date, today)
    delete extracted.date_raw
    return NextResponse.json(extracted)
  } catch (err) {
    console.error('Extract invoice error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
 
 
// Garde-fou sur la date lue : une date à plus de 6 mois d'aujourd'hui est très probablement
// une erreur de lecture de l'année. On essaie alors la même date dans l'année en cours ;
// si elle reste trop éloignée, on n'impose pas de date (le formulaire garde la date du jour).
function sanitizeDate(value: unknown, today: string): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const MAX_DAYS = 183
  const daysFromToday = (d: string) => Math.abs(Date.parse(d + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000
  const isReal = (d: string) => !isNaN(Date.parse(d + 'T00:00:00Z')) && new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) === d
  if (isReal(value) && daysFromToday(value) <= MAX_DAYS) return value
  const sameDayThisYear = today.slice(0, 4) + value.slice(4)
  if (isReal(sameDayThisYear) && daysFromToday(sameDayThisYear) <= MAX_DAYS) return sameDayThisYear
  return null
}

// Lit une date imprimée au format marocain/français JJ/MM/AAAA (ou JJ/MM/AA, JJ/MM, séparateurs / - .).
// Un format ISO AAAA-MM-JJ est aussi accepté. Renvoie null si le texte n'est pas reconnu.
function parseDayFirstDate(raw: unknown, currentYear: string): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  const pad = (n: number) => String(n).padStart(2, '0')
  const build = (y: number, m: number, d: number) => {
    if (m < 1 || m > 12 || d < 1 || d > 31) return null
    const iso = `${y}-${pad(m)}-${pad(d)}`
    const dt = new Date(iso + 'T00:00:00Z')
    return !isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === iso ? iso : null
  }
  let m = s.match(/(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/)
  if (m) return build(+m[1], +m[2], +m[3])
  m = s.match(/(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?/)
  if (m) {
    let y = m[3] ? +m[3] : +currentYear
    if (m[3] && m[3].length === 2) y += 2000
    return build(y, +m[2], +m[1])
  }
  return null
}
