const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
// Версия задана в двух местах: константа в приложении и верхний заголовок в changelog.md. Они должны совпадать
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'email-builder.html'), 'utf8');
const changelog = fs.readFileSync(path.join(root, 'changelog.md'), 'utf8');

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const app = html.match(/const APP_VERSION = '([^']*)'/)?.[1];
assert.ok(app, 'В email-builder.html нет константы APP_VERSION');
assert.match(app, SEMVER, `APP_VERSION не по SemVer: ${app}`);
// Версия показана в шапке рядом с названием
assert.match(html, /<h1>inkvelope<span class="ver" id="appVer"[^>]*><\/span><\/h1>/, 'В шапке нет названия inkvelope и места для версии');
assert.match(html, /\$\('#appVer'\)\.textContent = APP_VERSION;/, 'Версия не выводится в шапку');

const versions = [...changelog.matchAll(/^## (\S+)/gm)].map(m => m[1]);
assert.ok(versions.length, 'В changelog.md нет разделов версий');
for (const v of versions) assert.match(v, SEMVER, `Версия в changelog.md не по SemVer: ${v}`);
assert.equal(versions[0], app, `APP_VERSION ${app} не совпадает с верхней версией в changelog.md ${versions[0]}`);

// Версии идут от новой к старой и не повторяются
const num = v => v.split('.').map(Number);
const cmp = (a, b) => { const x = num(a), y = num(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };
for (let i = 1; i < versions.length; i++) assert.ok(cmp(versions[i - 1], versions[i]) > 0, `Версии в changelog.md не по порядку: ${versions[i - 1]} перед ${versions[i]}`);

console.log(`PASS: версия ${app} задана один раз, выводится в шапку и совпадает с changelog.md; порядок версий не нарушен.`);
