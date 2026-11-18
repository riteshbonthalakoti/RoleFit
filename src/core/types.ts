export type ResumeFileFormat = 'pdf' | 'docx' | 'txt';

export interface ResumeProfile {
  id: string;
  label: string;
  fileName: string;
  format: ResumeFileFormat;
  text: string;
  wordCount: number;
  createdAt: number;
  ephemeral?: boolean;
}

export type JobSourcePlatform =
  | 'linkedin'
  | 'greenhouse'
  | 'lever'
  | 'workday'
  | 'indeed'
  | 'ashby'
  | 'wellfound'
  | 'eightfold'
  | 'naukri'
  | 'internshala'
  | 'generic'
  | 'manual';

export interface JobPosting {
  title: string;
  company?: string;
  description: string;
  url: string;
  platform: JobSourcePlatform;
  capturedAt: number;
}

export type SkillDimension = 'core_tech' | 'tools_infra' | 'experience' | 'credentials' | 'soft_skills';

export interface SkillMatch {
  term: string;
  dimension: SkillDimension;
  weight: number;
  matched: boolean;
  matchedVia?: string;
  occurrences: number;
}

export interface DimensionStat {
  dimension: SkillDimension;
  label: string;
  matched: number;
  total: number;
  percentage: number;
  weight: number;
}

export interface ActionItem {
  id: string;
  priority: 'critical' | 'recommended' | 'optional';
  dimension: SkillDimension;
  term: string;
  guidance: string;
}

export type FitGrade = 'strong' | 'good' | 'partial' | 'low';

export interface FitReport {
  id: string;
  score: number;
  grade: FitGrade;
  resumeId: string;
  resumeName: string;
  jobTitle: string;
  jobUrl: string;
  platform: JobSourcePlatform;
  matchedSkills: SkillMatch[];
  missingSkills: SkillMatch[];
  dimensions: DimensionStat[];
  actions: ActionItem[];
  analyzedAt: number;
}

export interface ExtensionSettings {
  theme: 'light' | 'dark';
  privateSessionMode: boolean;
}

export const DIMENSION_META: Record<SkillDimension, { label: string; weight: number }> = {
  core_tech: { label: 'Core Technical', weight: 3.0 },
  tools_infra: { label: 'Tools & Platforms', weight: 2.8 },
  experience: { label: 'Role & Seniority', weight: 2.0 },
  credentials: { label: 'Education & Certs', weight: 1.8 },
  soft_skills: { label: 'Collaboration', weight: 1.0 },
};
