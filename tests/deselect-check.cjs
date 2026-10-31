const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--disable-background-networking', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND'] });
  try {
    const context = await browser.newContext();
    const requests = [], errors = [];
    await context.route('**/*', route => { if (route.request().url().startsWith('file:')) return route.continue(); requests.push(route.request().url()); return route.abort(); });
    const page = await context.newPage(); page.setDefaultTimeout(5000);
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../email-builder.html')).href);
    await page.waitForFunction(() => document.querySelector('#frame').contentDocument?.querySelector('[data-bid]'));
    const frame = page.frameLocator('#frame');
    const selCount = () => page.evaluate(() => document.querySelector('#frame').contentDocument.querySelectorAll('[data-bid].sel').length);
    const shadow = () => page.evaluate(() => { const td = document.querySelector('#frame').contentDocument.querySelector('[data-bid].sel>td'); return td && getComputedStyle(td).boxShadow; });
    assert.equal(await page.locator('#clearSel').isHidden(), true);
    // клик по блоку выделяет, кнопка снимает
    await frame.locator('[data-bid]').nth(1).click();
    assert.ok(await selCount() > 0);
    assert.equal(await page.locator('#clearSel').isVisible(), true);
    await page.locator('#clearSel').click();
    assert.equal(await selCount(), 0);
    assert.equal(await page.locator('.card.sel').count(), 0);
    assert.equal(await page.locator('#clearSel').isHidden(), true);
    // Esc вне поля ввода снимает выделение, в поле — нет
    await frame.locator('[data-bid]').nth(1).click();
    await page.locator('.card.sel textarea, .card.sel input[type=text]').first().focus();
    await page.keyboard.press('Escape');
    assert.ok(await selCount() > 0, 'Esc в поле редактора не должен сбрасывать выделение');
    await page.locator('#meta').click();
    await page.keyboard.press('Escape');
    assert.equal(await selCount(), 0);
    // клик по пустому месту письма снимает выделение
    await frame.locator('[data-bid]').nth(1).click();
    await page.evaluate(() => document.querySelector('#frame').contentDocument.body.click());
    assert.equal(await selCount(), 0);
    // «Без рамок» скрывает рамку, но выделение сохраняется
    await frame.locator('[data-bid]').nth(1).click();
    assert.notEqual(await shadow(), 'none');
    await page.locator('#cleanView').click();
    assert.equal(await page.locator('#cleanView').getAttribute('aria-pressed'), 'true');
    assert.equal(await shadow(), 'none');
    assert.ok(await selCount() > 0);
    // режим переживает перерисовку превью
    await page.locator('.card.sel textarea, .card.sel input[type=text]').first().fill('Changed');
    await page.waitForTimeout(400);
    assert.equal(await shadow(), 'none');
    await page.locator('#cleanView').click();
    assert.notEqual(await shadow(), 'none');
    // кнопки скрыты вне режима «Письмо»
    await page.locator('[data-view=code]').click();
    assert.equal(await page.locator('#cleanView').isHidden(), true);
    assert.equal(await page.locator('#clearSel').isHidden(), true);
    await page.locator('[data-view=mail]').click();
    assert.equal(await page.locator('#clearSel').isVisible(), true);
    assert.deepEqual(requests, []); assert.deepEqual(errors, []);
    console.log('PASS: selection clears by button, Esc and empty-area click; clean view hides frames and survives re-render; controls hidden outside mail view.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
