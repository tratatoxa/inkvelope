const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--disable-background-networking', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND'] });
  try {
    const context = await browser.newContext();
    const requests = [], errors = [];
    await context.route('**/*', route => {
      if (route.request().url().startsWith('file:')) return route.continue();
      requests.push(route.request().url());
      return route.abort();
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copied = text; } } });
    });
    const page = await context.newPage(); page.setDefaultTimeout(5000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../email-builder.html')).href);
    await page.waitForFunction(() => document.querySelector('#frame').contentDocument?.querySelector('[data-bid]'));
    const readState = () => page.evaluate(() => { document.querySelector('#copyJson').click(); return JSON.parse(window.copied); });
    const switchTo = async language => {
      await page.locator('#languageSelect').selectOption(language);
      await page.waitForFunction(language => document.documentElement.lang === language && document.querySelector('#frame').contentDocument?.body, language);
    };
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.equal(await page.locator('#languageSelect').inputValue(), 'en');
    assert.equal(await page.locator('#copyMail').textContent(), 'Copy email');
    assert.equal(await page.locator('#p-about h3').first().textContent(), 'Getting started');
    assert.equal(await page.locator('#undoChange').isDisabled(), true);
    const startup = await readState();
    assert.equal(startup.settings.subject, 'Team news');
    assert.ok(startup.blocks.some(block => block.text === 'Hi team!'));

    // Deliberately include both scripts and strings that match translated UI labels.
    const project = { settings: { subject: 'Text / Текст — custom subject' }, blocks: [{ type: 'text', text: 'Header\nПривет, команда!\n{0} $& <script>not code</script>' }, { type: 'heading', text: 'Заголовок / Heading' }] };
    await page.locator('#openJson').setInputFiles({ name: 'languages.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
    await page.waitForFunction(() => document.querySelector('input[id$="-subject"]')?.value.includes('custom subject'));
    const initial = await readState();
    await page.locator('#t-blocks').click();
    await page.locator('#blocks > .card').first().locator('[data-act=lib]').click();
    await page.locator('.lib-row input').fill('Text / Мой блок');
    const libraryBefore = await page.locator('.lib-row input').inputValue();
    const historyBefore = await page.locator('#undoChange').isDisabled();
    await switchTo('ru');
    assert.equal(await page.locator('#copyMail').textContent(), 'Копировать письмо');
    assert.equal(await page.locator('#p-about h3').first().textContent(), 'Как начать работу');
    assert.equal(await page.locator('#undoChange').getAttribute('aria-label'), 'Отменить');
    assert.equal(await page.locator('.lib-row input').inputValue(), libraryBefore);
    assert.deepEqual(await readState(), initial);
    assert.equal(await page.locator('#undoChange').isDisabled(), historyBefore);
    assert.equal(await page.locator('#p-blocks').isVisible(), true);
    await page.locator('#t-style').click();
    assert.equal(await page.getByLabel('Тема письма', { exact: true }).inputValue(), initial.settings.subject);
    await page.locator('[data-view=checks]').click();
    assert.ok((await page.locator('#checks').textContent()).includes('Нет прехедера'));
    await switchTo('en');
    assert.equal(await page.locator('#copyMail').textContent(), 'Copy email');
    assert.equal(await page.getByLabel('Email subject', { exact: true }).inputValue(), initial.settings.subject);
    assert.ok((await page.locator('#checks').textContent()).includes('No preheader'));
    assert.deepEqual(await readState(), initial);

    // Repeated switches must not multiply palette click handlers or alter undo history.
    await switchTo('ru'); await switchTo('en');
    await page.locator('#t-blocks').click();
    await page.locator('[data-add=heading]').click();
    const added = await readState();
    assert.equal(added.blocks.length, initial.blocks.length + 1);
    assert.equal(added.blocks.at(-1).text, 'Heading');
    await switchTo('ru');
    await page.locator('#undoChange').click();
    assert.deepEqual(await readState(), initial);
    await switchTo('en');
    await page.locator('#redoChange').click();
    assert.deepEqual(await readState(), added);

    // Source analysis and conversion messages also follow the interface language.
    await page.locator('#t-import').click();
    const imported = '<p style="font-family:ExampleDisplay">Imported text / Импортированный текст</p><img src="cid:missing1"><img src="cid:missing2">';
    await page.locator('#importFile').setInputFiles({ name: 'import.html', mimeType: 'text/html', buffer: Buffer.from(imported) });
    await page.waitForSelector('[data-relayout]');
    assert.equal(await page.locator('[data-relayout]').textContent(), 'Convert to blocks');
    await switchTo('ru');
    assert.equal(await page.locator('[data-relayout]').textContent(), 'Переверстать в конструктор');
    assert.ok((await page.locator('#importResult').textContent()).includes('Шрифт без запасного варианта'));
    await page.locator('[data-relayout]').click();
    await page.waitForSelector('[data-undo]');
    await switchTo('en');
    assert.ok((await page.locator('#importResult').textContent()).includes('Upload 2 images'));
    assert.equal(await page.locator('[data-undo]').textContent(), 'Restore previous draft');
    assert.ok((await readState()).blocks.some(block => block.text?.includes('Импортированный текст')));
    await page.locator('[data-view=mail]').click();
    await page.locator('#copyCode').click();
    const exported = await page.evaluate(() => window.copied);
    assert.ok(exported.includes('Импортированный текст'));
    assert.ok(exported.includes('Imported text'));
    assert.ok(!exported.includes('data-i18n'));
    // Every block editor must be fully translated, including less frequently used hints.
    const controls = await context.newPage();
    controls.on('pageerror', error => errors.push(error.message));
    await controls.goto(pathToFileURL(path.resolve(__dirname, '../email-builder.html')).href);
    await controls.locator('#t-blocks').click();
    const blockTypes = await controls.locator('[data-add]').evaluateAll(buttons => buttons.map(button => button.dataset.add));
    for (const type of blockTypes) {
      await controls.locator(`[data-add="${type}"]`).click();
      const card = controls.locator('#blocks > .card.sel');
      assert.ok(!/[А-Яа-яЁё]/.test(await card.innerText()), `Untranslated English ${type} editor`);
      const attributes = await card.evaluate(el => [...el.querySelectorAll('[title],[aria-label],[placeholder]')].flatMap(node => ['title', 'aria-label', 'placeholder'].map(attr => node.getAttribute(attr) || '')));
      assert.ok(attributes.every(text => !/[А-Яа-яЁё]/.test(text)), `Untranslated English ${type} attributes`);
    }
    await controls.locator('#languageSelect').selectOption('ru');
    await controls.locator('[data-add=heading]').click();
    assert.equal(await controls.locator('#blocks > .card.sel input[id$="-text"]').inputValue(), 'Заголовок');
    assert.deepEqual(requests, []);
    assert.deepEqual(errors, []);
    console.log('PASS: English defaults, Russian and English controls and diagnostics, content/library/history preservation, safe repeated switching and bilingual import/export without network requests.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
