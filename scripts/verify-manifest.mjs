import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const root = resolve(process.cwd());
const distDir = join(root, 'dist');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const manifestPath = join(distDir, 'manifest.json');

if (!existsSync(manifestPath)) {
  console.error('FAIL: dist/manifest.json does not exist.');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const errors = [];

if (manifest.manifest_version !== 3) {
  errors.push(`manifest_version must be 3, found ${manifest.manifest_version}`);
}

if (manifest.version !== pkg.version) {
  errors.push(`manifest.version (${manifest.version}) does not match package.json (${pkg.version})`);
}

// Enforce least-privilege: zero static content_scripts and zero broad host patterns
if (Array.isArray(manifest.content_scripts) && manifest.content_scripts.length > 0) {
  errors.push('Static content_scripts are forbidden; use activeTab + scripting on demand.');
}

const rawManifest = JSON.stringify(manifest);
for (const forbidden of ['<all_urls>', '*://*/*', 'http://*/*', 'https://*/*', 'unsafe-eval', 'unsafe-inline']) {
  if (rawManifest.includes(forbidden)) {
    errors.push(`Forbidden manifest pattern detected: ${forbidden}`);
  }
}

const csp = manifest.content_security_policy?.extension_pages ?? '';
if (!csp.includes("script-src 'self'") || !csp.includes("object-src 'none'")) {
  errors.push(`Extension CSP is too weak: "${csp}"`);
}

if (!existsSync(join(distDir, 'assets', 'pdf.worker.min.mjs'))) {
  errors.push('Local pdf.worker.min.mjs was not bundled into dist/assets/.');
}

// chrome.scripting.executeScript runs content.js as a classic script (non-module)
const contentScriptPath = join(distDir, 'content.js');
if (!existsSync(contentScriptPath)) {
  errors.push('dist/content.js is missing.');
} else {
  const contentJs = readFileSync(contentScriptPath, 'utf8');
  if (/^\s*import\b/m.test(contentJs) || /\bexport\s*\{/.test(contentJs)) {
    errors.push('dist/content.js contains ES module import/export syntax; must be classic IIFE.');
  }
}

// Walk dist/ to enforce zero source maps and bundle size cap
let totalBytes = 0;
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
    } else {
      totalBytes += stat.size;
      if (entry.endsWith('.map')) {
        errors.push(`Source map leaked into dist/: ${full}`);
      }
    }
  }
}
walk(distDir);

const maxBytes = 15 * 1024 * 1024;
if (totalBytes > maxBytes) {
  errors.push(`dist/ size ${(totalBytes / 1024 / 1024).toFixed(2)} MB exceeds 15 MB budget.`);
}

if (errors.length > 0) {
  console.error('Manifest & bundle security verification FAILED:');
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log(
  `PASS: RoleFit v${manifest.version} MV3 manifest & bundle verified (${(totalBytes / 1024).toFixed(1)} KB total, zero broad permissions).`,
);
