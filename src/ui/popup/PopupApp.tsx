import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { evaluateFit } from '../../core/engine/evaluator';
import { parseResumeFile } from '../../core/parsers';
import {
  clearAllUserData,
  loadHistory,
  loadResumeState,
  loadSettings,
  recordReport,
  removeResumeProfile,
  saveSettings,
  selectActiveResume,
  setActiveReportForTab,
  upsertResumeProfile,
} from '../../core/storage';
import type {
  ExtensionSettings,
  FitReport,
  JobPosting,
  ResumeProfile,
  SkillDimension,
} from '../../core/types';
import { BrandMark } from '../components/BrandMark';
import { RadialGauge } from '../components/RadialGauge';

type ActiveTab = 'overview' | 'keywords' | 'profiles';

export const PopupApp: React.FC = () => {
  const [settings, setSettings] = useState<ExtensionSettings>({
    theme: 'dark',
    privateSessionMode: false,
  });
  const [profiles, setProfiles] = useState<ResumeProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [job, setJob] = useState<JobPosting | null>(null);
  const [report, setReport] = useState<FitReport | null>(null);
  const [history, setHistory] = useState<FitReport[]>([]);

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualBody, setManualBody] = useState('');

  // Keywords tab filters
  const [kwStatus, setKwStatus] = useState<'all' | 'missing' | 'matched'>('all');
  const [kwDimension, setKwDimension] = useState<'all' | SkillDimension>('all');
  const [kwSearch, setKwSearch] = useState('');
  const [copiedMissing, setCopiedMissing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) ?? profiles[0] ?? null,
    [profiles, activeProfileId],
  );

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  const scanCurrentTab = useCallback(async () => {
    setScanning(true);
    setScanError(null);
    try {
      const response = await new Promise<{ ok: boolean; job?: JobPosting; error?: string }>((resolve) => {
        chrome.runtime.sendMessage({ type: 'ROLEFIT_SCAN_ACTIVE_TAB' }, (resp) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(resp ?? { ok: false, error: 'No response from extension worker.' });
          }
        });
      });

      if (response.ok && response.job) {
        setJob(response.job);
        setPasteOpen(false);
      } else {
        setJob(null);
        setScanError(response.error || 'No job description detected on this page.');
      }
    } catch {
      setJob(null);
      setScanError('Could not scan this tab.');
    } finally {
      setScanning(false);
    }
  }, []);

  // Initial hydration
  useEffect(() => {
    void (async () => {
      const loadedSettings = await loadSettings();
      setSettings(loadedSettings);

      const resumeState = await loadResumeState(loadedSettings.privateSessionMode);
      setProfiles(resumeState.profiles);
      setActiveProfileId(resumeState.activeId);

      const loadedHistory = await loadHistory();
      setHistory(loadedHistory);

      await scanCurrentTab();
    })();
  }, [scanCurrentTab]);

  // Re-evaluate automatically when active profile or job posting changes
  useEffect(() => {
    if (!activeProfile || !job) return;
    const nextReport = evaluateFit(activeProfile, job);
    setReport(nextReport);
    void recordReport(nextReport, settings.privateSessionMode).then(setHistory);
  }, [activeProfile, job, settings.privateSessionMode]);

  const handleToggleTheme = async () => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    const updated = await saveSettings({ theme: nextTheme });
    setSettings(updated);
  };

  const handleTogglePrivateSession = async () => {
    const nextMode = !settings.privateSessionMode;
    const updated = await saveSettings({ privateSessionMode: nextMode });
    setSettings(updated);
    const resumeState = await loadResumeState(nextMode);
    setProfiles(resumeState.profiles);
    setActiveProfileId(resumeState.activeId);
    setReport(null);
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    try {
      const parsed = await parseResumeFile(file);
      const profile: ResumeProfile = {
        id: `prof_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label: file.name.replace(/\.[^.]+$/, '').slice(0, 32),
        fileName: file.name,
        format: parsed.format,
        text: parsed.text,
        wordCount: parsed.wordCount,
        createdAt: Date.now(),
      };
      const updated = await upsertResumeProfile(profile, settings.privateSessionMode);
      setProfiles(updated.profiles);
      setActiveProfileId(updated.activeId);
      setActiveTab('overview');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to parse resume file.');
    } finally {
      setUploading(false);
    }
  };

  const handleSelectProfile = async (id: string) => {
    const updated = await selectActiveResume(id, settings.privateSessionMode);
    setProfiles(updated.profiles);
    setActiveProfileId(updated.activeId);
  };

  const handleDeleteProfile = async (id: string) => {
    const updated = await removeResumeProfile(id, settings.privateSessionMode);
    setProfiles(updated.profiles);
    setActiveProfileId(updated.activeId);
    if (updated.profiles.length === 0) setReport(null);
  };

  const handleClearAll = async () => {
    await clearAllUserData();
    setProfiles([]);
    setActiveProfileId(null);
    setHistory([]);
    setReport(null);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualBody.trim().length < 40) return;
    setJob({
      title: manualTitle.trim() || 'Pasted Job Description',
      description: manualBody.trim(),
      url: '',
      platform: 'manual',
      capturedAt: Date.now(),
    });
    setPasteOpen(false);
    setScanError(null);
    setActiveTab('overview');
  };

  const handleOpenFullReport = async () => {
    if (!report) return;
    await setActiveReportForTab(report);
    chrome.tabs.create({ url: chrome.runtime.getURL('report.html') });
  };

  const handleCopyMissing = async () => {
    if (!report || report.missingSkills.length === 0) return;
    const csv = report.missingSkills.map((s) => s.term).join(', ');
    await navigator.clipboard.writeText(csv);
    setCopiedMissing(true);
    setTimeout(() => setCopiedMissing(false), 1800);
  };

  const filteredSkills = useMemo(() => {
    if (!report) return [];
    const combined =
      kwStatus === 'missing'
        ? report.missingSkills
        : kwStatus === 'matched'
          ? report.matchedSkills
          : [...report.missingSkills, ...report.matchedSkills];

    return combined.filter((item) => {
      if (kwDimension !== 'all' && item.dimension !== kwDimension) return false;
      if (kwSearch.trim() && !item.term.toLowerCase().includes(kwSearch.trim().toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [report, kwStatus, kwDimension, kwSearch]);

  return (
    <div className="flex min-h-[540px] w-[420px] flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Top Command Bar */}
      <header className="flex items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex items-center gap-2.5">
          <BrandMark size={30} />
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-bold tracking-tight">RoleFit</h1>
              {settings.privateSessionMode && (
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-300">
                  RAM Only
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              100% Local ATS Skill Matcher
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-emerald-500/50 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-emerald-400"
            title="Upload a PDF, DOCX, or TXT resume"
          >
            {uploading ? 'Parsing...' : activeProfile ? '+ Resume' : 'Upload Resume'}
          </button>
          <button
            onClick={handleToggleTheme}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            title="Toggle theme"
          >
            {settings.theme === 'dark' ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Active Job Context Bar */}
      <div className="border-b border-slate-200/80 bg-slate-100/70 px-4 py-2 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            {scanning ? (
              <p className="text-xs text-slate-500">Scanning current tab...</p>
            ) : job ? (
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500" />
                <p className="truncate text-xs font-semibold">{job.title}</p>
                <span className="flex-shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {job.platform}
                </span>
              </div>
            ) : (
              <p className="truncate text-xs text-amber-600 dark:text-amber-400">
                {scanError || 'Open a job posting or paste a JD'}
              </p>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <button
              onClick={() => void scanCurrentTab()}
              disabled={scanning}
              className="rounded px-2 py-0.5 text-[10px] font-medium text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
            >
              Re-scan
            </button>
            <button
              onClick={() => setPasteOpen((v) => !v)}
              className="rounded px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {pasteOpen ? 'Close' : 'Paste JD'}
            </button>
          </div>
        </div>

        {pasteOpen && (
          <form onSubmit={handleManualSubmit} className="mt-2 space-y-2 border-t border-slate-200 pt-2 dark:border-slate-800">
            <input
              type="text"
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              placeholder="Role title (optional, e.g. Embedded Systems Engineer)"
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900"
            />
            <textarea
              rows={4}
              value={manualBody}
              onChange={(e) => setManualBody(e.target.value)}
              placeholder="Paste the full job description here (min 40 chars)..."
              className="w-full resize-none rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900"
            />
            <button
              type="submit"
              disabled={manualBody.trim().length < 40}
              className="w-full rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40"
            >
              Analyze Pasted Description
            </button>
          </form>
        )}
      </div>

      {/* 3-Tab Workspace Bar */}
      <nav className="grid grid-cols-3 border-b border-slate-200 bg-white px-2 pt-1.5 dark:border-slate-800 dark:bg-slate-900">
        {(
          [
            ['overview', 'Overview'],
            ['keywords', report ? `Skills (${report.matchedSkills.length}/${report.matchedSkills.length + report.missingSkills.length})` : 'Skills'],
            ['profiles', `Profiles (${profiles.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`border-b-2 pb-2 text-xs font-semibold transition ${
              activeTab === key
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Main Content Scroll Area */}
      <main className="max-h-[410px] flex-1 overflow-y-auto p-4">
        {uploadError && (
          <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
            {uploadError}
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-3.5">
            {!activeProfile ? (
              <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900/60">
                <p className="text-sm font-semibold">Drop your resume to compute RoleFit</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  PDF, DOCX, or TXT. Parsed locally with magic-byte &amp; ZIP-bomb checks.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500"
                >
                  Choose Resume File
                </button>
              </div>
            ) : !report ? (
              <div className="rounded-xl border border-slate-200 bg-white p-5 text-center dark:border-slate-800 dark:bg-slate-900">
                <p className="text-sm font-semibold">Resume ready: {activeProfile.fileName}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Navigate to a job posting and click <strong>Re-scan</strong>, or click <strong>Paste JD</strong> above.
                </p>
              </div>
            ) : (
              <>
                {/* Bento Score Hero */}
                <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                  <RadialGauge score={report.score} grade={report.grade} />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Profile: <span className="font-semibold text-slate-700 dark:text-slate-200">{report.resumeName}</span>
                    </div>
                    <div className="space-y-1.5">
                      {report.dimensions.map((dim) => (
                        <div key={dim.dimension}>
                          <div className="flex justify-between text-[10px]">
                            <span className="font-medium text-slate-600 dark:text-slate-300">{dim.label}</span>
                            <span className="tabular-nums text-slate-500">
                              {dim.matched}/{dim.total}
                            </span>
                          </div>
                          <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-300"
                              style={{ width: `${dim.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Top Priority Gaps */}
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-xs font-semibold">Top Priority Gaps</h2>
                    {report.missingSkills.length > 0 && (
                      <button
                        onClick={handleCopyMissing}
                        className="text-[10px] font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                      >
                        {copiedMissing ? 'Copied!' : 'Copy missing list'}
                      </button>
                    )}
                  </div>
                  {report.missingSkills.length === 0 ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      Strong coverage — every extracted JD skill appeared in your resume.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {report.missingSkills.slice(0, 8).map((skill) => (
                          <span
                            key={skill.term}
                            className="rounded-md border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:text-rose-300"
                          >
                            {skill.term}
                          </span>
                        ))}
                      </div>
                      {report.actions.slice(0, 3).map((act) => (
                        <p key={act.id} className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                          • {act.guidance}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleOpenFullReport}
                  className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 py-2 text-xs font-semibold text-white shadow-sm transition hover:from-emerald-500 hover:to-cyan-500"
                >
                  Open Executive Report &amp; Export
                </button>
              </>
            )}
          </div>
        )}

        {/* TAB 2: KEYWORDS MATRIX */}
        {activeTab === 'keywords' && (
          <div className="space-y-3">
            {!report ? (
              <p className="py-8 text-center text-xs text-slate-500">
                Run a scan first to inspect extracted skills.
              </p>
            ) : (
              <>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={kwSearch}
                    onChange={(e) => setKwSearch(e.target.value)}
                    placeholder="Filter skills..."
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900"
                  />
                  <select
                    value={kwDimension}
                    onChange={(e) => setKwDimension(e.target.value as 'all' | SkillDimension)}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="all">All Areas</option>
                    <option value="core_tech">Core Tech</option>
                    <option value="tools_infra">Tools</option>
                    <option value="experience">Role</option>
                    <option value="credentials">Education</option>
                    <option value="soft_skills">Soft Skills</option>
                  </select>
                </div>

                <div className="flex gap-1">
                  {(['all', 'missing', 'matched'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setKwStatus(status)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-medium capitalize ${
                        kwStatus === status
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  {filteredSkills.length === 0 ? (
                    <p className="py-4 text-center text-xs text-slate-500">No skills match your filter.</p>
                  ) : (
                    filteredSkills.map((item) => (
                      <div
                        key={item.term}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div>
                          <span className="text-xs font-semibold">{item.term}</span>
                          {item.matchedVia && item.matchedVia.toLowerCase() !== item.term.toLowerCase() && (
                            <span className="ml-1.5 text-[10px] text-slate-400">
                              via {item.matchedVia}
                            </span>
                          )}
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            item.matched
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                              : 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
                          }`}
                        >
                          {item.matched ? 'Matched' : 'Missing'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3: PROFILES & PRIVACY */}
        {activeTab === 'profiles' && (
          <div className="space-y-3.5">
            {/* Resume Profiles */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xs font-semibold">Saved Resume Profiles (max 5)</h2>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  + Upload
                </button>
              </div>
              {profiles.length === 0 ? (
                <p className="text-xs text-slate-500">No resumes loaded yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {profiles.map((prof) => {
                    const isActive = prof.id === activeProfile?.id;
                    return (
                      <div
                        key={prof.id}
                        className={`flex items-center justify-between rounded-lg border px-2.5 py-2 ${
                          isActive
                            ? 'border-emerald-500/50 bg-emerald-500/10'
                            : 'border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <button
                          onClick={() => void handleSelectProfile(prof.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-xs font-semibold">{prof.fileName}</p>
                          <p className="text-[10px] text-slate-500">
                            {prof.format.toUpperCase()} · {prof.wordCount} words
                          </p>
                        </button>
                        <button
                          onClick={() => void handleDeleteProfile(prof.id)}
                          className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium text-rose-500 hover:bg-rose-500/10"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Privacy Controls */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-2 text-xs font-semibold">Privacy &amp; Data Controls</h2>
              <label className="flex cursor-pointer items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium">Private Session Mode (RAM Only)</p>
                  <p className="text-[10px] text-slate-500">
                    Keep resumes in browser session memory only — auto-wiped when Chrome closes.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.privateSessionMode}
                  onChange={() => void handleTogglePrivateSession()}
                  className="mt-1 h-4 w-4 accent-emerald-600"
                />
              </label>

              <button
                onClick={() => void handleClearAll()}
                className="mt-3 w-full rounded-lg border border-rose-500/30 bg-rose-500/10 py-1.5 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-300"
              >
                Clear All Local Resumes &amp; Scan History
              </button>
            </div>

            {/* Recent History */}
            {history.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="mb-2 text-xs font-semibold">Recent Scans</h2>
                <div className="space-y-1.5">
                  {history.slice(0, 5).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setReport(item);
                        setActiveTab('overview');
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <span className="truncate pr-2 text-xs">{item.jobTitle}</span>
                      <span className="flex-shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold tabular-nums dark:bg-slate-800">
                        {item.score}%
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2 text-[10px] text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        <span>Zero network calls · Local only</span>
        {report && (
          <button
            onClick={handleOpenFullReport}
            className="font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
          >
            Full Report →
          </button>
        )}
      </footer>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        onChange={handleFileSelected}
        className="hidden"
      />
    </div>
  );
};
