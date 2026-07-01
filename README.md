# Facebook Video Subtitles

A browser extension that automatically generates subtitles for Facebook videos (including Reels) using AI or browser-based speech-to-text. The subtitles are overlaid on the video in real time, and can optionally be translated into other languages.

## Features

- Auto-generate subtitles during playback
- Multiple STT providers: OpenAI Whisper, Groq, Deepgram, AssemblyAI, or Browser Speech API
- Fallback to browser SpeechRecognition when audio capture is blocked
- Real-time translation via OpenAI-compatible API
- Customizable subtitle appearance (font size, colors, opacity)
- Settings export / import

## Install (Development)

```bash
git clone https://github.com/NaievetestV2/Facebook-Subtitles
cd Facebook-Subtitles
npm install
npm run build
```

Load `dist/` as a temporary add-on in Firefox (`about:debugging#/runtime/this-firefox`).

### Firefox for Android

1. Build the `.xpi` via `npm run xpi`.
2. In Firefox Android, open `about:addons`, tap the gear, choose "Install from file", and select the `.xpi`.

### Chrome / Edge

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked" and point to the `dist/` folder, or drag the `.zip` onto the page.

## Install (from AMO / CWS)

- Firefox Add-ons: https://addons.mozilla.org/
- Chrome Web Store: (Coming soon)

## Package

```bash
npm run build   # Build dist/
npm run xpi     # Create packages/facebook-video-subtitles.xpi
npm run zip     # Create packages/facebook-video-subtitles.zip
```

## Troubleshooting

- **Popup is tiny or empty**: Make sure you loaded the `dist/` folder, not the project root. The `popup.html`, `popup.css`, `options.html`, and `options.css` must all be inside `dist/`. If you had an older version installed, remove it before reloading `dist/`.
- **Subtitles fail after a few seconds**: Use the "Browser Speech API" provider in Options first to verify the extension works. If audio capture fails (common on some Android builds), switch to browser SpeechRecognition as a fallback.
- **No subtitles at all**: Check the browser console for `[FB-Subtitles]` errors. Ensure you are on `facebook.com` or `m.facebook.com` and playing a video.

## Usage

1. Log in to Facebook and open a video (Reel or feed).
2. Click the extension icon or enable auto-generate in settings.
3. Set your preferred STT provider and API key in Options.
4. Play the video. Subtitles will appear automatically.
5. To translate subtitles, set source and target languages in Options.

## Privacy

- Audio is sent directly to your chosen STT provider.
- API keys are stored in local browser storage only.
- No data is sent to the extension author.

## TODO

- [ ] Icons redesign (user-provided artwork)
- [ ] Manifest v3 migration
- [ ] VTT/SRT download
- [ ] Per-language UI localization
- [ ] Firefox for Android optimized UI
- [ ] Subtitle search / history

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
