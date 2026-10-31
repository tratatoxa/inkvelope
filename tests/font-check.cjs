const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
// Проверка предупреждает, если основного шрифта нет на компьютере, и молчит, если он есть
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--disable-background-networking', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND'] });
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(5000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../email-builder.html')).href);
    await page.waitForFunction(() => document.querySelector('#frame').contentDocument?.querySelector('[data-bid]'));
    await page.locator('#t-style').click();
    const options = await page.evaluate(() => [...document.querySelectorAll('#fonts option')].map(o => o.value));
    assert.deepEqual(options, ['Arial, Helvetica, sans-serif', 'Calibri, Arial, sans-serif', 'Verdana, Geneva, sans-serif', "Georgia, 'Times New Roman', serif"]);
    assert.equal(await page.locator('input[id$="-font"]').inputValue(), 'Arial, Helvetica, sans-serif');
    const warn = async font => {
      await page.locator('input[id$="-font"]').fill(font);
      await page.waitForTimeout(300);
      await page.locator('[data-view=checks]').click();
      const text = await page.evaluate(() => [...document.querySelectorAll('#checks li')].map(li => li.textContent).find(t => /не установлен/.test(t)) || null);
      await page.locator('[data-view=mail]').click();
      return text;
    };
    const missing = await warn("'No Such Font 1234', Arial, sans-serif");
    assert.ok(missing && missing.includes('No Such Font 1234') && missing.includes('Arial'), String(missing));
    assert.match(await warn("'No Such Font 1234', 'Other Missing', sans-serif"), /показано шрифтом sans-serif/);
    assert.equal(await warn('Arial, Helvetica, sans-serif'), null);
    assert.equal(await warn('sans-serif'), null);
    // Шрифт заголовков: своё предупреждение и пустое значение по умолчанию
    await page.locator('input[id$="-font"]').fill('Arial, Helvetica, sans-serif');
    await page.locator('input[id$="-hfont"]').fill("'No Such Heading Font', Arial, sans-serif");
    await page.waitForTimeout(300);
    await page.locator('[data-view=checks]').click();
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('#checks li')].some(li => /Шрифт заголовков No Such Heading Font не установлен/.test(li.textContent))));
    await page.locator('[data-view=mail]').click();
    // Импорт: заголовки другим шрифтом, чем текст, переносятся в «Шрифт заголовков» и так рисуются
    const mixed = `<html><body><p><b><span style="font-size:22pt;font-family:&quot;Georgia&quot;">Заголовок письма</span></b></p>
      <p><span style="font-size:10pt;font-family:&quot;Arial&quot;">Коллеги, привет! Это обычный абзац письма, набранный основным шрифтом, он длиннее заголовка.</span></p></body></html>`;
    await page.locator('#t-import').click();
    await page.locator('#importFile').setInputFiles({ name: 'mixed.html', mimeType: 'text/html', buffer: Buffer.from(mixed) });
    await page.waitForSelector('[data-relayout]', { state: 'attached' });
    await page.evaluate(() => document.querySelector('[data-relayout]').click());
    await page.waitForFunction(() => /Заголовок письма/.test(document.querySelector('#frame').contentDocument?.body?.textContent || ''));
    const fonts = await page.evaluate(() => {
      const doc = document.querySelector('#frame').contentDocument;
      const cell = [...doc.querySelectorAll('td')].filter(td => td.textContent.trim() === 'Заголовок письма').pop();
      const text = [...doc.querySelectorAll('td, p')].filter(el => /^Коллеги/.test(el.textContent.trim())).pop();
      return { head: cell.style.fontFamily, text: text.style.fontFamily || text.closest('td').style.fontFamily };
    });
    assert.match(fonts.head, /Georgia/);
    assert.match(fonts.text, /Arial/);
    // Импорт: третий шрифт у заголовка и у абзаца остаётся шрифтом блока, выравнивание заголовка сохраняется
    const three = `<html><body><p><b><span style="font-size:22pt;font-family:&quot;Georgia&quot;">Первый заголовок</span></b></p>
      <p><span style="font-size:10pt;font-family:&quot;Arial&quot;">Коллеги, привет! Это обычный абзац письма, набранный основным шрифтом, он заметно длиннее заголовков и надписей.</span></p>
      <p><b><span style="font-size:22pt;font-family:&quot;Georgia&quot;">Второй заголовок письма</span></b></p>
      <p><span style="font-size:10pt;font-family:&quot;Arial&quot;">Ещё один обычный абзац основным шрифтом, тоже достаточно длинный, чтобы основной шрифт письма определился верно.</span></p>
      <p align="center"><b><span style="font-size:20pt;font-family:&quot;Example Display, example-display, Emoji&quot;">УЗНАТЬ ПОДРОБНОСТИ</span></b></p>
      <p><span style="font-size:10pt;font-family:&quot;Verdana&quot;">Абзац, набранный другим шрифтом, чем остальной текст письма, и тоже довольно длинный, чтобы не стать подписью письма в самом конце.</span></p>
      <p><span style="font-size:10pt;font-family:&quot;Arial&quot;">Завершающий обычный абзац основным шрифтом, длинный, чтобы он не превратился в подпись и основной шрифт письма остался прежним.</span></p></body></html>`;
    await page.locator('#t-import').click();
    await page.locator('#importFile').setInputFiles({ name: 'three.html', mimeType: 'text/html', buffer: Buffer.from(three) });
    await page.waitForTimeout(300);
    await page.waitForSelector('[data-relayout]', { state: 'attached' });
    await page.evaluate(() => document.querySelector('[data-relayout]').click());
    await page.waitForFunction(() => /УЗНАТЬ ПОДРОБНОСТИ/.test(document.querySelector('#frame').contentDocument?.body?.textContent || '') && [...document.querySelector('#frame').contentDocument.querySelectorAll('td')].some(td => td.textContent.trim() === 'УЗНАТЬ ПОДРОБНОСТИ' && td.style.fontFamily));
    const imp = await page.evaluate(() => {
      const doc = document.querySelector('#frame').contentDocument;
      const cell = re => [...doc.querySelectorAll('td')].filter(td => re.test(td.textContent.trim()) && td.style.fontFamily).pop();
      return { h1: cell(/^Первый заголовок$/).style.fontFamily, big: cell(/^УЗНАТЬ ПОДРОБНОСТИ$/).style.fontFamily, bigAlign: cell(/^УЗНАТЬ ПОДРОБНОСТИ$/).style.textAlign, other: cell(/^Абзац, набранный/).style.fontFamily, plain: cell(/^Завершающий/).style.fontFamily };
    });
    assert.match(imp.h1, /Georgia/);
    // Произвольное семейство сохраняется, дубликаты и emoji удаляются; добавлен запасной вариант
    assert.equal(imp.big.replace(/&quot;|"/g, "'"), "'Example Display', Arial, sans-serif");
    assert.equal(imp.bigAlign, 'center');
    assert.match(imp.other, /Verdana/);
    assert.match(imp.plain, /Arial/);
    // Свой шрифт блока: рисуется в превью, попадает в проверку; заголовок выравнивается по центру
    await page.locator('#t-blocks').click();
    const card = async type => {
      const i = await page.evaluate(t => [...document.querySelectorAll('#blocks > .card')].findLastIndex(c => c.querySelector('.type').textContent === t), type);
      assert.ok(i >= 0, await page.evaluate(() => [...document.querySelectorAll('#blocks .type')].map(e => e.textContent).join()));
      const c = page.locator('#blocks > .card').nth(i);
      if (!(await c.locator('.card-body').count())) await c.locator('.toggle').click();
      return page.locator('#blocks > .card').nth(i);
    };
    await (await card('Заголовок')).locator('input[id$="-font"]').fill("'No Such Block Font', Arial, sans-serif");
    await (await card('Заголовок')).locator('select[id$="-align"]').selectOption('center');
    await page.locator('[data-add=text]').click();
    await (await card('Текст')).locator('textarea').fill('Узнать подробности');
    await (await card('Текст')).locator('input[id$="-font"]').fill('Georgia');
    await page.waitForTimeout(300);
    await page.locator('[data-view=checks]').click();
    const own = await page.evaluate(() => {
      const doc = document.querySelector('#frame').contentDocument;
      const cell = [...doc.querySelectorAll('td')].filter(td => td.textContent.trim() === 'УЗНАТЬ ПОДРОБНОСТИ' && td.style.fontFamily).pop();
      const text = [...doc.querySelectorAll('td')].filter(el => el.textContent.trim() === 'Узнать подробности').pop();
      return { head: cell.style.fontFamily, align: cell.style.textAlign, text: text.style.fontFamily, list: document.querySelector('#blocks input[id$="-font"]').getAttribute('list'), checks: [...document.querySelectorAll('#checks li')].map(li => li.textContent) };
    });
    assert.equal(own.list, 'fonts');
    assert.match(own.head, /No Such Block Font/);
    assert.equal(own.align, 'center');
    assert.match(own.text, /Georgia/);
    assert.ok(own.checks.some(t => /Шрифт блока «Заголовок» No Such Block Font не установлен/.test(t)), own.checks.join('\n'));
    assert.ok(own.checks.some(t => /Шрифт блока «Текст»: нет запасного варианта/.test(t)), own.checks.join('\n'));
    assert.deepEqual(errors, []);
    console.log('PASS: standard font suggestions and Arial default; custom family names preserved on import with duplicates and emoji removed and fallbacks added; heading and per-block fonts and alignment imported, rendered and checked; missing primary fonts reported; installed and generic fonts accepted.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
