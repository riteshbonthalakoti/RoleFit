import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import {
  hasMagicBytes,
  isInjectableTabUrl,
  matchesDomain,
  PDF_MAGIC_BYTES,
  sanitizeExternalUrl,
  ZIP_MAGIC_BYTES,
} from '../security';
import { validateDocxArchive } from '../parsers';

describe('RoleFit security controls', () => {
  it('blocks javascript: and data: URIs while permitting http/https URLs', () => {
    const jsScheme = ['javascript', 'alert(1)'].join(':');
    expect(sanitizeExternalUrl(jsScheme)).toBeNull();
    expect(sanitizeExternalUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(sanitizeExternalUrl('vbscript:msgbox(1)')).toBeNull();
    expect(sanitizeExternalUrl('https://jobs.lever.co/acme/123')).toBe('https://jobs.lever.co/acme/123');
    expect(sanitizeExternalUrl('http://localhost:3000/job')).toBe('http://localhost:3000/job');
  });

  it('rejects browser system pages and Chrome Web Store from script injection', () => {
    expect(isInjectableTabUrl('chrome://extensions')).toBe(false);
    expect(isInjectableTabUrl('chrome-extension://abc/popup.html')).toBe(false);
    expect(isInjectableTabUrl('edge://settings')).toBe(false);
    expect(isInjectableTabUrl('https://chromewebstore.google.com/detail/xyz')).toBe(false);
    expect(isInjectableTabUrl('https://www.linkedin.com/jobs/view/123')).toBe(true);
  });

  it('enforces exact domain suffix matching against spoofed hostnames', () => {
    expect(matchesDomain('www.linkedin.com', 'linkedin.com')).toBe(true);
    expect(matchesDomain('linkedin.com', 'linkedin.com')).toBe(true);
    expect(matchesDomain('linkedin.com.attacker.test', 'linkedin.com')).toBe(false);
    expect(matchesDomain('evillinkedin.com', 'linkedin.com')).toBe(false);
  });

  it('verifies PDF and ZIP magic-byte headers strictly', () => {
    const fakePdf = new TextEncoder().encode('<html>not a pdf</html>').buffer;
    const validPdf = new TextEncoder().encode('%PDF-1.7\n...').buffer;
    expect(hasMagicBytes(fakePdf, PDF_MAGIC_BYTES)).toBe(false);
    expect(hasMagicBytes(validPdf, PDF_MAGIC_BYTES)).toBe(true);
    expect(hasMagicBytes(fakePdf, ZIP_MAGIC_BYTES)).toBe(false);
  });

  it('rejects malformed DOCX archives missing word/document.xml or containing path traversal', async () => {
    const zipNoDoc = new JSZip();
    zipNoDoc.file('readme.txt', 'hello');
    const noDocBuf = await zipNoDoc.generateAsync({ type: 'arraybuffer' });
    await expect(validateDocxArchive(noDocBuf)).rejects.toThrow(/word\/document\.xml/i);

    const zipTraversal = new JSZip();
    zipTraversal.file('../evil.txt', 'bad');
    zipTraversal.file('word/document.xml', '<w:document/>');
    const travBuf = await zipTraversal.generateAsync({ type: 'arraybuffer' });
    await expect(validateDocxArchive(travBuf)).rejects.toThrow(/unsafe file paths/i);

    const validDocx = new JSZip();
    validDocx.file('word/document.xml', '<w:document><w:body><w:p><w:r><w:t>Resume text</w:t></w:r></w:p></w:body></w:document>');
    const validBuf = await validDocx.generateAsync({ type: 'arraybuffer' });
    await expect(validateDocxArchive(validBuf)).resolves.toBeUndefined();
  });
});
