import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import type { ResumeFileFormat } from '../types';
import { hasMagicBytes, PDF_MAGIC_BYTES, ZIP_MAGIC_BYTES } from '../security';
import { PARSER_LIMITS, withTimeout } from './limits';

export interface ParsedResumeOutput {
  text: string;
  format: ResumeFileFormat;
  wordCount: number;
}

function detectFormat(file: File): ResumeFileFormat {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (
    name.endsWith('.docx') ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'docx';
  }
  if (name.endsWith('.txt') || file.type === 'text/plain') return 'txt';
  throw new Error('Unsupported format. Please upload a PDF, DOCX, or TXT file.');
}

function finalizeText(raw: string): { text: string; wordCount: number } {
  const cleaned = raw
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, PARSER_LIMITS.MAX_TEXT_CHARS);

  if (cleaned.length < 20) {
    throw new Error('Could not extract enough readable text from this file. Scanned image PDFs are not supported.');
  }

  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  return { text: cleaned, wordCount };
}

/**
 * Validates ZIP structure before passing untrusted DOCX files to mammoth
 * to defend against ZIP bombs, path traversal, and encrypted archives.
 */
export async function validateDocxArchive(buffer: ArrayBuffer): Promise<void> {
  if (buffer.byteLength > PARSER_LIMITS.MAX_DOCX_BYTES) {
    throw new Error('DOCX file exceeds the 5 MB safety limit.');
  }
  if (!hasMagicBytes(buffer, ZIP_MAGIC_BYTES)) {
    throw new Error('Invalid DOCX file header (expected a valid OOXML archive).');
  }

  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files);

  if (entries.length === 0 || entries.length > PARSER_LIMITS.MAX_ZIP_ENTRIES) {
    throw new Error(`DOCX archive contains an unsafe number of entries (${entries.length}).`);
  }

  let totalUncompressed = 0;
  let hasDocumentXml = false;

  for (const entry of entries) {
    if (entry.name.includes('..') || entry.name.startsWith('/') || entry.name.startsWith('\\')) {
      throw new Error('DOCX archive contains unsafe file paths.');
    }
    if (entry.name === 'word/document.xml') {
      hasDocumentXml = true;
    }
    if (entry.dir) continue;

    // Inspect internal uncompressed size metadata when exposed by JSZip
    const meta = (entry as unknown as { _data?: { uncompressedSize?: number; compressedSize?: number } })._data;
    const uncompressed = meta?.uncompressedSize ?? 0;
    const compressed = Math.max(1, meta?.compressedSize ?? 1);

    if (uncompressed > PARSER_LIMITS.MAX_ZIP_UNCOMPRESSED_BYTES) {
      throw new Error('DOCX entry exceeds maximum safe uncompressed size.');
    }
    if (uncompressed / compressed > PARSER_LIMITS.MAX_ZIP_COMPRESSION_RATIO && uncompressed > 1024 * 1024) {
      throw new Error('DOCX archive failed ZIP-bomb compression ratio check.');
    }
    totalUncompressed += uncompressed;
    if (totalUncompressed > PARSER_LIMITS.MAX_ZIP_UNCOMPRESSED_BYTES) {
      throw new Error('DOCX total uncompressed content exceeds the 20 MB safety limit.');
    }
  }

  if (!hasDocumentXml) {
    throw new Error('Archive is missing word/document.xml and is not a valid DOCX resume.');
  }
}

async function parsePdfBuffer(buffer: ArrayBuffer): Promise<string> {
  if (buffer.byteLength > PARSER_LIMITS.MAX_PDF_BYTES) {
    throw new Error('PDF file exceeds the 10 MB safety limit.');
  }
  if (!hasMagicBytes(buffer, PDF_MAGIC_BYTES)) {
    throw new Error('Invalid PDF file header.');
  }

  // Point strictly to locally bundled worker inside the extension package
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('assets/pdf.worker.min.mjs');
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    disableFontFace: true,
  });

  const pdf = await loadingTask.promise;
  try {
    const pagesToRead = Math.min(pdf.numPages, PARSER_LIMITS.MAX_PDF_PAGES);
    const chunks: string[] = [];

    for (let pageNum = 1; pageNum <= pagesToRead; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageLines = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      chunks.push(pageLines);
    }

    return chunks.join('\n');
  } finally {
    await loadingTask.destroy();
  }
}

async function parseDocxBuffer(buffer: ArrayBuffer): Promise<string> {
  await validateDocxArchive(buffer);
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value ?? '';
}

async function parseTxtBuffer(buffer: ArrayBuffer): Promise<string> {
  if (buffer.byteLength > PARSER_LIMITS.MAX_TXT_BYTES) {
    throw new Error('TXT file exceeds the 2 MB safety limit.');
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
}

export async function parseResumeFile(file: File): Promise<ParsedResumeOutput> {
  const format = detectFormat(file);
  const buffer = await file.arrayBuffer();

  const rawText = await withTimeout(
    format === 'pdf'
      ? parsePdfBuffer(buffer)
      : format === 'docx'
        ? parseDocxBuffer(buffer)
        : parseTxtBuffer(buffer),
    PARSER_LIMITS.PARSE_TIMEOUT_MS,
    `Parsing ${format.toUpperCase()} resume`,
  );

  const { text, wordCount } = finalizeText(rawText);
  return { text, format, wordCount };
}
