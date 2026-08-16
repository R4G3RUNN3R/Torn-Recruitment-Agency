'use strict';

const fs = require('node:fs');
const testPath = 'tests/userscript-static.test.js';
let s = fs.readFileSync(testPath, 'utf8');
const replacement = fs.readFileSync('tools/task4-test-fix.jsfrag', 'utf8').trim();
const startMarker = "test('v4.4 has an inline Settings hub and moves complexity controls into General settings', () => {";
const endMarker = "test('v4.4 exposes Smart Match profile management controls and functions', () => {";
const start = s.indexOf(startMarker);
const end = s.indexOf(endMarker, start);
if (start < 0 || end < 0 || end <= start) throw new Error('Could not locate Settings test block');
s = s.slice(0, start) + replacement + '\n\n' + s.slice(end);
fs.writeFileSync(testPath, s);
