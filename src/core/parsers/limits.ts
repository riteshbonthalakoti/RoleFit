export const PARSER_LIMITS = {
  MAX_PDF_BYTES: 10 * 1024 * 1024, // 10 MB
  MAX_DOCX_BYTES: 5 * 1024 * 1024, // 5 MB
  MAX_TXT_BYTES: 2 * 1024 * 1024, // 2 MB
  MAX_PDF_PAGES: 25,
  MAX_ZIP_ENTRIES: 200,
  MAX_ZIP_UNCOMPRESSED_BYTES: 20 * 1024 * 1024, // 20 MB
  MAX_ZIP_COMPRESSION_RATIO: 100,
  MAX_TEXT_CHARS: 200_000,
  PARSE_TIMEOUT_MS: 10_000,
} as const;

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s.`)), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
