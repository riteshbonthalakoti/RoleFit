# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in RoleFit (such as a parser DoS, XSS vector, or permission/messaging bypass), please report it privately via GitHub Security Advisories rather than opening a public issue.

## Security Architecture Highlights

- **Least-Privilege MV3 Manifest:** Zero static `content_scripts` and zero `<all_urls>` host permissions. Extraction runs strictly on-demand via `activeTab` + `chrome.scripting.executeScript`.
- **Strict CSP:** `script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`. Zero remote scripts or CDN workers.
- **Sender & URL Validation:** Service worker validates `sender.id === chrome.runtime.id` and restricts privileged scan commands to `popup.html`. External job links are validated strictly for `http:`/`https:`.
- **Untrusted File Guards:** Enforces magic-byte headers (`%PDF-`, `PK\x03\x04`), size caps, PDF page cap, parse timeouts, and DOCX ZIP-bomb/path-traversal pre-flight checks.
- **Automated Gates:** CI runs TypeScript strict typecheck, ESLint security rules, Vitest security tests, `npm audit`, CodeQL, and `scripts/verify-manifest.mjs`.
