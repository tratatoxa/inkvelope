const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
// Conversion preserves list backgrounds and the divider above the footer.
const html = `<html><body>
<table style="background:#F1F1F1" width="100%"><tr><td>
<table width="600"><tr><td style="border-bottom:solid #BFBFBF 1.0pt;background:white">
<p>Коллеги, привет! Это первый абзац письма, он достаточно длинный, чтобы быть обычным текстом.</p>
<table><tr><td width="570" style="background:#EFEFFF;padding:0 5.4pt">
<p><b>Как перейти на веб-версию</b></p>
<ol><li>1. Перейдите по адресу</li><li>2. Войдите в аккаунт</li><li>Добавьте в избранное</li></ol>
</td></tr></table>
<p>Спасибо, что помогаете!</p>
</td></tr>
<tr><td style="background:white"><p>С заботой,</p><p>Команда</p></td></tr></table>
</td></tr></table></body></html>`;
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--disable-background-networking', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND'] });
  try {
    const context = await browser.newContext();
    await context.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.copied = text; } } }); });
    const page = await context.newPage(); page.setDefaultTimeout(5000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../email-builder.html')).href);
    await page.locator('#languageSelect').selectOption('ru');
    await page.locator('#importFile').setInputFiles({ name: 'layout.html', mimeType: 'text/html', buffer: Buffer.from(html) });
    await page.waitForSelector('[data-relayout]', { state: 'attached' });
    await page.evaluate(() => document.querySelector('[data-relayout]').click());
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => { document.querySelector('#copyJson').click(); return JSON.parse(window.copied); });
    const types = st.blocks.map(b => b.type);
    const heading = st.blocks.find(b => b.type === 'heading'), list = st.blocks.find(b => b.type === 'list');
    assert.equal(heading.bg, '#EFEFFF'); assert.equal(heading.space, 0);
    assert.equal(list.bg, '#EFEFFF');
    assert.equal(list.items, 'Перейдите по адресу\nВойдите в аккаунт\nДобавьте в избранное');
    const text = st.blocks.filter(b => b.type === 'text');
    assert.ok(text.every(b => !b.bg), 'normal text has no background');
    assert.ok(text.some(b => b.text.includes('Спасибо')), 'text above the divider is not absorbed into the footer');
    const footer = st.blocks[st.blocks.length - 1];
    assert.equal(footer.type, 'footer'); assert.equal(footer.border, true);
    assert.ok(!footer.text.includes('Спасибо'));
    assert.deepEqual(errors, []);
    console.log('Import keeps list background, strips typed numbers and keeps the divider above the footer:', types.join(', '));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
