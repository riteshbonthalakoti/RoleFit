import type { ExtensionSettings, FitReport, ResumeProfile } from './types';

const KEYS = {
  RESUMES: 'rf_resumes_v1',
  ACTIVE_RESUME: 'rf_active_resume_v1',
  HISTORY: 'rf_history_v1',
  SETTINGS: 'rf_settings_v1',
  SESSION_RESUMES: 'rf_session_resumes_v1',
  SESSION_ACTIVE: 'rf_session_active_v1',
  SESSION_REPORT: 'rf_active_report_v1',
} as const;

const MAX_PROFILES = 5;
const MAX_HISTORY = 12;

const DEFAULT_SETTINGS: ExtensionSettings = {
  theme: 'dark',
  privateSessionMode: false,
};

function getSessionArea(): chrome.storage.StorageArea {
  return chrome.storage.session ?? chrome.storage.local;
}

export async function loadSettings(): Promise<ExtensionSettings> {
  const res = await chrome.storage.local.get(KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(res[KEYS.SETTINGS] as Partial<ExtensionSettings> | undefined) };
}

export async function saveSettings(partial: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const next = { ...(await loadSettings()), ...partial };
  await chrome.storage.local.set({ [KEYS.SETTINGS]: next });
  return next;
}

export async function loadResumeState(privateSessionMode: boolean): Promise<{
  profiles: ResumeProfile[];
  activeId: string | null;
}> {
  if (privateSessionMode) {
    const area = getSessionArea();
    const res = await area.get([KEYS.SESSION_RESUMES, KEYS.SESSION_ACTIVE]);
    const profiles: ResumeProfile[] = Array.isArray(res[KEYS.SESSION_RESUMES])
      ? (res[KEYS.SESSION_RESUMES] as ResumeProfile[])
      : [];
    const rawActive = res[KEYS.SESSION_ACTIVE];
    const activeId: string | null =
      typeof rawActive === 'string' && profiles.some((p) => p.id === rawActive)
        ? rawActive
        : profiles[0]?.id ?? null;
    return { profiles, activeId };
  }

  const res = await chrome.storage.local.get([KEYS.RESUMES, KEYS.ACTIVE_RESUME]);
  const profiles: ResumeProfile[] = Array.isArray(res[KEYS.RESUMES])
    ? (res[KEYS.RESUMES] as ResumeProfile[])
    : [];
  const rawActive = res[KEYS.ACTIVE_RESUME];
  const activeId: string | null =
    typeof rawActive === 'string' && profiles.some((p) => p.id === rawActive)
      ? rawActive
      : profiles[0]?.id ?? null;
  return { profiles, activeId };
}

export async function upsertResumeProfile(
  profile: ResumeProfile,
  privateSessionMode: boolean,
): Promise<{ profiles: ResumeProfile[]; activeId: string }> {
  const current = await loadResumeState(privateSessionMode);
  const entry: ResumeProfile = { ...profile, ephemeral: privateSessionMode };
  const deduped = current.profiles.filter(
    (p) => p.fileName.toLowerCase() !== entry.fileName.toLowerCase(),
  );
  const profiles = [entry, ...deduped].slice(0, MAX_PROFILES);

  if (privateSessionMode) {
    const area = getSessionArea();
    await area.set({
      [KEYS.SESSION_RESUMES]: profiles,
      [KEYS.SESSION_ACTIVE]: entry.id,
    });
  } else {
    await chrome.storage.local.set({
      [KEYS.RESUMES]: profiles,
      [KEYS.ACTIVE_RESUME]: entry.id,
    });
  }

  return { profiles, activeId: entry.id };
}

export async function selectActiveResume(
  id: string,
  privateSessionMode: boolean,
): Promise<{ profiles: ResumeProfile[]; activeId: string | null }> {
  const current = await loadResumeState(privateSessionMode);
  if (!current.profiles.some((p) => p.id === id)) return current;

  if (privateSessionMode) {
    await getSessionArea().set({ [KEYS.SESSION_ACTIVE]: id });
  } else {
    await chrome.storage.local.set({ [KEYS.ACTIVE_RESUME]: id });
  }
  return { profiles: current.profiles, activeId: id };
}

export async function removeResumeProfile(
  id: string,
  privateSessionMode: boolean,
): Promise<{ profiles: ResumeProfile[]; activeId: string | null }> {
  const current = await loadResumeState(privateSessionMode);
  const profiles = current.profiles.filter((p) => p.id !== id);
  const activeId = current.activeId === id ? profiles[0]?.id ?? null : current.activeId;

  if (privateSessionMode) {
    await getSessionArea().set({
      [KEYS.SESSION_RESUMES]: profiles,
      [KEYS.SESSION_ACTIVE]: activeId,
    });
  } else {
    await chrome.storage.local.set({
      [KEYS.RESUMES]: profiles,
      [KEYS.ACTIVE_RESUME]: activeId,
    });
  }
  return { profiles, activeId };
}

export async function loadHistory(): Promise<FitReport[]> {
  const res = await chrome.storage.local.get(KEYS.HISTORY);
  return Array.isArray(res[KEYS.HISTORY]) ? (res[KEYS.HISTORY] as FitReport[]) : [];
}

export async function recordReport(report: FitReport, privateSessionMode: boolean): Promise<FitReport[]> {
  // Always keep active report in session storage (RAM) for opening report.html
  await getSessionArea().set({ [KEYS.SESSION_REPORT]: report });

  if (privateSessionMode) {
    return loadHistory();
  }

  const existing = await loadHistory();
  const filtered = existing.filter(
    (item) => !(item.jobTitle === report.jobTitle && item.resumeId === report.resumeId),
  );
  const next = [report, ...filtered].slice(0, MAX_HISTORY);
  await chrome.storage.local.set({ [KEYS.HISTORY]: next });
  return next;
}

export async function setActiveReportForTab(report: FitReport): Promise<void> {
  await getSessionArea().set({ [KEYS.SESSION_REPORT]: report });
}

export async function loadActiveReportForTab(): Promise<FitReport | null> {
  const res = await getSessionArea().get(KEYS.SESSION_REPORT);
  return (res[KEYS.SESSION_REPORT] as FitReport | undefined) ?? null;
}

export async function clearAllUserData(): Promise<void> {
  await chrome.storage.local.remove([
    KEYS.RESUMES,
    KEYS.ACTIVE_RESUME,
    KEYS.HISTORY,
  ]);
  if (chrome.storage.session) {
    await chrome.storage.session.clear();
  }
}
