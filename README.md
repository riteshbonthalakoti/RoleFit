# RoleFit

**RoleFit** is a local-first Chrome Manifest V3 extension that scores how well your resume matches any job posting using transparent, word-boundary ATS matching — with zero external servers, zero broad host permissions, and zero tracking.

## Key Capabilities

- **Zero-Permission-Creep Security (MV3):** Uses only `activeTab`, `storage`, and `scripting` on-demand when you click the icon. Never requests `<all_urls>` or runs background scripts across your browsing sessions.
- **Hardened Client-Side File Parsing:** Supports PDF, DOCX, and TXT resumes with magic-byte validation, file-size and page caps, DOCX ZIP-bomb/path-traversal pre-flight inspection, and a locally bundled `pdf.worker.min.mjs`.
- **Precision Skill & Alias Engine:**
  - Strict word-boundary matching (prevents false positives like `JavaScript` matching `Java`, `algorithms` matching `Go`, or `alarm` matching `ARM`).
  - Full support for `C`, `C++`, `C#`, `R`, `.NET`, `CI/CD`, `TCP/IP`, and slash-separated lists (`C/C++`, `I2C/SPI/UART`, `PyTorch/TensorFlow`).
  - Bidirectional synonym resolution (`BLE` ↔ `Bluetooth Low Energy`, `K8s` ↔ `Kubernetes`, `ML` ↔ `Machine Learning`, `RTOS` ↔ `Real-Time Operating System`).
  - Curated skill taxonomy covering Software, Cloud/DevOps, AI/GPU Systems (`CUDA`, `TensorRT`, `Jetson Orin`, `ONNX`, `LLMs`), and Embedded/ECE/Hardware (`FreeRTOS`, `Zephyr`, `STM32`, `ESP32`, `BLE`, `Verilog`, `SystemVerilog`, `PCB`).
- **Multi-Profile & Private Session Mode:** Save up to 5 resume profiles and switch in 1 click, or enable **Private Session Mode (RAM Only)** so resumes live strictly in `chrome.storage.session` and auto-wipe when Chrome closes.
- **Supported Job Boards:** LinkedIn, Greenhouse, Lever, Workday, Indeed, Ashby, Wellfound, Naukri, Internshala, generic career pages, plus manual Paste JD mode.
- **Executive Report & Exports:** Split-column full-page report with 1-click **Copy Missing Skills**, **Export Markdown (`.md`)**, **Export JSON (`.json`)**, and **Print / PDF**.

## Local Development

```bash
npm install
npm run lint
npm test
npm run build
```

### Load in Chrome
1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select `dist/`
4. Pin **RoleFit** to your toolbar

### Package for Chrome Web Store
```bash
npm run package
```
Generates a deterministic `release/rolefit-v<version>-chrome.zip` and `release/SHA256SUMS.txt` after passing typecheck, build, and automated Manifest Policy verification (`scripts/verify-manifest.mjs`).

## Privacy & Security

- [Privacy Policy](./PRIVACY.md)
- [Security Policy](./SECURITY.md)

## License

MIT — see [LICENSE](./LICENSE).
