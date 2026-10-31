# Разработка inkvelope

## Структура проекта

- `email-builder.html` — приложение целиком: интерфейс, стили, парсеры и генератор письма;
- `changelog.md` — история изменений;
- `update-csp.cjs` — обновление хешей встроенных скриптов в Content Security Policy;
- `tests/offline-check.cjs` — проверка автономности, импорта, экспорта и защиты импорта;
- `tests/undo-check.cjs` — проверка истории изменений;
- `tests/deselect-check.cjs` — проверка сброса выделения и режима «Без рамок»;
- `tests/image-quality-check.cjs` — проверка сохранения исходных байтов изображений;
- `tests/features-check.cjs` — проверка колонок, фона блока, кнопки, прехедера, повтора, кнопок ▲▼, перетаскивания и библиотеки блоков;
- `tests/version-check.cjs` — проверка совпадения версии в приложении и `changelog.md`.

## Проверки

После любого изменения содержимого встроенных `<script>` обновите хеши CSP:

```bash
node update-csp.cjs
node update-csp.cjs --check
```

Для браузерных тестов нужны Node.js, Playwright и Chromium или Google Chrome. Если Playwright и Chrome находятся не в стандартных местах, передайте пути через переменные окружения:

```bash
PLAYWRIGHT_MODULE=/path/to/playwright \
CHROME_PATH="/path/to/Google Chrome" \
node tests/offline-check.cjs

PLAYWRIGHT_MODULE=/path/to/playwright \
CHROME_PATH="/path/to/Google Chrome" \
node tests/undo-check.cjs

PLAYWRIGHT_MODULE=/path/to/playwright \
CHROME_PATH="/path/to/Google Chrome" \
node tests/deselect-check.cjs

PLAYWRIGHT_MODULE=/path/to/playwright \
CHROME_PATH="/path/to/Google Chrome" \
node tests/image-quality-check.cjs

PLAYWRIGHT_MODULE=/path/to/playwright \
CHROME_PATH="/path/to/Google Chrome" \
node tests/features-check.cjs

PLAYWRIGHT_MODULE=/path/to/playwright \
CHROME_PATH="/path/to/Google Chrome" \
node tests/import-layout-check.cjs

PLAYWRIGHT_MODULE=/path/to/playwright \
CHROME_PATH="/path/to/Google Chrome" \
node tests/font-check.cjs
```

Тесты перехватывают обращения страницы к сети и завершаются ошибкой, если приложение пытается обратиться наружу.
