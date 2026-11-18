import React, { useEffect, useMemo, useState } from 'react';
import { sanitizeExternalUrl } from '../../core/security';
import { loadActiveReportForTab, loadSettings } from '../../core/storage';
import type { FitReport } from '../../core/types';
import { BrandMark } from '../components/BrandMark';
import { RadialGauge } from '../components/RadialGauge';

function buildMarkdown(report: FitReport): string {
  const safeUrl = sanitizeExternalUrl(report.jobUrl);
  const lines = [
    `# RoleFit Report — ${report.jobTitle}`,
    '',
    `- **Score:** ${report.score}/100 (${report.grade})`,
    `- **Resume Profile:** ${report.resumeName}`,
    `- **Platform:** ${report.platform}`,
    `- **Analyzed:** ${new Date(report.analyzedAt).toLocaleString()}`,
    ...(safeUrl ? [`- **Job URL:** ${safeUrl}`] : []),
    '',
    '## Category Breakdown',
    '| Dimension | Matched | Score |',
    '| --- | --- | --- |',
    ...report.dimensions.map((d) => `| ${d.label} | ${d.matched}/${d.total} | ${d.percentage}% |`),
    '',
    '## Missing Skills Checklist',
    ...(report.missingSkills.length === 0
      ? ['All detected JD skills matched!']
      : report.missingSkills.map((s) => `- [ ] **${s.term}** _(${s.dimension})_`)),
    '',
    '## Matched Skills',
    report.matchedSkills.map((s) => `\`${s.term}\``).join(', ') || '_None_',
    '',
    '## Priority Recommendations',
    ...report.actions.map((a) => `- **[${a.priority.toUpperCase()}]** ${a.guidance}`),
    '',
    '_Generated 100% locally by RoleFit._',
  ];
  return lines.join('\n');
}

