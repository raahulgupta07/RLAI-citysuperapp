// Strip HTML tags and dangerous characters from user input
export function sanitizeText(input: string): string {
  if (!input) return '';
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .trim();
}

// Sanitize URL — only allow http/https protocols
export function sanitizeUrl(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  // Prepend https:// if no protocol
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (!trimmed.includes('://')) return `https://${trimmed}`;
  return ''; // reject non-http protocols (javascript:, data:, etc)
}
