# Contributing to Facebook Video Subtitles

## Getting Started

1. Fork the repository.
2. Create a feature branch.
3. Make changes.
4. Run `npm run validate`.
5. Submit a PR.

## Code Style

- Use ES modules where appropriate, plain JS in extension scripts.
- 4 spaces, semicolons, double quotes for project files.
- No `alert()`; show user-friendly messages inside the DOM.
- Always implement a fallback per the Deviation Policy.

## Testing

- Test on Firefox desktop and Android.
- Test on at least one Chromium browser.
- Ensure no console errors before submitting.

## Release Process

Only maintainers can publish releases. Bump version in manifest.json and package.json; tag with `v<x.y.z>`.
