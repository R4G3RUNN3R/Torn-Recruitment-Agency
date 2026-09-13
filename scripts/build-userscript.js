'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'R4G3RUNN3R-Recruitment-Agency.user.js');
const DIST_DIR = path.join(ROOT, 'dist');
const DIST = path.join(DIST_DIR, 'recruitment-agency.user.js');

const wrapper = fs.readFileSync(SOURCE, 'utf8');
const headerMatch = wrapper.match(/^(\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==)\s*\n([\s\S]*)$/);
if (!headerMatch) throw new Error('Userscript metadata block is missing or malformed.');

const header = headerMatch[1];
const bootstrap = headerMatch[2].trimStart();
const requireUrls = [...header.matchAll(/^\/\/ @require\s+(\S+)\s*$/gm)].map(match => match[1]);
if (!requireUrls.length) throw new Error('No runtime modules were declared in the userscript wrapper.');

const moduleFiles = requireUrls.map(url => {
  const parsed = new URL(url);
  const name = path.posix.basename(parsed.pathname);
  const file = path.join(ROOT, 'src', name);
  if (!fs.existsSync(file)) throw new Error(`Declared runtime module is missing locally: ${name}`);
  return { name, file };
});

const bundledHeader = header
  .split('\n')
  .filter(line => !line.startsWith('// @require'))
  .join('\n');

const modules = moduleFiles.map(({ name, file }) => {
  const source = fs.readFileSync(file, 'utf8').trim();
  return `\n/* bundled runtime: ${name} */\n${source}\n`;
}).join('');

const output = `${bundledHeader}\n\n${modules}\n/* userscript bootstrap */\n${bootstrap.trim()}\n`;
fs.mkdirSync(DIST_DIR, { recursive: true });
fs.writeFileSync(DIST, output, 'utf8');

const remoteRequires = output.match(/^\/\/ @require\s+/gm) || [];
if (remoteRequires.length) throw new Error('Bundled release still contains remote @require directives.');

process.stdout.write(`${DIST}\n`);
