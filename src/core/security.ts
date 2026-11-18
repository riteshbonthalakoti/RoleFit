const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['https:', 'http:']);

const RESTRICTED_URL_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'view-source:',
  'devtools://',
  'file://',
  'https://chromewebstore.google.com',
  'https://chrome.google.com/webstore',
];

/**
 * Validates that an external link uses strictly http: or https: to prevent
 * javascript: or data: URI injection in report views.
 */
export function sanitizeExternalUrl(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = new URL(raw.trim());
    if (!ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Checks whether a Chrome tab URL can safely accept on-demand script injection.
 */
export function isInjectableTabUrl(raw: string | undefined | null): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const lower = raw.trim().toLowerCase();
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
    return false;
  }
  return !RESTRICTED_URL_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/**
 * Strict domain suffix match preventing spoofing such as
 * "linkedin.com.attacker.test" matching "linkedin.com".
 */
export function matchesDomain(hostname: string, domain: string): boolean {
  const h = hostname.toLowerCase().replace(/\.+$/, '');
  const d = domain.toLowerCase().replace(/^\.+|\.+$/g, '');
  return h === d || h.endsWith(`.${d}`);
}

/**
 * Verifies leading file magic bytes against an expected byte signature.
 */
export function hasMagicBytes(buffer: ArrayBuffer, signature: number[]): boolean {
  if (buffer.byteLength < signature.length) return false;
  const view = new Uint8Array(buffer, 0, signature.length);
  return signature.every((byte, idx) => view[idx] === byte);
}

export const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
export const ZIP_MAGIC_BYTES = [0x50, 0x4b, 0x03, 0x04]; // PK\x03\x04 (DOCX)
