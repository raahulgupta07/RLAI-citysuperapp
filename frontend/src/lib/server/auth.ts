import { SignJWT, jwtVerify } from 'jose';
import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
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
  // In Docker: cwd = /app, data at /app/frontend/data/
  // In dev: cwd = /path/to/City-GPT-SuperApp/frontend, data at ./data/
  const dataDir = existsSync(join(process.cwd(), 'frontend', 'data'))
    ? join(process.cwd(), 'frontend', 'data')
    : join(process.cwd(), 'data');
  const secretPath = join(dataDir, '.jwt_secret');

  try {
    if (existsSync(secretPath)) {
      const saved = readFileSync(secretPath, 'utf-8').trim();
      if (saved.length >= 32) return new TextEncoder().encode(saved);
    }
  } catch {}

  // 3. Generate new secret and persist it
  const newSecret = randomBytes(32).toString('hex');
  try {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(secretPath, newSecret, { mode: 0o600 });
    console.log('[AUTH] JWT secret auto-generated and saved to', secretPath);
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

export interface LdapConfig {
  host: string;
  port?: string;
  app_dn?: string;
  app_dn_password?: string;
  mail_attr?: string;
  username_attr?: string;
  search_base?: string;
  search_filter?: string;
  group_attr?: string;
  tls?: boolean;
}

export async function authenticateLdap(
  username: string,
  password: string,
  config: LdapConfig
): Promise<{ success: boolean; groups: string[]; display_name: string; email: string }> {
  if (!config.host) {
    return { success: false, groups: [], display_name: '', email: '' };
  }

  const protocol = config.tls ? 'ldaps' : 'ldap';
  const port = config.port || (config.tls ? '636' : '389');
  const ldapUrl = `${protocol}://${config.host}:${port}`;
  const mailAttr = config.mail_attr || 'mail';
  const usernameAttr = config.username_attr || 'sAMAccountName';
  const searchBase = config.search_base || '';
  const searchFilter = (config.search_filter || `(${usernameAttr}={username})`).replace('{username}', username);
  const groupAttr = config.group_attr || 'memberOf';

  try {
    const ldap = await import('ldapjs');
    const clientOpts: any = { url: ldapUrl, connectTimeout: 10000 };
    if (config.tls) {
      clientOpts.tlsOptions = { rejectUnauthorized: false };
    }
    const client = ldap.createClient(clientOpts);

    return new Promise((resolve) => {
      const fail = () => {
        try { client.unbind(); } catch {}
        resolve({ success: false, groups: [], display_name: '', email: '' });
      };

      client.on('error', () => fail());

      // Step 1: Bind with service account (Application DN) or directly as user
      const bindDn = config.app_dn || '';
      const bindPassword = config.app_dn_password || '';
      const useServiceAccount = !!(bindDn && bindPassword);

      const initialBindDn = useServiceAccount ? bindDn : `${usernameAttr}=${username},${searchBase}`;
      const initialBindPassword = useServiceAccount ? bindPassword : password;

      client.bind(initialBindDn, initialBindPassword, (bindErr: any) => {
        if (bindErr) { fail(); return; }

        // Step 2: Search for the user
        const searchAttrs = ['cn', 'displayName', mailAttr, groupAttr];
        if (usernameAttr !== 'cn' && usernameAttr !== mailAttr) searchAttrs.push(usernameAttr);

        client.search(searchBase, {
          filter: searchFilter,
          scope: 'sub',
          attributes: searchAttrs,
        }, (searchErr: any, res: any) => {
          if (searchErr) {
            try { client.unbind(); } catch {}
            resolve({ success: !useServiceAccount, groups: ['all'], display_name: username, email: '' });
            return;
          }

          let display_name = username;
          let email = '';
          let groups: string[] = [];
          let userDn = '';

          res.on('searchEntry', (entry: any) => {
            userDn = entry.objectName || entry.dn?.toString() || '';
            const attrs = entry.ppiAttributes || entry.attributes || [];
            for (const attr of attrs) {
              if (attr.type === 'displayName') display_name = attr.values?.[0] || display_name;
              else if (attr.type === 'cn' && display_name === username) display_name = attr.values?.[0] || username;
              if (attr.type === mailAttr) email = attr.values?.[0] || '';
              if (attr.type === groupAttr) groups = attr.values || [];
            }
          });

          res.on('end', () => {
            if (!useServiceAccount) {
              // Already authenticated via direct bind
              if (groups.length === 0) groups = ['all'];
              try { client.unbind(); } catch {}
              resolve({ success: true, groups, display_name, email });
              return;
            }

            // Step 3: If using service account, verify user password by re-binding as user
            if (!userDn) {
              try { client.unbind(); } catch {}
              resolve({ success: false, groups: [], display_name: '', email: '' });
              return;
            }

            client.bind(userDn, password, (userBindErr: any) => {
              try { client.unbind(); } catch {}
              if (userBindErr) {
                resolve({ success: false, groups: [], display_name: '', email: '' });
                return;
              }
              if (groups.length === 0) groups = ['all'];
              resolve({ success: true, groups, display_name, email });
            });
          });

          res.on('error', () => {
            try { client.unbind(); } catch {}
            resolve({ success: !useServiceAccount, groups: ['all'], display_name, email });
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
