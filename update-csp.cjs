// Run after editing inline JavaScript: node update-csp.cjs
// Verify without changing the file: node update-csp.cjs --check
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const file = path.join(__dirname, 'email-builder.html');
const source = fs.readFileSync(file, 'utf8');
const hashes = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(
  match => `'sha256-${crypto.createHash('sha256').update(match[1]).digest('base64')}'`
);
if (hashes.length !== 2) throw new Error('Expected two inline scripts');
const policy = `default-src 'none'; script-src ${hashes.join(' ')}; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'`;
const updated = source.replace(/(<meta http-equiv="Content-Security-Policy" content=")[^"]*(">)/, (_, start, end) => start + policy + end);
if (updated === source && !source.includes(policy)) throw new Error('CSP meta tag not found');
if (process.argv.includes('--check')) {
  if (updated !== source) throw new Error('CSP hashes are stale: run node update-csp.cjs');
  console.log('CSP hashes match both inline scripts.');
} else {
  fs.writeFileSync(file, updated);
  console.log('CSP hashes updated.');
}