export const ReportApp: React.FC = () => {
  const [report, setReport] = useState<FitReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<'none' | 'missing'>('none');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    void (async () => {
      const settings = await loadSettings();
      if (settings.theme === 'dark') {
        document.documentElement.classList.add('dark');
      }
      const active = await loadActiveReportForTab();
      setReport(active);
      setLoading(false);
    })();
  }, []);

  const triggerDownload = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyMissing = async (content: string) => {
    await navigator.clipboard.writeText(content);
    setCopied('missing');
    setTimeout(() => setCopied('none'), 1800);
  };

  const filteredMissing = useMemo(() => {
    if (!report) return [];
    const q = filter.trim().toLowerCase();
    return q ? report.missingSkills.filter((s) => s.term.toLowerCase().includes(q)) : report.missingSkills;
  }, [report, filter]);

  const filteredMatched = useMemo(() => {
    if (!report) return [];
    const q = filter.trim().toLowerCase();
    return q ? report.matchedSkills.filter((s) => s.term.toLowerCase().includes(q)) : report.matchedSkills;
  }, [report, filter]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rf-surface flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <BrandMark size={52} />
        <h1 className="text-xl font-bold">No Active Fit Report</h1>
        <p className="max-w-sm text-sm text-slate-500">
          Open the RoleFit popup on a job posting (or paste a JD) and run a scan to view a full report here.
        </p>
      </div>
    );
  }

  const safeJobUrl = sanitizeExternalUrl(report.jobUrl);
  const dateStamp = new Date(report.analyzedAt).toISOString().slice(0, 10);
  const totalSkills = report.matchedSkills.length + report.missingSkills.length;
  const aliasHits = report.matchedSkills.filter(
    (s) => s.matchedVia && s.matchedVia.toLowerCase() !== s.term.toLowerCase(),
  ).length;

  return (
    <div className="rf-surface min-h-screen px-6 py-8 text-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Executive Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
          <div className="flex items-center gap-3.5">
            <BrandMark size={44} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight">RoleFit Executive Report</h1>
                <span className="rounded-md border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {report.platform}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {report.jobTitle} · Profile: <strong className="text-slate-700 dark:text-slate-200">{report.resumeName}</strong>
              </p>
            </div>
          </div>

          <div className="no-print flex flex-wrap gap-2">
            {report.missingSkills.length > 0 && (
              <button
                onClick={() => void copyMissing(report.missingSkills.map((s) => s.term).join(', '))}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold transition hover:border-emerald-500 dark:border-slate-700 dark:bg-[#0E1627]"
              >
                {copied === 'missing' ? 'Copied Missing!' : 'Copy Missing Skills'}
              </button>
            )}
            <button
              onClick={() =>
                triggerDownload(
                  buildMarkdown(report),
                  `rolefit-${report.score}-${dateStamp}.md`,
                  'text/markdown',
                )
              }
              className="rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:from-emerald-500 hover:to-cyan-500"
            >
              Export Markdown
            </button>
            <button
              onClick={() =>
                triggerDownload(
                  JSON.stringify(report, null, 2),
                  `rolefit-${report.score}-${dateStamp}.json`,
                  'application/json',
                )
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold transition hover:border-emerald-500 dark:border-slate-700 dark:bg-[#0E1627]"
            >
              Export JSON
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold transition hover:border-emerald-500 dark:border-slate-700 dark:bg-[#0E1627]"
            >
              Print / PDF
            </button>
          </div>
        </header>

        {/* KPI Signal Strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Fit Score', value: `${report.score}%`, tone: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Skills Matched', value: `${report.matchedSkills.length} / ${totalSkills}`, tone: 'text-cyan-600 dark:text-cyan-400' },
            { label: 'Priority Gaps', value: `${report.missingSkills.length}`, tone: 'text-rose-600 dark:text-rose-400' },
            { label: 'Synonym Hits', value: `${aliasHits}`, tone: 'text-slate-700 dark:text-slate-200' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0E1627]"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{stat.label}</p>
              <p className={`mt-1 text-2xl font-extrabold tabular-nums ${stat.tone}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Split-Column Executive Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <aside className="space-y-5 lg:col-span-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-[#0E1627]">
              <RadialGauge score={report.score} grade={report.grade} size={136} />
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                {new Date(report.analyzedAt).toLocaleString()}
              </p>
              {safeJobUrl && (
                <a
                  href={safeJobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-print mt-3 inline-block text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  Open Job Posting ↗
                </a>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0E1627]">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Dimension Breakdown
              </h2>
              <div className="space-y-3">
                {report.dimensions.map((dim) => (
                  <div key={dim.dimension}>
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold">{dim.label}</span>
                      <span className="tabular-nums text-slate-500">
                        {dim.matched}/{dim.total} ({dim.percentage}%)
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400"
                        style={{ width: `${dim.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="space-y-5 lg:col-span-8">
            <div className="no-print">
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter skills across missing & matched..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-[#0E1627]"
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0E1627]">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Missing Skills ({filteredMissing.length})
              </h2>
              {filteredMissing.length === 0 ? (
                <p className="text-xs text-emerald-500">No missing skills matching current view.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {filteredMissing.map((s) => (
                    <span
                      key={s.term}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300"
                    >
                      {s.term}
                      {s.occurrences > 1 && <span className="text-[10px] opacity-70">×{s.occurrences}</span>}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0E1627]">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Matched Skills ({filteredMatched.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {filteredMatched.map((s) => (
                  <span
                    key={s.term}
                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                  >
                    {s.term}
                    {s.matchedVia && s.matchedVia.toLowerCase() !== s.term.toLowerCase() ? ` (${s.matchedVia})` : ''}
                  </span>
                ))}
              </div>
            </div>

            {report.actions.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0E1627]">
                <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Prioritized Recommendations
                </h2>
                <ul className="space-y-2.5">
                  {report.actions.map((act) => (
                    <li key={act.id} className="flex items-start gap-2.5 text-xs">
                      <span
                        className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          act.priority === 'critical'
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
                            : act.priority === 'recommended'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {act.priority}
                      </span>
                      <span className="leading-relaxed text-slate-700 dark:text-slate-300">{act.guidance}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>

        <footer className="border-t border-slate-200 pt-4 text-center text-xs text-slate-500 dark:border-slate-800">
          RoleFit runs 100% locally inside Chrome. Zero resume or job data ever leaves your device.
        </footer>
      </div>
    </div>
  );
};
