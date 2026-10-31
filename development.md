# Developing inkvelope

**English** · [Русский](development.ru.md)

## Project structure

- `email-builder.html` — the complete application: interface, styles, translations, parsers and email generator.
- `changelog.md` — release history; `*.ru.md` files contain the Russian documentation.
- `update-csp.cjs` — updates the Content Security Policy hashes for inline scripts.
- `tests/offline-check.cjs` — offline operation, import, export and import sanitization.
- `tests/undo-check.cjs` — change history.
- `tests/deselect-check.cjs` — selection and clean preview mode.
- `tests/image-quality-check.cjs` — preservation of original image bytes.
- `tests/features-check.cjs` — columns, block backgrounds, buttons, preheaders, redo, steppers, drag and drop, and the block library.
- `tests/font-check.cjs` — font suggestions, fallbacks, import and per-block font settings.
- `tests/import-layout-check.cjs` — imported backgrounds, lists and footer dividers.
- `tests/language-check.cjs` — English defaults, both interface languages and preservation of user content and history when switching.
- `tests/version-check.cjs` — consistency between the application version and the changelog.

## Checks

After changing inline JavaScript, refresh the CSP hashes:

```bash
node update-csp.cjs
node update-csp.cjs --check
node tests/version-check.cjs
```

Browser tests require Node.js, Playwright and Chromium or Google Chrome. If they are installed outside the default locations, specify their paths:

```bash
PLAYWRIGHT_MODULE=/path/to/playwright \
CHROME_PATH="/path/to/Google Chrome" \
node tests/offline-check.cjs
```

Run the other browser checks the same way. Tests intercept page network requests and fail if the application attempts to load external resources. Russian fixtures also verify that imported Unicode content is preserved.

## Translations

English is the default on every fresh page load. The header selector changes the interface language in memory. English and Russian strings are included in the same HTML file; no translation service is used. A language change redraws controls without changing email content, the block library or undo history.

## Publishing

`.github/workflows/pages.yml` publishes the application to GitHub Pages when application files change on `main`. It checks CSP hashes and the version, then copies `email-builder.html` to the site's `index.html`. The application remains available as a single downloadable file for offline use.
