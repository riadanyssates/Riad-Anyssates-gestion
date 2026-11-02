import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'

const SESSION_COOKIE = 'mgr_session'
// Nom affiché / enregistré pour la personne connectée à l'interface manager
const MANAGER_NAME_COOKIE = 'mgr_name'
// Clé secrète (jamais dans le code) : SESSION_SECRET dans Vercel, à défaut le jeton Turso.
function secret(): string {
  const k = process.env.SESSION_SECRET || process.env.TURSO_AUTH_TOKEN || ''
  if (!k) throw new Error('SESSION_SECRET manquant')
  return k
}

const SESSION_DAYS = 7

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

// Jeton de session signé : nom + date d'expiration, impossible à fabriquer sans la clé secrète.
// (Avant, n'importe quelle valeur de cookie ouvrait l'accès manager.)
export function createSessionToken(name: string): string {
  const payload = Buffer.from(JSON.stringify({ n: name, exp: Date.now() + SESSION_DAYS * 864e5 })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

function readSession(token: string | undefined | null): { n: string } | null {
  if (!token) return null
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  let expected: string
  try { expected = sign(payload) } catch { return null }
  const a = Buffer.from(sig), b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (typeof d?.n !== 'string' || typeof d?.exp !== 'number' || d.exp < Date.now()) return null
    return { n: d.n }
  } catch { return null }
}

export function validateSessionToken(token: string): boolean {
  return readSession(token) !== null
}

export async function getManagerSession(): Promise<boolean> {
  return readSession(cookies().get(SESSION_COOKIE)?.value) !== null
}

export function getSessionFromRequest(req: NextRequest): string | null {
  return req.cookies.get(SESSION_COOKIE)?.value || null
}

export function getManagerName(): string {
  // le nom vient du jeton signé (le cookie mgr_name n'est plus qu'un affichage)
  const name = readSession(cookies().get(SESSION_COOKIE)?.value)?.n || ''
  // Connexion par code PIN = Valérie (ancien libellé « Administrateur »)
  return !name || name === 'Administrateur' ? 'Valérie' : name
}

export { SESSION_COOKIE, MANAGER_NAME_COOKIE }
