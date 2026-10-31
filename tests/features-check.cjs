const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--disable-background-networking', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND'] });
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const requests = [], errors = [];
    await context.route('**/*', route => { if (route.request().url().startsWith('file:')) return route.continue(); requests.push(route.request().url()); return route.abort(); });
    await context.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.copied = text; } } }); });
    const page = await context.newPage(); page.setDefaultTimeout(5000);
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../email-builder.html')).href);
    await page.locator('#languageSelect').selectOption('ru');
    await page.waitForFunction(() => document.querySelector('#frame').contentDocument?.querySelector('[data-bid]'));
    // About opens on startup; blocks have their own tab.
    assert.ok(await page.locator('#p-about').isVisible());
    assert.ok(await page.locator('#p-about h3').first().textContent().then(t => t.includes('Как начать работу')));
    assert.equal(await page.locator('#p-blocks').isVisible(), false);
    await page.locator('#t-blocks').click();
    assert.ok(await page.locator('#p-blocks').isVisible());
    assert.equal(await page.locator('#t-about').getAttribute('aria-expanded'), 'false');
    const readState = () => page.evaluate(() => { document.querySelector('#copyJson').click(); return JSON.parse(window.copied); });
    const html = async () => { await page.locator('#copyCode').click(); return page.evaluate(() => window.copied); };
    const types = async () => (await readState()).blocks.map(b => b.type);
    const project = { settings: { subject: 'FEATURES' }, blocks: [{ type: 'heading', text: 'First' }, { type: 'text', text: 'Second' }, { type: 'text', text: 'Third' }] };
    await page.locator('#openJson').setInputFiles({ name: 'f.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
    await page.waitForFunction(() => document.querySelector('input[id$="-subject"]')?.value === 'FEATURES');

    // Redo buttons and shortcuts work; a new edit clears redo history.
    assert.equal(await page.locator('#redoChange').isDisabled(), true);
    await page.locator('[data-add=spacer]').click();
    assert.equal((await readState()).blocks.length, 4);
    await page.locator('#undoChange').click();
    assert.equal((await readState()).blocks.length, 3);
    await page.locator('#redoChange').click();
    assert.equal((await readState()).blocks.length, 4);
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+Shift+z');
    assert.equal((await readState()).blocks.length, 4);
    await page.keyboard.press('Meta+z');
    await page.keyboard.press('Control+y');
    assert.equal((await readState()).blocks.length, 4);
    await page.keyboard.press('Control+z');
    await page.locator('[data-add=divider]').click();
    assert.equal(await page.locator('#redoChange').isDisabled(), true);
    await page.locator('#undoChange').click();
    await page.evaluate(() => document.activeElement?.blur());
    console.log('ok redo');

    // Steppers use 4 px spacing increments, align to the grid and respect minimums.
    await page.locator('.card').first().locator('.toggle').click();
    const space = page.locator('.card').first().locator('input[id$="-space"]');
    await space.fill('10');
    const stepUp = space.locator('xpath=..').locator('[data-d="1"]'), stepDown = space.locator('xpath=..').locator('[data-d="-1"]');
    await stepUp.click();
    assert.equal(await space.inputValue(), '12');
    await stepUp.click();
    assert.equal(await space.inputValue(), '16');
    assert.equal((await readState()).blocks[0].space, 16);
    await space.fill('2'); await stepDown.click(); await stepDown.click();
    assert.equal(await space.inputValue(), '0');
    const size = page.locator('.card').first().locator('input[id$="-size"]');
    const before = Number(await size.inputValue());
    await size.locator('xpath=..').locator('[data-d="1"]').click();
    assert.equal(Number(await size.inputValue()), before + 1);
    console.log('ok stepper');

    // Drag cards by their handles and new blocks from the palette.
    await page.locator('.card').first().locator('.toggle').click();
    await page.locator('.card').nth(2).locator('.grip').dragTo(page.locator('.card').first(), { targetPosition: { x: 40, y: 4 } });
    assert.deepEqual((await readState()).blocks.map(b => b.text), ['Third', 'First', 'Second']);
    await page.locator('#undoChange').click();
    assert.deepEqual((await readState()).blocks.map(b => b.text), ['First', 'Second', 'Third']);
    await page.locator('[data-add=columns]').dragTo(page.locator('.card').nth(1), { targetPosition: { x: 40, y: 4 } });
    assert.deepEqual(await types(), ['heading', 'columns', 'text', 'text']);
    console.log('ok drag');

    // Columns support two or three cells and stack on phones.
    let out = await html();
    assert.equal((out.match(/class="col"/g) || []).length, 2);
    assert.ok(out.includes('width="256"'));
    const colCard = page.locator('.card').nth(1);
    await colCard.locator('select[id$="-count"]').selectOption('3');
    assert.equal(await page.locator('.card').nth(1).locator('.colbox').count(), 3);
    out = await html();
    assert.equal((out.match(/class="col"/g) || []).length, 3);
    assert.ok(out.includes('Третья колонка'));
    assert.ok(out.includes('@media screen and (max-width:620px){') && out.includes('.col{display:block!important;width:100%!important}'));
    await page.locator('.card').nth(1).locator('.colbox').nth(1).locator('input[id$="-btnLabel"]').fill('Col button');
    await page.locator('[data-view=checks]').click();
    await page.waitForFunction(() => document.querySelector('#checks').textContent.includes('колонка 2: у кнопки нет ссылки'));
    await page.locator('[data-view=mail]').click();
    await page.locator('[data-device=phone]').click();
    await page.waitForTimeout(250);
    const widths = await page.evaluate(() => { const d = document.querySelector('#frame').contentDocument; return [...d.querySelectorAll('.col')].map(td => Math.round(td.getBoundingClientRect().width)); });
    assert.equal(await page.locator('#frame').evaluate(el => Math.round(el.getBoundingClientRect().width)), 375);
    assert.ok(widths.every(w => w === widths[0] && w > 300), 'columns fill the phone width: ' + widths);
    await page.locator('[data-device=desktop]').click();
    console.log('ok columns');

    // Block backgrounds, contrast and button options.
    await page.locator('.card').nth(2).locator('.toggle').click();
    const textCard = page.locator('.card').nth(2);
    await textCard.locator('.color input[type=text]').nth(0).fill('#1F2937');
    out = await html();
    assert.ok(out.includes('bgcolor="#1F2937"'));
    await page.locator('[data-view=checks]').click();
    await page.waitForFunction(() => document.querySelector('#checks').textContent.includes('плохо читается'));
    await page.locator('[data-view=mail]').click();
    await textCard.locator('.color input[type=text]').nth(1).fill('#FFFFFF');
    await textCard.locator('input[id$="-bgFull"]').check();
    out = await html();
    assert.ok(/bgcolor="#1F2937"[^>]*><tr><td class="px" style="padding:16px 32px">/.test(out));
    assert.ok(out.includes('color:#FFFFFF'));
    await page.locator('[data-add=button]').click();
    const btnCard = page.locator('.card.sel');
    await btnCard.locator('input[id$="-href"]').fill('https://example.com/');
    await btnCard.locator('input[id$="-full"]').check();
    await btnCard.locator('select[id$="-variant"]').selectOption('outline');
    await btnCard.locator('input[id$="-radius"]').fill('20');
    out = await html();
    assert.ok(/<table role="presentation" width="100%"[^>]*><tr><td align="center" style="background:transparent;border:2px solid #2563EB;border-radius:20px/.test(out));
    console.log('ok box and button');

    // Preheaders are hidden at the start of the email; warn when empty.
    await page.locator('[data-view=checks]').click();
    await page.waitForFunction(() => document.querySelector('#checks').textContent.includes('Нет прехедера'));
    await page.locator('#t-style').click();
    await page.locator('input[id$="-preheader"]').fill('Коротко о главном');
    out = await html();
    assert.ok(/<body[^>]*>\n<div style="display:none;[^"]*mso-hide:all[^"]*">Коротко о главном/.test(out));
    await page.waitForFunction(() => !document.querySelector('#checks').textContent.includes('Нет прехедера'));
    await page.locator('[data-view=mail]').click();
    await page.waitForFunction(() => document.querySelector('#frame').contentDocument?.body?.textContent.includes('Коротко о главном'));
    const visible = await page.evaluate(() => document.querySelector('#frame').contentDocument.body.innerText.includes('Коротко о главном'));
    assert.equal(visible, false);
    console.log('ok preheader');

    // Save and insert blocks, export the library and use templates.
    await page.locator('#t-blocks').click();
    await page.locator('.card').nth(1).locator('[data-act=lib]').click();
    assert.equal(await page.locator('.lib-row').count(), 1);
    await page.locator('.lib-row input').fill('Мои колонки');
    await page.locator('#saveTemplate').click();
    assert.equal(await page.locator('.lib-row').count(), 2);
    const countBefore = (await readState()).blocks.length;
    await page.locator('.lib-row').first().locator('[data-lib-add]').click();
    const st = await readState();
    assert.equal(st.blocks.length, countBefore + 1);
    const cols = st.blocks.filter(b => b.type === 'columns');
    assert.equal(cols.length, 2); assert.notEqual(cols[0].id, cols[1].id);
    const dl = page.waitForEvent('download'); await page.locator('#saveLib').click();
    const file = await dl;
    assert.equal(file.suggestedFilename(), 'my-blocks.json');
    const lib = JSON.parse(fs.readFileSync(await file.path(), 'utf8'));
    assert.equal(lib.kind, 'mailer-library'); assert.equal(lib.items[0].name, 'Мои колонки'); assert.ok(lib.items[1].settings);
    await page.locator('.lib-row').first().locator('[data-lib-del]').click();
    await page.locator('#openLib').setInputFiles({ name: 'my-blocks.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(lib)) });
    await page.waitForFunction(() => document.querySelectorAll('.lib-row').length === 2);
    await page.locator('#openLib').setInputFiles({ name: 'my-blocks.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(lib)) });
    await page.waitForTimeout(100);
    assert.equal(await page.locator('.lib-row').count(), 2, 'reopening does not duplicate entries');
    await page.locator('[data-add=spacer]').click();
    const tpl = page.locator('.lib-row').filter({ has: page.locator('input[value^="Шаблон"]') }).locator('[data-lib-add]');
    await tpl.click(); await tpl.click();
    const afterTpl = await readState();
    assert.equal(afterTpl.blocks.length, countBefore);
    assert.equal(afterTpl.settings.preheader, 'Коротко о главном');
    const evil = { kind: 'mailer-library', version: 1, items: [{ name: 'x', blocks: [{ type: 'columns', cols: [{ img: { src: 'https://egress.invalid/a.png' } }, 'junk'] }, { type: 'nope' }] }] };
    await page.locator('#openLib').setInputFiles({ name: 'evil.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(evil)) });
    await page.locator('.lib-row').last().locator('[data-lib-add]').click();
    const evilCols = (await readState()).blocks.find(b => b.type === 'columns' && b.cols[0].img === null && b.cols[1].title === '');
    assert.ok(evilCols, 'remote images and malformed column values are omitted');
    console.log('ok library');

    assert.deepEqual(requests, []); assert.deepEqual(errors, []);
    console.log('PASS: About opens on start with the getting-started section first; redo, number steppers, drag-and-drop, columns with phone stacking, block background, button options, preheader, block library and templates; no network or JS errors.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
