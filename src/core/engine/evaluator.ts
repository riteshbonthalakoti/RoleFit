import {
  DIMENSION_META,
  type ActionItem,
  type DimensionStat,
  type FitGrade,
  type FitReport,
  type JobPosting,
  type ResumeProfile,
  type SkillDimension,
  type SkillMatch,
} from '../types';
import { SKILL_TAXONOMY, type TaxonomyEntry } from './taxonomy';
import { containsSkillPhrase, normalizeSource, SINGLE_CHAR_LANGUAGES, tokenizeText } from './tokenizer';

const TECH_CONTEXT_NEIGHBORS = new Set([
  'c++', 'cpp', 'python', 'java', 'rust', 'go', 'matlab', 'sql', 'bash',
  'verilog', 'embedded', 'firmware', 'linux', 'rtos', 'programming',
  'language', 'languages', 'code', 'coding', 'development', 'proficient',
  'experience', 'skills', 'using', 'in', 'with', 'and', 'or', 'cuda',
  'assembly', 'arm', 'stm32', 'esp32', 'mcu', 'microcontroller',
  'statistics', 'statistical', 'data', 'pandas', 'julia',
]);

function getAllForms(entry: TaxonomyEntry): string[] {
  return [entry.canonical, ...(entry.aliases ?? [])];
}

function isValidSingleCharInText(singleChar: string, text: string): boolean {
  const tokens = tokenizeText(text);
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] !== singleChar) continue;
    const prev = tokens[i - 1] ?? '';
    const next = tokens[i + 1] ?? '';
    if (TECH_CONTEXT_NEIGHBORS.has(prev) || TECH_CONTEXT_NEIGHBORS.has(next)) {
      return true;
    }
  }
  return false;
}

function countOccurrences(term: string, text: string): number {
  const normTerm = normalizeSource(term);
  const normText = normalizeSource(text);
  if (!normTerm || !normText) return 0;

  const escaped = normTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(`(?:^|[^a-z0-9_+#])${escaped}(?=$|[^a-z0-9_+#])`, 'gi');
  const matches = normText.match(rx);
  return matches ? matches.length : 0;
}

function findEntryInText(entry: TaxonomyEntry, text: string): { hit: boolean; form?: string; count: number } {
  const forms = getAllForms(entry);

  for (const form of forms) {
    const lower = form.toLowerCase();
    if (SINGLE_CHAR_LANGUAGES.has(lower)) {
      if (isValidSingleCharInText(lower, text)) {
        return { hit: true, form, count: Math.max(1, countOccurrences(lower, text)) };
      }
      continue;
    }

    if (containsSkillPhrase(form, text)) {
      return { hit: true, form, count: Math.max(1, countOccurrences(form, text)) };
    }
  }

  return { hit: false, count: 0 };
}

function buildActionGuidance(match: SkillMatch): ActionItem {
  const priority: ActionItem['priority'] =
    match.dimension === 'core_tech' || match.dimension === 'tools_infra'
      ? 'critical'
      : match.dimension === 'experience' || match.dimension === 'credentials'
        ? 'recommended'
        : 'optional';

  const templates: Record<SkillDimension, string> = {
    core_tech: `Add hands-on evidence of ${match.term} in your skills or project bullets (only if you have used it).`,
    tools_infra: `List ${match.term} explicitly under Tools / Platforms where relevant.`,
    experience: `Highlight ${match.term} context in your experience bullets with concrete outcomes.`,
    credentials: `Ensure ${match.term} is clearly stated in your Education or Certifications section.`,
    soft_skills: `Show ${match.term} through a measurable team or project result.`,
  };

  return {
    id: `act_${match.dimension}_${match.term.toLowerCase().replace(/\W+/g, '_')}`,
    priority,
    dimension: match.dimension,
    term: match.term,
    guidance: templates[match.dimension],
  };
}

function scoreToGrade(score: number): FitGrade {
  if (score >= 78) return 'strong';
  if (score >= 58) return 'good';
  if (score >= 38) return 'partial';
  return 'low';
}

export function evaluateFit(resume: ResumeProfile, job: JobPosting): FitReport {
  const detected: SkillMatch[] = [];

  for (const entry of SKILL_TAXONOMY) {
    const jdHit = findEntryInText(entry, job.description);
    if (!jdHit.hit) continue;

    const resumeHit = findEntryInText(entry, resume.text);
    const meta = DIMENSION_META[entry.dimension];

    detected.push({
      term: entry.canonical,
      dimension: entry.dimension,
      weight: meta.weight,
      matched: resumeHit.hit,
      matchedVia: resumeHit.form,
      occurrences: jdHit.count,
    });
  }

  let matchedWeight = 0;
  let totalWeight = 0;
  const groups = new Map<SkillDimension, { matched: number; total: number }>();

  for (const item of detected) {
    const g = groups.get(item.dimension) ?? { matched: 0, total: 0 };
    g.total += 1;
    if (item.matched) {
      g.matched += 1;
      matchedWeight += item.weight;
    }
    totalWeight += item.weight;
    groups.set(item.dimension, g);
  }

  const score = totalWeight > 0 ? Math.min(100, Math.max(0, Math.round((matchedWeight / totalWeight) * 100))) : 0;

  const dimensions: DimensionStat[] = [];
  for (const [dimension, counts] of groups) {
    const meta = DIMENSION_META[dimension];
    dimensions.push({
      dimension,
      label: meta.label,
      matched: counts.matched,
      total: counts.total,
      percentage: counts.total > 0 ? Math.round((counts.matched / counts.total) * 100) : 0,
      weight: meta.weight,
    });
  }
  dimensions.sort((a, b) => b.weight - a.weight);

  const matchedSkills = detected
    .filter((s) => s.matched)
    .sort((a, b) => b.weight - a.weight || b.occurrences - a.occurrences);

  const missingSkills = detected
    .filter((s) => !s.matched)
    .sort((a, b) => b.weight - a.weight || b.occurrences - a.occurrences);

  const actions = missingSkills.slice(0, 10).map(buildActionGuidance);

  return {
    id: `rf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    score,
    grade: scoreToGrade(score),
    resumeId: resume.id,
    resumeName: resume.fileName,
    jobTitle: job.title || 'Untitled Position',
    jobUrl: job.url,
    platform: job.platform,
    matchedSkills,
    missingSkills,
    dimensions,
    actions,
    analyzedAt: Date.now(),
  };
}
