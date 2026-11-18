import { createHash } from 'crypto';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, relative, resolve } from 'path';
import JSZip from 'jszip';

const root = resolve(process.cwd());
const distDir = join(root, 'dist');
const releaseDir = join(root, 'release');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

mkdirSync(releaseDir, { recursive: true });

const zip = new JSZip();
const fixedDate = new Date('2026-01-01T00:00:00Z');

function collectFiles(dir, list = []) {
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectFiles(full, list);
    } else {
      list.push(full);
    }
  }
  return list;
}

const files = collectFiles(distDir);
for (const filePath of files) {
  const rel = relative(distDir, filePath).replace(/\\/g, '/');
  zip.file(rel, readFileSync(filePath), { date: fixedDate });
}

const zipName = `rolefit-v${pkg.version}-chrome.zip`;
const zipPath = join(releaseDir, zipName);
const buffer = await zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 9 },
});

writeFileSync(zipPath, buffer);
const sha256 = createHash('sha256').update(buffer).digest('hex');
writeFileSync(join(releaseDir, 'SHA256SUMS.txt'), `${sha256}  ${zipName}\n`);

console.log(`Packaged ${zipPath} (${(buffer.byteLength / 1024).toFixed(1)} KB)`);
console.log(`SHA256: ${sha256}`);
