import type { JobPosting, JobSourcePlatform } from '../core/types';

/**
 * Self-contained on-demand DOM job extractor.
 * NOTE: Must NOT contain runtime ES imports because chrome.scripting.executeScript
 * evaluates content.js as a classic script, not an ES module.
 */
(() => {
  const win = globalThis as unknown as { __ROLEFIT_EXTRACTOR_READY__?: boolean };
  if (win.__ROLEFIT_EXTRACTOR_READY__) {
    return;
  }
  win.__ROLEFIT_EXTRACTOR_READY__ = true;

  const MAX_JD_CHARS = 80_000;

  interface BoardRule {
    platform: JobSourcePlatform;
    domains: string[];
    titleSelectors: string[];
    bodySelectors: string[];
  }

  function matchesDomain(hostname: string, domain: string): boolean {
    const h = hostname.toLowerCase().replace(/\.+$/, '');
    const d = domain.toLowerCase().replace(/^\.+|\.+$/g, '');
    return h === d || h.endsWith(`.${d}`);
  }

  const BOARD_RULES: BoardRule[] = [
    {
      platform: 'linkedin',
      domains: ['linkedin.com'],
      titleSelectors: [
        '.job-details-jobs-unified-top-card__job-title h1',
        '.jobs-unified-top-card__job-title',
        'h1.t-24',
        'h1',
      ],
      bodySelectors: [
        '.jobs-description-content__text',
        '.jobs-description__content',
        '#job-details',
        '.jobs-box__html-content',
      ],
    },
    {
      platform: 'eightfold',
      domains: ['jobs.nvidia.com', 'eightfold.ai'],
      titleSelectors: [
        'h1.position-title',
        '[data-test-id="position-title"]',
        'h1[class*="position-title"]',
        'h1',
        'h2',
      ],
      bodySelectors: [
        '[data-test-id="position-description"]',
        '.position-job-description',
        '[class*="position-job-description"]',
        '[class*="job-description"]',
        '.pcs-job-description',
        'main',
      ],
    },
    {
      platform: 'greenhouse',
      domains: ['greenhouse.io', 'greenhouse.com'],
      titleSelectors: ['.app-title', 'h1.heading', 'h1'],
      bodySelectors: ['#content', '.job-post-content', '[class*="job-description"]', '#app_body'],
    },
    {
      platform: 'lever',
      domains: ['lever.co'],
      titleSelectors: ['.posting-headline h2', 'h1', 'h2'],
      bodySelectors: ['.posting-page', '[data-qa="job-description"]', '.section-wrapper'],
    },
    {
      platform: 'workday',
      domains: ['myworkdayjobs.com', 'workday.com'],
      titleSelectors: ['[data-automation-id="jobPostingHeader"]', 'h2[data-automation-id*="title"]', 'h1'],
      bodySelectors: ['[data-automation-id="jobPostingDescription"]', 'main'],
    },
    {
      platform: 'indeed',
      domains: ['indeed.com'],
      titleSelectors: ['.jobsearch-JobInfoHeader-title', '[data-testid="jobsearch-JobInfoHeader-title"]', 'h1'],
      bodySelectors: ['#jobDescriptionText', '.jobsearch-jobDescriptionText'],
    },
    {
      platform: 'ashby',
      domains: ['ashbyhq.com'],
      titleSelectors: ['h1.ashby-job-posting-heading', 'h1'],
      bodySelectors: ['[class*="ashby-job-posting-brief-description"]', '[class*="job-posting-description"]', 'main'],
    },
    {
      platform: 'wellfound',
      domains: ['wellfound.com', 'angel.co'],
      titleSelectors: ['h1', '[data-test="JobDetailTitle"]'],
      bodySelectors: ['[data-test="JobDetailDescription"]', '[class*="styles_description"]', 'main'],
    },
    {
      platform: 'naukri',
      domains: ['naukri.com'],
      titleSelectors: ['h1[class*="jd-header-title"]', 'h1'],
      bodySelectors: ['[class*="job-desc-container"]', '[class*="JDC__dang-inner-html"]', '.job-desc'],
    },
    {
      platform: 'internshala',
      domains: ['internshala.com'],
      titleSelectors: ['.profile_on_detail_page', 'h1.heading_4_5', 'h1'],
      bodySelectors: ['.internship_details', '.detail_view', '#details_container'],
    },
  ];

  function cleanExtractedText(raw: string): string {
    return raw
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, MAX_JD_CHARS);
  }

  function queryFirstText(selectors: string[]): string {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      const text = el?.textContent?.trim();
      if (text && text.length > 1) {
        return text.replace(/\s+/g, ' ').slice(0, 180);
      }
    }
    return document.title.split('|')[0]?.split(' - ')[0]?.trim().slice(0, 180) || 'Job Posting';
  }

  function extractSafeElementText(el: Element): string {
    const raw = el instanceof HTMLElement ? el.innerText || el.textContent || '' : el.textContent || '';
    return cleanExtractedText(raw);
  }

  function detectJobOnCurrentPage(): JobPosting | null {
    const host = window.location.hostname.toLowerCase();

    for (const rule of BOARD_RULES) {
      if (!rule.domains.some((d) => matchesDomain(host, d))) continue;

      const title = queryFirstText(rule.titleSelectors);
      for (const sel of rule.bodySelectors) {
        const node = document.querySelector(sel);
        if (!node) continue;
        const description = extractSafeElementText(node);
        if (description.length >= 80) {
          return {
            title,
            description,
            url: window.location.href,
            platform: rule.platform,
            capturedAt: Date.now(),
          };
        }
      }
    }

    const genericSelectors = [
      '[itemprop="description"]',
      '[data-test-id*="description"]',
      '[data-testid*="description"]',
      '[class*="job-description"]',
      '[id*="job-description"]',
      'main',
      'article',
      '[role="main"]',
    ];

    const fallbackTitle = queryFirstText(['h1', 'h2']);
    for (const sel of genericSelectors) {
      const node = document.querySelector(sel);
      if (!node) continue;
      const description = extractSafeElementText(node);
      if (description.length >= 120) {
        return {
          title: fallbackTitle,
          description,
          url: window.location.href,
          platform: 'generic',
          capturedAt: Date.now(),
        };
      }
    }

    // Last-resort bounded visible body text for heavy JS SPAs
    if (document.body) {
      const bodyText = extractSafeElementText(document.body);
      if (bodyText.length >= 200) {
        return {
          title: fallbackTitle,
          description: bodyText,
          url: window.location.href,
          platform: 'generic',
          capturedAt: Date.now(),
        };
      }
    }

    return null;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) {
      return false;
    }
    if (message?.type === 'ROLEFIT_EXTRACT_DOM') {
      const job = detectJobOnCurrentPage();
      if (job) {
        sendResponse({ ok: true, job });
      } else {
        sendResponse({
          ok: false,
          error: 'Could not find a job description on this page. Try Paste JD.',
        });
      }
      return false;
    }
    return false;
  });
})();
