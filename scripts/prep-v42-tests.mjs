import fs from 'node:fs';

function replaceIn(path, oldValue, newValue, label) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(oldValue)) {
    if (s.includes(newValue)) return;
    throw new Error(`Missing ${label} in ${path}`);
  }
  s = s.replace(oldValue, newValue);
  fs.writeFileSync(path, s);
}

replaceIn(
  'src/results-core.js',
  "  function finite(value) {\n    const x = Number(value);\n    return Number.isFinite(x) ? x : null;\n  }",
  "  function finite(value) {\n    if (value === null || value === undefined || value === '') return null;\n    const x = Number(value);\n    return Number.isFinite(x) ? x : null;\n  }",
  'missing-value numeric guard'
);

replaceIn(
  'tests/results-core.test.js',
  '  assert.equal(R.activeFilterCount(filters), 11);',
  '  assert.equal(R.activeFilterCount(filters), 12);',
  'active filter count expectation'
);

let t = fs.readFileSync('tests/userscript-static.test.js', 'utf8');
t = t.replace("test('userscript is version 4.1.0 and loads the tested Scout core', () => {", "test('userscript is version 4.2.0 and loads the tested Scout and Results cores', () => {");
t = t.replace(/assert\.match\(s, \/@version\\s\+4\\\.1\\\.0\/\);/, "assert.match(s, /@version\\s+4\\.2\\.0/);");
t = t.replace(/assert\.match\(s, \/SCRIPT_VERSION\\s\*=\\s\*\[\"'\]4\\\.1\\\.0\[\"'\]\/\);/, "assert.match(s, /SCRIPT_VERSION\\s*=\\s*[\"']4\\.2\\.0[\"']/);");
const scoutRequire = "  assert.match(s, /@require\\s+https:\\/\\/raw\\.githubusercontent\\.com\\/R4G3RUNN3R\\/Torn-Recruitment-Agency\\/main\\/src\\/scout-core\\.js/);";
if (!t.includes('src\\/results-core\\.js')) {
  t = t.replace(scoutRequire, scoutRequire + "\n  assert.match(s, /@require\\s+https:\\/\\/raw\\.githubusercontent\\.com\\/R4G3RUNN3R\\/Torn-Recruitment-Agency\\/main\\/src\\/results-core\\.js/);\n  assert.match(s, /RA_ResultsCore/);");
}
if (!t.includes("v4.2 Results workspace is simple by default")) {
  t += `\n\ntest('v4.2 Results workspace is simple by default and expandable', () => {\n  const s = source();\n  assert.match(s, /ra-results-search/);\n  assert.match(s, /ra-results-filters-toggle/);\n  assert.match(s, /ra-results-columns-toggle/);\n  assert.match(s, /ra-results-filters/);\n  assert.match(s, /ra-results-columns/);\n  assert.match(s, /ra-clear-filters/);\n  assert.match(s, /aria-sort/);\n  assert.match(s, /data-sort-key/);\n  assert.match(s, /DEFAULT_VISIBLE_COLUMNS/);\n});\n\ntest('v4.2 Results state is per mode and includes UX hardening', () => {\n  const s = source();\n  assert.match(s, /resultsByMode/);\n  assert.match(s, /normalizeResultsSettings/);\n  assert.match(s, /resetWindowLayout/);\n  assert.match(s, /syncBusyControls/);\n  assert.match(s, /scheduleSidebarRecovery/);\n  assert.match(s, /SIDEBAR_RETRY/);\n});\n`;
}
fs.writeFileSync('tests/userscript-static.test.js', t);
console.log('Prepared v4.2 tests and Results core fixes');
