const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'email-builder.html'), 'utf8');
const changelog = fs.readFileSync(path.join(root, 'changelog.md'), 'utf8');

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const app = html.match(/const APP_VERSION = '([^']*)'/)?.[1];
assert.ok(app, 'APP_VERSION is missing from email-builder.html');
assert.match(app, SEMVER, `Invalid APP_VERSION: ${app}`);
assert.match(html, /<h1>inkvelope<span class="ver" id="appVer"[^>]*><\/span><\/h1>/, 'The header must contain inkvelope and a version label');
assert.match(html, /\$\('#appVer'\)\.textContent = APP_VERSION;/, 'The version must be displayed in the header');

const versions = [...changelog.matchAll(/^## (\S+)/gm)].map(m => m[1]);
assert.ok(versions.length, 'The changelog has no release headings');
for (const version of versions) assert.match(version, SEMVER, `Invalid changelog version: ${version}`);
assert.equal(versions[0], app, `APP_VERSION ${app} differs from the latest changelog version ${versions[0]}`);
const parts = version => version.split('.').map(Number);
const compare = (a, b) => { const x = parts(a), y = parts(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };
for (let i = 1; i < versions.length; i++) assert.ok(compare(versions[i - 1], versions[i]) > 0, `Changelog versions are not in descending order: ${versions[i - 1]}, ${versions[i]}`);

const russianChangelog = fs.readFileSync(path.join(root, 'changelog.ru.md'), 'utf8');
assert.deepEqual([...russianChangelog.matchAll(/^## (\S+)/gm)].map(m => m[1]), versions, 'English and Russian changelogs must list the same versions');
console.log(`PASS: version ${app} is displayed in the header and matches both changelogs; release order is valid.`);
