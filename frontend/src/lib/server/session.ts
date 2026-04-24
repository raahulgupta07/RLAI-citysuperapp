// In-memory token blacklist for session invalidation on logout
// Tokens are stored as a Set of raw token strings with expiry timestamps

interface BlacklistEntry {
  expiresAt: number;
}

const blacklist = new Map<string, BlacklistEntry>();

// Cleanup expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of blacklist) {
    if (now > entry.expiresAt) blacklist.delete(token);
  }
}, 10 * 60 * 1000);

export function blacklistToken(token: string, maxAgeSec = 60 * 60 * 24 * 30) {
  // Store token in blacklist until it would naturally expire
  blacklist.set(token, { expiresAt: Date.now() + maxAgeSec * 1000 });
}

export function isTokenBlacklisted(token: string): boolean {
  return blacklist.has(token);
}
