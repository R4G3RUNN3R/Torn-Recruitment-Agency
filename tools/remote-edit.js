'use strict';

const fs = require('node:fs');
const testPath = 'tests/userscript-static.test.js';
const scriptPath = 'R4G3RUNN3R-Recruitment-Agency.user.js';
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

let u = fs.readFileSync(scriptPath, 'utf8');
function replaceOnce(from, to, label) {
  if (u.includes(to)) return;
  if (!u.includes(from)) throw new Error(`Could not locate userscript patch target: ${label}`);
  u = u.replace(from, to);
}

replaceOnce(
  '    function criterionEditorHtml(key, label, criterion) {',
  '    function setContextHelpKey(element, key) {\n        if (!element || !HELP_REGISTRY[key]) return;\n        element.dataset.helpKey = key;\n        const button = element.querySelector(":scope > .ra-help-button, :scope > summary > .ra-help-button");\n        if (button) {\n            button.dataset.helpKey = key;\n            button.setAttribute("aria-label", `About ${HELP_REGISTRY[key].title}`);\n        }\n        decorateContextHelp();\n    }\n\n    function criterionEditorHtml(key, label, criterion) {',
  'context help key helper'
);
replaceOnce('<div id="ra-scout-controls" class="ra-mode-only">', '<div id="ra-scout-controls" class="ra-mode-only" data-help-key="scout">', 'Scout help hook');
replaceOnce('<details class="ra-section"><summary>Fit Settings</summary>', '<details class="ra-section" data-help-key="fit"><summary>Fit Settings</summary>', 'Fit help hook');
replaceOnce('<div id="ra-results-filters" class="ra-results-drawer" hidden></div>', '<div id="ra-results-filters" class="ra-results-drawer" hidden data-help-key="filters"></div>', 'Results filters help hook');
replaceOnce('<div id="ra-results-columns" class="ra-results-drawer" hidden></div>', '<div id="ra-results-columns" class="ra-results-drawer" hidden data-help-key="columns"></div>', 'Results columns help hook');
replaceOnce(
  '        const scout=document.getElementById("ra-scout-controls");\n        if(forum)forum.style.display=mode==="scout"?"none":"block";',
  '        const scout=document.getElementById("ra-scout-controls");\n        if(forum)setContextHelpKey(forum, mode==="faction"?"faction":"company");\n        if(forum)forum.style.display=mode==="scout"?"none":"block";',
  'dynamic Company/Faction help key'
);
replaceOnce(
  '        renderResultsFilters(); renderResultsColumns();',
  '        renderResultsFilters(); renderResultsColumns(); decorateContextHelp();',
  'Results drawer help decoration'
);
fs.writeFileSync(scriptPath, u);
