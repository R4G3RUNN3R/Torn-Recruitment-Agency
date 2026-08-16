'use strict';

const fs = require('node:fs');
const testPath = 'tests/userscript-static.test.js';
let s = fs.readFileSync(testPath, 'utf8');

function replaceTest(startMarker, endMarker, fragmentPath, label) {
  const replacement = fs.readFileSync(fragmentPath, 'utf8').trim();
  const start = s.indexOf(startMarker);
  const end = s.indexOf(endMarker, start);
  if (start < 0 || end < 0 || end <= start) throw new Error(`Could not locate ${label} test block`);
  s = s.slice(0, start) + replacement + '\n\n' + s.slice(end);
}

replaceTest(
  "test('v4.4 has an inline Settings hub and moves complexity controls into General settings', () => {",
  "test('v4.4 exposes Smart Match profile management controls and functions', () => {",
  'tools/task4-test-fix.jsfrag',
  'Settings'
);

replaceTest(
  "test('v4.4 exposes Smart Match profile management controls and functions', () => {",
  "test('v4.4 contextual help is centralized, accessible and performs no network work', () => {",
  'tools/task4-match-test-fix.jsfrag',
  'Smart Match'
);

fs.writeFileSync(testPath, s);
