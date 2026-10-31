const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
// Requires Playwright; CHROME_PATH optionally selects an installed Chrome executable.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const sourcePath = path.resolve(__dirname, '../email-builder.html');
const source = fs.readFileSync(sourcePath, 'utf8');
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aU1sAAAAASUVORK5CYII=';
const results = [];
const record = message => { results.push(message); console.log(message); };
(async () => {
  const parser = source.match(/<script id="mail-import">([\s\S]*?)<\/script>/)[1];
  const ctx = { module: { exports: {} }, TextDecoder, TextEncoder, Buffer, Uint8Array, DataView };
  vm.createContext(ctx); vm.runInContext(parser, ctx);
  ctx.input = new TextEncoder().encode('{\\rtf1\\ansi\\bin-6}');
  assert.throws(() => vm.runInContext('module.exports.rtfToHtml(input)',ctx,{timeout:250}), /bad-rtf-bin/);
  ctx.input = new Uint8Array(16);
  new DataView(ctx.input.buffer).setUint32(4, 0xffffffff, true);
  assert.throws(() => vm.runInContext('module.exports.decompressRTF(input)',ctx,{timeout:250}), /rtf-too-large/);
  record('Malformed RTF rejected without hanging or allocating declared huge output');
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--disable-background-networking', '--disable-component-update', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND'] });
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const requests = [], errors = [];
    await context.route('**/*', async route => {
      if (route.request().url().startsWith('file:')) return route.continue();
      if (route.request().url() === 'https://mailer-audit.invalid/' && route.request().isNavigationRequest()) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: source });
      requests.push(route.request().url());
      return route.abort('blockedbyclient');
    });
    await context.addInitScript(() => {
      if (window.top !== window) return;
      try { localStorage.setItem('mailer-draft-v1', JSON.stringify({settings:{subject:'LEGACY'},blocks:[{type:'text',id:'legacy',text:'Коллеги — восстановленный черновик'}]})); } catch {}
      window.auditClaudeCalls = 0;
      window.claude = { use: () => { window.auditClaudeCalls++; return Promise.resolve({save:()=>{}}); } };
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async items => { window.auditClipboard = items; }, writeText: async text => { window.auditText = text; } } });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('https://mailer-audit.invalid/', {waitUntil:'load'});
    await page.waitForFunction(() => document.querySelector('#frame').contentDocument?.body.textContent.includes('Коллеги'));
    assert.deepEqual(requests, []);
    assert.equal(await page.evaluate(()=>localStorage.getItem('mailer-draft-v1')), null);
    assert.equal(await page.evaluate(()=>window.auditClaudeCalls), 0);
    assert.ok(await page.locator('#frame').evaluate(el=>el.contentDocument?.body?.textContent.includes('восстановленный черновик')));
    record('Startup: no network, scripts run with CSP, old draft restored in memory and removed from storage, host bridge unused');

    const html = `<html><head><meta http-equiv="refresh" content="0;url=https://egress-check.invalid/redirect"><link rel="stylesheet" href="https://egress-check.invalid/style.css"><style>@import url(https://egress-check.invalid/import.css);body{background-image:url(https://egress-check.invalid/bg.png)}</style></head><body><p>OFFLINE IMPORT TEXT</p><img width="100" src="https://egress-check.invalid/tracking.png"><img width="100" src="${png}"><iframe src="https://egress-check.invalid/frame"></iframe><script>parent.document.body.dataset.importExecuted='yes'</script></body></html>`;
    await page.locator('#t-import').click();
    await page.locator('#importFile').setInputFiles({ name: 'synthetic.html', mimeType: 'text/html', buffer: Buffer.from(html) });
    await page.waitForFunction(()=>document.querySelector('#origFrame').srcdoc.includes('OFFLINE IMPORT TEXT'));
    await page.waitForTimeout(250);
    assert.deepEqual(requests, []);
    assert.equal(await page.evaluate(()=>document.body.dataset.importExecuted), undefined);
    await page.locator('[data-relayout]').click();
    await page.waitForFunction(()=>document.querySelector('#frame').contentDocument?.body?.textContent.includes('OFFLINE IMPORT TEXT'));
    assert.deepEqual(requests, []);
    record('HTML import and relayout retain text/embedded image; external CSS, images, frames and navigation blocked');

    const project = {settings:{subject:'OFFLINE PROJECT'},blocks:[{type:'text', id:'audit"><script>parent.document.body.dataset.auditXss="executed"</script><tr data-bid="audit',text:'ROUNDTRIP CONTENT'},{type:'image',img:{src:'https://egress-check.invalid/project.png',w:100,h:100}},{type:'image',img:{src:png,w:1,h:1},width:100,alt:'EMBEDDED IMAGE'}]};
    await page.locator('#openJson').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
    await page.waitForFunction(()=>document.querySelector('#frame').contentDocument?.body?.textContent.includes('ROUNDTRIP CONTENT'));
    assert.equal(await page.evaluate(()=>document.body.dataset.auditXss), undefined);
    assert.equal(await page.locator('#frame').getAttribute('sandbox'), 'allow-same-origin');
    assert.deepEqual(requests, []);
    assert.equal(await page.locator('#frame').evaluate(el=>el.contentDocument.querySelectorAll('script').length),0);
    record('JSON ID injection prevented; remote image omitted; embedded image preserved');

    await page.locator('#copyMail').click();
    const clipboard = await page.evaluate(async()=>{const item=window.auditClipboard[0];return {html:await (await item.getType('text/html')).text(),text:await (await item.getType('text/plain')).text()};});
    assert.ok(clipboard.html.includes('ROUNDTRIP CONTENT'));
    assert.ok(clipboard.text.includes('ROUNDTRIP CONTENT'));
    assert.ok(clipboard.html.includes(png));
    assert.ok(!clipboard.html.includes('https://egress-check.invalid'));
    await page.locator('#copyCode').click();
    assert.ok(await page.evaluate(()=>window.auditText.includes('ROUNDTRIP CONTENT')));
    record('Rich-text and HTML copy work with embedded images');

    const htmlDl = page.waitForEvent('download'); await page.locator('#saveHtml').click();
    const savedHtml = await htmlDl;
    assert.equal(savedHtml.suggestedFilename(),'newsletter.html');
    assert.ok(fs.readFileSync(await savedHtml.path(),'utf8').includes('ROUNDTRIP CONTENT'));
    await page.locator('#t-style').click();
    const jsonDl = page.waitForEvent('download'); await page.locator('#saveJson').click();
    const savedJson = await jsonDl;
    const json = fs.readFileSync(await savedJson.path(),'utf8');
    const parsed = JSON.parse(json);
    assert.ok(parsed.blocks.every(b=>/^[a-z0-9]+$/.test(b.id)));
    assert.equal(parsed.blocks[1].img,null);
    assert.equal(parsed.blocks[2].img.src,png);
    await page.locator('#openJson').setInputFiles({name:'newsletter.json',mimeType:'application/json',buffer:Buffer.from(json)});
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(()=>localStorage.getItem('mailer-draft-v1')),null);
    record('HTML/JSON downloads and JSON roundtrip work without host integration or persistent draft');

    // Verify the same CSP and preview when opened directly from disk.
    const local = await context.newPage();
    local.setDefaultTimeout(5000);
    local.on('pageerror',e=>errors.push(e.message));
    await local.goto(pathToFileURL(sourcePath).href);
    await local.waitForFunction(()=>document.querySelector('#frame').contentDocument?.body.textContent.includes('Коллеги'));
    record('Direct file:// opening works');
    assert.deepEqual(requests,[]);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:results, networkRequests:requests, pageErrors:errors},null,2));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
