/**
 * Boundary-safe tokenization and phrase matching designed specifically for
 * technical resumes and job descriptions (C, C++, C#, .NET, R, CI/CD, BLE, etc.).
 */

export const SINGLE_CHAR_LANGUAGES = new Set(['c', 'r']);

const ATOMIC_SLASH_TERMS = new Set([
  'ci/cd',
  'tcp/ip',
  'dc/dc',
  'ac/dc',
  'emi/emc',
  'ui/ux',
  'ux/ui',
  'i/o',
]);

const PROTECTED_STEMS = new Set([
  'c', 'c++', 'c#', 'r', 'go', 'js', 'ts', 'py', 'ai', 'ml', 'dl', 'rl', 'cv',
  'aws', 'gcp', 'css', 'scss', 'sass', 'less', 'ios', 'macos', 'rtos', 'freertos',
  'cmos', 'vhdl', 'verilog', 'systemverilog', 'uvm', 'vlsi', 'arm', 'mips',
  'usb', 'can', 'spi', 'i2c', 'uart', 'ble', 'dma', 'adc', 'dac', 'pwm', 'gpio',
  'ota', 'bsp', 'hal', 'cmsis', 'cuda', 'cudnn', 'ptx', 'onnx', 'tensorrt',
  'triton', 'jetson', 'redis', 'keras', 'pandas', 'postgres', 'jenkins',
  'kubernetes', 'k8s', 'linux', 'unix', 'windows', 'nginx', 'rust', 'swift',
  'dart', 'zigbee', 'lora', 'mqtt', 'llm', 'rag', 'vllm', 'nextjs', 'nodejs',
  'reactjs', 'vuejs', 'express', 'vitest', 'jest', 'cypress', 'ansys', 'cadence',
]);

export function normalizeSource(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\w\s+#./'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function trimTokenPunctuation(raw: string): string {
  let token = raw.replace(/^[^a-z0-9.]+/i, '');
  if (token.startsWith('.') && token.toLowerCase() !== '.net') {
    token = token.replace(/^\.+/, '');
  }
  token = token.replace(/[^a-z0-9+#]+$/i, '');
  return token;
}

export function tokenizeText(text: string): string[] {
  const normalized = normalizeSource(text);
  if (!normalized) return [];

  const tokens: string[] = [];
  for (const piece of normalized.split(/\s+/)) {
    const cleaned = trimTokenPunctuation(piece);
    if (!cleaned) continue;

    if (cleaned.includes('/')) {
      if (ATOMIC_SLASH_TERMS.has(cleaned)) {
        tokens.push(cleaned);
        continue;
      }
      for (const part of cleaned.split('/').map(trimTokenPunctuation)) {
        if (part && (part.length > 1 || SINGLE_CHAR_LANGUAGES.has(part))) {
          tokens.push(part);
        }
      }
      continue;
    }

    if (cleaned.length > 1 || SINGLE_CHAR_LANGUAGES.has(cleaned)) {
      tokens.push(cleaned);
    }
  }

  return tokens;
}

export function stemWord(word: string): string {
  const w = word.toLowerCase();
  if (w.length <= 3 || PROTECTED_STEMS.has(w) || /[+#/.]/.test(w)) {
    return w;
  }

  const rules: [RegExp, string][] = [
    [/ies$/, 'y'],
    [/ves$/, 'f'],
    [/ings$/, ''],
    [/ing$/, ''],
    [/ed$/, ''],
    [/ment$/, ''],
    [/ness$/, ''],
    [/s$/, ''],
  ];

  for (const [pattern, replacement] of rules) {
    if (pattern.test(w)) {
      const candidate = w.replace(pattern, replacement);
      if (candidate.length >= 3) return candidate;
    }
  }
  return w;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Exact boundary match supporting symbols (+, #, ., /).
 * Guarantees "java" never matches "javascript", "arm" never matches "alarm",
 * "c" never matches "c++" or "c#", and "go" never matches "algorithms".
 */
export function matchesWithBoundary(term: string, corpus: string): boolean {
  const t = normalizeSource(term);
  const c = normalizeSource(corpus);
  if (!t || !c) return false;

  const escaped = escapeRegex(t);
  const rx = new RegExp(`(?:^|[^a-z0-9_+#])${escaped}(?=$|[^a-z0-9_+#])`, 'i');
  return rx.test(c);
}

/**
 * Checks whether a multi-word or single-word skill exists in a target document
 * using exact boundary match, hyphenated/contiguous token match, or safe stemming.
 */
export function containsSkillPhrase(phrase: string, documentText: string): boolean {
  const p = normalizeSource(phrase);
  if (!p) return false;

  if (matchesWithBoundary(p, documentText)) return true;

  const phraseTokens = tokenizeText(p);
  if (phraseTokens.length === 0) return false;

  if (phraseTokens.length === 1) {
    const single = phraseTokens[0];
    if (single.length <= 3 || PROTECTED_STEMS.has(single) || /[+#/.]/.test(single)) {
      return false;
    }
    const targetStem = stemWord(single);
    return tokenizeText(documentText).some(
      (tok) => tok.length > 3 && !PROTECTED_STEMS.has(tok) && stemWord(tok) === targetStem,
    );
  }

  // Check hyphenated variant (e.g. "real-time operating system" vs "real time operating system")
  const hyphenated = phraseTokens.join('-');
  if (matchesWithBoundary(hyphenated, documentText)) return true;

  // Contiguous stemmed sequence scan
  const docTokens = tokenizeText(documentText);
  for (let i = 0; i <= docTokens.length - phraseTokens.length; i++) {
    let ok = true;
    for (let j = 0; j < phraseTokens.length; j++) {
      const dt = docTokens[i + j];
      const pt = phraseTokens[j];
      if (dt !== pt && stemWord(dt) !== stemWord(pt)) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }

  return false;
}
