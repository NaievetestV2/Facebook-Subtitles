# AGENTS.md - Facebook Video Subtitles Extension

## Project Overview

Browser extension that automatically generates subtitles for Facebook videos (Reels, feeds) using AI or browser-based STT, overlays them on the video, and can translate subtitles in real-time.

## Supported Platforms

- Firefox (desktop) - primary target
- Firefox for Android
- Google Chrome (with minor manifest adjustments to manifest_version 3)
- Microsoft Edge

## Architecture

```
facebook-video-subtitles/
├── manifest.json
├── src/
│   ├── background.js      # Background service worker / page
│   ├── content.js         # Content script injected into FB pages
│   ├── content.css        # Subtitle overlay styles
│   ├── stt.js             # STT/AI transcription utilities
│   ├── popup.html/css/js  # Popup UI
│   ├── options.html/css/js # Settings page
│   └── translation.js     # Translation utilities
├── icons/
├── assets/
├── scripts/
├── package.json
├── AGENTS.md
├── CONTRIBUTING.md
└── README.md
```

## Key Files and Responsibilities

- **manifest.json**: Extension manifest (currently v2 for Firefox; see Migration Notes for v3)
- **src/content.js**: Detects Facebook videos, captures audio, requests transcription, manages subtitle overlay
- **src/stt.js**: Transcribes audio via AI (OpenAI, Deepgram, Groq, AssemblyAI) or browser Web Speech API
- **src/background.js**: Message proxy, settings management
- **src/options.js**: Settings page logic, export/import, API key storage
- **src/popup.js**: Quick controls for the active tab

## Supported STT Providers

| Provider | Type | Notes |
|----------|------|-------|
| Browser Speech API | Built-in | Free, no key, limited accuracy |
| OpenAI Whisper | AI | Requires API key, high quality |
| Groq Whisper | AI | Fast, open weights via Groq API |
| Deepgram Nova-2 | AI | Best latency, paid plans available |
| AssemblyAI | AI | Long-form capable, async upload |

## Supported Translation

- Uses OpenAI `gpt-3.5-turbo` / `gpt-4o-mini` with user-provided OpenAI API key
- If using Groq, pass the Groq API key to OpenAI-compatible endpoint with base URL `https://api.groq.com/openai/v1`
- Translation step runs in content script or background via fetch; never stores API keys

## Data Flow

1. content.js detects a playable <video> on a Facebook URL
2. On play, capture audio using MediaRecorder via AudioContext
3. Send audio blob to STT provider or use browser SpeechRecognition
4. Store VTT cues in memory keyed by video element
5. Overlay current cue as DOM element synchronized to video.currentTime
6. Optionally translate text and re-render overlay

## Development Commands

```bash
npm run lint      # ESLint check
npm run typecheck # JS typecheck (basic)
npm test          # Jest tests
npm run dev       # Watch build
npm run build     # Production build
npm run zip       # Generate .zip for AMO / CWS upload
```

## Deviation Policy

If something is impossible with current architecture (e.g., AudioContext capture fails due to CORS or autoplay restrictions), implement a fallback:

- Prefer `captureStream()` on video element, then MediaRecorder
- Fall back to browser SpeechRecognition (no download needed)
- Fall back to a "Download Audio" button sending blob to user
- Never break existing functionality to support a new provider

## Testing

- Test with real Facebook Reels: login to facebook.com, navigate to a Reel with and without captions
- Verify subtitles appear during playback, pause, seek
- Test auto-generate toggle by turning it off and on
- Verify font size, colors change immediately
- Test settings persistence (Refresh page -> check settings saved)

## Known Limitations

- Firefox MV2 is required for current implementation (manifest_version 2)
- Audio capture may be blocked by Facebook's CORS on some video sources; browser Speech API fallback mitigates this
- Firefox for Android uses same code paths; ensure `webkitAudioContext` fallbacks exist
- Deepgram and AssemblyAI require upload endpoints - large blobs may need chunking

## Future Enhancements (do NOT implement unless asked)

- Manifest v3 migration (mv2 -> mv3 service worker)
- Offscreen document for audio processing in MV3
- Download VTT/SRT export
- Batch import/export for multiple providers
- Firefox Add-ons store listings and screenshots

## Commit Policy

- Never push without explicit user request
- Break commits by feature: "add OpenWebWhisper provider", "fix subtitle sync for seek events"
- Do not include credentials in commits

## Browser Compatibility

| Browser | Status |
|---------|--------|
| Firefox 57+ | Fully supported |
| Firefox for Android | Supported (test UI in landscape) |
| Chrome 88+ | Supported (needs mv3 migration for future) |
| Edge 88+ | Supported (Chromium-based) |

## Reference Docs

This repo contains `CONTRIBUTING.md` and `README.md` for users and contributors. Maintain both with each release.
