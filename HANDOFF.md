# HANDOFF.md - For AI Continuity

Last updated: 2026-07-01

## Current State of Repository

This repository was bootstrapped by an AI coding assistant. There are known missing pieces, incomplete implementations, and intentional TODOs. This document explains exactly what was done, what is broken, and what must be completed.

## What Has Been Completed

1. **Repository Layout**
   - `manifest.json` (MV2 for Firefox, MV3 placeholder notes in AGENTS.md)
   - `src/background.js` - skeletal message router with settings fetching
   - `src/content.js` - comprehensive Facebook detector + subtitle synchronizer with AI, browser SpeechRecognition, Deepgram, and AssemblyAI paths
   - `src/stt.js` - module with transcription, VTT parsing, audio extraction, WAV conversion
   - `src/content.css` - overlay styles
   - `src/popup.html/css/js` - basic popup UI
   - `src/options.html/css/js` - comprehensive options page
   - Icons generated via script (`scripts/generate-icons.js`): placeholder solid-color PNGs
   - Build scripts (`scripts/build.js`, `scripts/zip.js`)
   - Docs: `AGENTS.md`, `README.md`, `CONTRIBUTING.md`

2. **Functional Paths Implemented**
   - `content.js`
     - MutationObserver to detect videos
     - Overlay container injection
     - `captureAudio()` via AudioContext+MediaRecorder
     - AI transcription orchestration
     - Browser STT fallback
     - Waveform-to-VTT alignment

## What Is NOT Working / Needs Implementation

### Critical: `stt.js` module export issue
The source code in `stt.js` uses ESM-style `export` but Firefox content scripts expect plain JS.
- **Fix:** Convert to UMD/CJS via Build step (rollup or esbuild) OR inline the entire module into `content.js`.
- **Recommended:** Use `rollup` or `esbuild` to bundle `stt.js` into `content.js` as part of `build.js`.

### Critical: `content.js` incompleteness
- The `timeupdate` / `check` listener is incomplete: the check listener is never removed, causing a memory leak. Fix with a reusable `timeupdate` handler that unsubscribes.
- SpeechRecognition fallback only captures the last 5 seconds. Implement continuous audio chunking or a proper buffer if audio capture fails.
- FB class names like `x1lliihq ._5r51` change. Maintain a selector matrix and add retry logic.
- CORS / m3u8 support: If the video element uses HLS, DOMContentLoaded is never fired so `captureStream()` may fail. Add a `play` event handler to await `seekable` state and try mse.

### Important: Translation Step Not Implemented
- `content.js` and `content.css` have translate-enabled logic but no translation service.
- Add `translation.js` with OpenAI-compatible client.
- Subtitles should be fetched via cache, translated per cue, and re-rendered.

### Important: AssemblyAI Upload Flow
- current stt.js uploads, polls, then expects `result.vtt`. AssemblyAI does NOT return VTT by default. We must request `auto_highlights`, then convert word-level timestamps to VTT manually.

### Important: Options CSS Missing
- Current `options.css` is empty. Need complete stylesheet.

### Medium: No lint/typecheck config
- Missing `.eslintrc`, `jest.config.js`, and `prettierrc`. Add minimal configs.

### Medium: Popup UI incomplete
- Popup currently only shows buttons but doesn't actually have subtitle download service.

### Low: Manifest v3 notes
- AGENTS.md mentions MV3 migration. Do not implement unless asked.

## What Was Deliberately Omitted

1. Icons are placeholders - replace with actual artwork.
2. Store listings and README marketing copy - add in later releases.
3. Offscreen document for MV3 - not relevant until migration.
4. SRT export function - add if required by users.
5. Multi-language UI - the repo is monolingual English-first.

## Suggested Next Implementation Order

1. Add `rollup` or inline `stt.js` into `content.js`.
2. Add `translation.js` with OpenAI-compatible translation client.
3. Complete AssemblyAI adapter in `stt.js`.
4. Fix Firefox content script export issue.
5. Update `options.css` with full styling.
6. Add ESLint + Jest config.
7. Refactor FB selectors into a maintained array with fallback strategies.
8. Add MV3 notes branch.

## Build & Push Already Done (or Pending)

- Repo URL: https://github.com/NaievetestV2/Facebook-Subtitles
- Git initialization instructions are at the bottom of this doc.
- **If gh is installed and authenticated**, run the bash commands below.

## Recommended Immediate Actions

```bash
cd /home/naievetest/Documents/projs/EXTENSION
# Install dependencies
npm install

# Initialize git and push
git init
git add -A
git commit -m "chore: bootstrap extension with core stt and content script"
git branch -M main
git remote add origin https://github.com/NaievetestV2/Facebook-Subtitles.git
git push -u origin main
```

## File Purpose Reference

| File | Purpose |
|------|---------|
| manifest.json | Extension manifest (MV2 for Firefox) |
| src/content.js | Page-level video detection + overlay |
| src/content.css | Subtitle overlay styles |
| src/stt.js | Transcription + VTT parsing + audio extraction |
| src/background.js | Message broker between popup/content |
| src/popup.html/css/js | Quick controls in toolbar |
| src/options.html/css/js | User preferences |
| scripts/build.js | Copies source to dist and zips |
| scripts/zip.js | Zip for AMO |
| AGENTS.md | AI continuation policy + architecture notes |
| CONTRIBUTING.md | Contributor guidelines |
| README.md | User-facing readme |

## AI Continuity Checklist

- [ ] Resolve ESM/UMD issue in stt.js (bundling required).
- [ ] Implement translation module and wire it to overlay.
- [ ] Fix AssemblyAI response parsing.
- [ ] Add error boundaries and graceful fallbacks.
- [ ] Add per-cue caching to avoid re-transcribing.
- [ ] Write Jest tests for VTT parser.
- [ ] Add ESLint config.
- [ ] Populate `options.css` with full styles.
- [ ] Replace placeholder icons.
- [ ] Ensure mobile (Firefox for Android) overlay uses touch-safe margins.

## Contact / Ownership

Maintainer: NaievetestV2
Repo: https://github.com/NaievetestV2/Facebook-Subtitles
License: MIT

## If the Original AI Is Gone

This document and `AGENTS.md` together contain everything needed. Start with the checkbox list above and continue by implementing missing pieces in the order listed.
