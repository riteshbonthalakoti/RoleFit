# RoleFit Privacy Policy

**Effective Date:** 2026-11-18

RoleFit is designed to operate **100% locally inside your browser**.

## 1. Data Processed Locally
- **Resume Files:** When you upload a PDF, DOCX, or TXT resume, RoleFit parses the text locally in your browser memory to extract matching skills.
- **Job Descriptions:** Only when you explicitly click the RoleFit toolbar icon (or paste a job description manually) does RoleFit read visible text from the active tab to compare against your resume.

## 2. Storage & Retention
- **Standard Mode:** Resume profiles (up to 5) and recent match summaries are stored locally in Chrome's `chrome.storage.local` on your device.
- **Private Session Mode (RAM Only):** When enabled, resumes are kept strictly in `chrome.storage.session` (trusted extension contexts only) and are automatically cleared when your browser closes.
- **Deletion:** You can delete individual profiles or wipe all local data in 1 click inside the **Profiles → Clear All Local Resumes & Scan History** section at any time, or by uninstalling the extension.

## 3. Zero External Transmission
- RoleFit makes **zero outbound network requests**.
- RoleFit does **not** collect, transmit, sell, rent, or share personal information, resumes, browsing history, or job URLs with any server or third party.
- RoleFit complies with the Chrome Web Store User Data Policy, including Limited Use requirements.

## 4. Permissions Rationale
- `activeTab` & `scripting`: Used strictly on-demand when you click RoleFit to extract job text from the currently active tab.
- `storage`: Used solely to keep your local resume profiles, theme preference, and recent scan history on your device.

## 5. Contact
For privacy questions or security reports, open an issue in the repository or see `SECURITY.md`.
