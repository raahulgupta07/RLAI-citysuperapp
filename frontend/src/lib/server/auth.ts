import { SignJWT, jwtVerify } from 'jose';
import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Cookies } from '@sveltejs/kit';

// Auto-generate JWT secret if not set in .env
// Persists to data/.jwt_secret so it survives container restarts
function getJwtSecret(): Uint8Array {
  // 1. Use env var if set and not default
  const envSecret = process.env.JWT_SECRET;
  if (envSecret && envSecret !== 'superapp-secret-change-me-in-prod' && envSecret !== 'superapp-dev-secret') {
    return new TextEncoder().encode(envSecret);
  }

  // 2. Use persisted secret if exists
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const secretPath = join(__dirname, '..', '..', '..', 'data', '.jwt_secret');

  try {
    if (existsSync(secretPath)) {
      const saved = readFileSync(secretPath, 'utf-8').trim();
      if (saved.length >= 32) return new TextEncoder().encode(saved);
    }
  } catch {}

  // 3. Generate new secret and persist it
  const newSecret = randomBytes(32).toString('hex');
  try {
    mkdirSync(join(__dirname, '..', '..', '..', 'data'), { recursive: true });
    writeFileSync(secretPath, newSecret, { mode: 0o600 });
  } catch {}

  return new TextEncoder().encode(newSecret);
}

const JWT_SECRET = getJwtSecret();
const COOKIE_NAME = 'superapp_token';

export interface JwtPayload {
  id: number;
  username: string;
  display_name: string;
  email: string;
  role: string;
  ldap_groups: string[];
}

export async function signJwt(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

export function setAuthCookie(cookies: Cookies, token: string) {
  cookies.set(COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // set true in production with HTTPS
    maxAge: 60 * 60 * 24, // 24 hours
  });
}

export function clearAuthCookie(cookies: Cookies) {
  cookies.delete(COOKIE_NAME, { path: '/' });
}

export async function getUserFromCookies(cookies: Cookies): Promise<JwtPayload | null> {
  const token = cookies.get(COOKIE_NAME);
  if (!token) return null;
  return verifyJwt(token);
}

export async function authenticateLdap(
  username: string,
  password: string,
  ldapUrl?: string,
  bindDn?: string,
  searchBase?: string
): Promise<{ success: boolean; groups: string[]; display_name: string; email: string }> {
  const LDAP_URL = ldapUrl || process.env.LDAP_URL;

  if (!LDAP_URL) {
    // No LDAP configured — fallback to local auth
    return { success: false, groups: [], display_name: '', email: '' };
  }

  try {
    // Dynamic import to avoid issues when ldapjs is not installed
    const ldap = await import('ldapjs');
    const client = ldap.createClient({ url: LDAP_URL });
    const BIND_DN = bindDn || process.env.LDAP_BIND_DN || `uid=${username},ou=users,dc=example,dc=com`;
    const SEARCH_BASE = searchBase || process.env.LDAP_SEARCH_BASE || 'ou=users,dc=example,dc=com';

    return new Promise((resolve) => {
      const bindDn = BIND_DN.replace('{username}', username);

      client.bind(bindDn, password, (err: any) => {
        if (err) {
          client.unbind();
          resolve({ success: false, groups: [], display_name: '', email: '' });
          return;
        }

        // Search for user details
        client.search(SEARCH_BASE, {
          filter: `(uid=${username})`,
          scope: 'sub',
          attributes: ['cn', 'mail', 'memberOf'],
        }, (searchErr: any, res: any) => {
          let display_name = username;
          let email = '';
          let groups: string[] = [];

          if (searchErr) {
            client.unbind();
            resolve({ success: true, groups: ['all'], display_name, email });
            return;
          }

          res.on('searchEntry', (entry: any) => {
            const attrs = entry.ppiAttributes || entry.attributes || [];
            for (const attr of attrs) {
              if (attr.type === 'cn') display_name = attr.values?.[0] || username;
              if (attr.type === 'mail') email = attr.values?.[0] || '';
              if (attr.type === 'memberOf') groups = attr.values || [];
            }
          });

          res.on('end', () => {
            client.unbind();
            if (groups.length === 0) groups = ['all'];
            resolve({ success: true, groups, display_name, email });
          });

          res.on('error', () => {
            client.unbind();
            resolve({ success: true, groups: ['all'], display_name, email });
          });
        });
      });
    });
  } catch {
    return { success: false, groups: [], display_name: '', email: '' };
  }
}

// Local password check (simple hash comparison for dev)
export function checkLocalPassword(inputPass: string, expectedPass: string): boolean {
  return inputPass === expectedPass;
}
