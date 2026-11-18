import { isInjectableTabUrl } from '../core/security';
import type { JobPosting } from '../core/types';

interface ScanTabRequest {
  type: 'ROLEFIT_SCAN_ACTIVE_TAB';
}

interface ScanTabResponse {
  ok: boolean;
  job?: JobPosting;
  error?: string;
}

// Restrict session storage strictly to trusted extension pages (never content scripts)
async function lockSessionStorageAccess(): Promise<void> {
  try {
    if (chrome.storage.session?.setAccessLevel) {
      await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
    }
  } catch {
    // Ignore on browsers that do not support setAccessLevel
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void lockSessionStorageAccess();
});

chrome.runtime.onStartup.addListener(() => {
  void lockSessionStorageAccess();
});

function isAuthorizedPopupSender(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id) return false;
  if (sender.tab) return false;
  const popupPrefix = chrome.runtime.getURL('popup.html');
  return typeof sender.url === 'string' && sender.url.startsWith(popupPrefix);
}

async function scanActiveTab(): Promise<ScanTabResponse> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !tab.url) {
    return { ok: false, error: 'No active browser tab found.' };
  }

  if (!isInjectableTabUrl(tab.url)) {
    return {
      ok: false,
      error: 'Cannot scan browser system pages. Open a job posting or use Paste JD.',
    };
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });
  } catch {
    return {
      ok: false,
      error: 'Unable to access this page. Try reloading the tab or pasting the job description manually.',
    };
  }

  return new Promise<ScanTabResponse>((resolve) => {
    chrome.tabs.sendMessage(tab.id!, { type: 'ROLEFIT_EXTRACT_DOM' }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({
          ok: false,
          error: 'Could not read the page content. Use Paste JD for this site.',
        });
        return;
      }
      if (response && response.ok && response.job) {
        resolve({ ok: true, job: response.job as JobPosting });
      } else {
        resolve({
          ok: false,
          error: (response?.error as string | undefined) || 'No job description found on this page.',
        });
      }
    });
  });
}

chrome.runtime.onMessage.addListener(
  (message: ScanTabRequest, sender, sendResponse: (res: ScanTabResponse) => void) => {
    if (!isAuthorizedPopupSender(sender)) {
      return false;
    }

    if (message?.type === 'ROLEFIT_SCAN_ACTIVE_TAB') {
      void scanActiveTab()
        .then(sendResponse)
        .catch(() => sendResponse({ ok: false, error: 'Unexpected error scanning active tab.' }));
      return true;
    }

    return false;
  },
);
