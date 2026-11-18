import React, { useEffect, useState } from 'react';
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
  const [copied, setCopied] = useState<'none' | 'missing' | 'md'>('none');

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

  const copyText = async (content: string, tag: 'missing' | 'md') => {
    await navigator.clipboard.writeText(content);
    setCopied(tag);
    setTimeout(() => setCopied('none'), 1800);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <BrandMark size={48} />
        <h1 className="text-xl font-bold">No Active Fit Report</h1>
        <p className="max-w-sm text-sm text-slate-500">
          Open the RoleFit popup on a job posting (or paste a JD) and run a scan to view a full report here.
        </p>
      </div>
    );
  }

  const safeJobUrl = sanitizeExternalUrl(report.jobUrl);
  const dateStamp = new Date(report.analyzedAt).toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Executive Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <BrandMark size={40} />
            <div>
              <h1 className="text-xl font-bold tracking-tight">RoleFit Executive Report</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {report.jobTitle} · Profile: {report.resumeName}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {report.missingSkills.length > 0 && (
              <button
                onClick={() =>
                  void copyText(report.missingSkills.map((s) => s.term).join(', '), 'missing')
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:border-emerald-500 dark:border-slate-700 dark:bg-slate-900"
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
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
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
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:border-emerald-500 dark:border-slate-700 dark:bg-slate-900"
            >
              Export JSON
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:border-emerald-500 dark:border-slate-700 dark:bg-slate-900"
            >
              Print / PDF
            </button>
          </div>
        </header>

        {/* Split-Column Executive Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Rail */}
          <aside className="space-y-5 lg:col-span-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
              <RadialGauge score={report.score} grade={report.grade} size={132} />
              <div className="mt-4 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                <p>
                  Matched <strong className="text-slate-800 dark:text-slate-100">{report.matchedSkills.length}</strong> of{' '}
                  <strong className="text-slate-800 dark:text-slate-100">
                    {report.matchedSkills.length + report.missingSkills.length}
                  </strong>{' '}
                  detected skills
                </p>
                <p>{new Date(report.analyzedAt).toLocaleString()}</p>
              </div>
              {safeJobUrl && (
                <a
                  href={safeJobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-block text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  Open Job Posting ↗
                </a>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 text-sm font-bold">Dimension Breakdown</h2>
              <div className="space-y-3">
                {report.dimensions.map((dim) => (
                  <div key={dim.dimension}>
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{dim.label}</span>
                      <span className="tabular-nums text-slate-500">
                        {dim.matched}/{dim.total} ({dim.percentage}%)
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                        style={{ width: `${dim.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Right Main Area */}
          <section className="space-y-5 lg:col-span-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 text-sm font-bold">Missing Skills ({report.missingSkills.length})</h2>
              {report.missingSkills.length === 0 ? (
                <p className="text-xs text-emerald-500">Every detected requirement in the JD was found in your resume.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {report.missingSkills.map((s) => (
                    <span
                      key={s.term}
                      className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-700 dark:text-rose-300"
                    >
                      {s.term}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 text-sm font-bold">Matched Skills ({report.matchedSkills.length})</h2>
              <div className="flex flex-wrap gap-2">
                {report.matchedSkills.map((s) => (
                  <span
                    key={s.term}
                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"
                  >
                    {s.term}
                    {s.matchedVia && s.matchedVia.toLowerCase() !== s.term.toLowerCase() ? ` (${s.matchedVia})` : ''}
                  </span>
                ))}
              </div>
            </div>

            {report.actions.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="mb-3 text-sm font-bold">Actionable Recommendations</h2>
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
