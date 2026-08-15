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

const userscript = 'R4G3RUNN3R-Recruitment-Agency.user.js';
if (fs.existsSync(userscript)) {
  replaceIn(
    userscript,
    '                company: parseCompanyFromText(text),',
    '                company: ResultsCore.parsePreferredCompany(text),',
    'conservative preferred-company parsing'
  );

  replaceIn(
    userscript,
    '        box.querySelectorAll(".ra-results-filter").forEach(el=>el.addEventListener("change",async()=>{const next={...getModeResultsSettings().filters}; const key=el.dataset.filter; if(el.value) next[key]=el.value; else delete next[key]; await saveResultsModeState({filters:next}); renderResults();}));',
    '        const numericFilters=new Set(["minMan","minInt","minEnd","minTotal","minEe","maxEe","minActivity30","maxIdleDays","minFit","minLevel","maxLevel","minNetworth","minActiveStreak","minBestStreak","minStatEnhancers","minXanax30","minRefills30","minAttacks30","minRwHits30","maxDataAgeDays"]);\n        box.querySelectorAll(".ra-results-filter").forEach(el=>el.addEventListener("change",async()=>{const next={...getModeResultsSettings().filters}; const key=el.dataset.filter; if(numericFilters.has(key) && el.value){const parsed=ResultsCore.parseCompactNumber(el.value);el.classList.toggle("ra-invalid",!parsed.valid);el.setAttribute("aria-invalid",parsed.valid?"false":"true");if(!parsed.valid)return;} if(el.value) next[key]=el.value; else delete next[key]; await saveResultsModeState({filters:next}); renderResults();}));',
    'Results filter validation'
  );

  replaceIn(
    userscript,
    '[["minMan","MAN ≥"],["minInt","INT ≥"],["minEnd","END ≥"],["minTotal","TOTAL ≥"],["minEe","EE ≥"],["minActivity30","Activity 30d ≥"],["maxIdleDays","Last Active ≤ days"],["minFit","Fit ≥"],["minLevel","Level ≥"],["minNetworth","Net Worth ≥"],["minXanax30","Xanax 30d ≥"],["minRefills30","Refills 30d ≥"],["minAttacks30","Attacks 30d ≥"],["minRwHits30","RW Hits 30d ≥"]]',
    '[["minMan","MAN ≥"],["minInt","INT ≥"],["minEnd","END ≥"],["minTotal","TOTAL ≥"],["minEe","EE ≥"],["maxEe","EE ≤"],["minActivity30","Activity 30d ≥"],["maxIdleDays","Last Active ≤ days"],["minFit","Fit ≥"],["minLevel","Level ≥"],["maxLevel","Level ≤"],["minNetworth","Net Worth ≥"],["minActiveStreak","Active Streak ≥"],["minBestStreak","Best Streak ≥"],["minStatEnhancers","Stat Enhancers ≥"],["minXanax30","Xanax 30d ≥"],["minRefills30","Refills 30d ≥"],["minAttacks30","Attacks 30d ≥"],["minRwHits30","RW Hits 30d ≥"],["maxDataAgeDays","Scout Age ≤ days"]]',
    'complete Results numeric filters'
  );

  replaceIn(
    userscript,
    '<label>Scout Status<select class="ra-results-filter" data-filter="scoutStatus"><option value="">Any</option>${ResultsCore.SCOUT_STATUS_ORDER.map(x=>`<option value="${x}" ${f.scoutStatus===x?"selected":""}>${x.toUpperCase()}</option>`).join("")}</select></label></div>`;',
    '<label>Scout Status<select class="ra-results-filter" data-filter="scoutStatus"><option value="">Any</option>${ResultsCore.SCOUT_STATUS_ORDER.map(x=>`<option value="${x}" ${f.scoutStatus===x?"selected":""}>${x.toUpperCase()}</option>`).join("")}</select></label><label>Faction<select class="ra-results-filter" data-filter="faction"><option value="any">Any</option><option value="none" ${f.faction==="none"?"selected":""}>No faction</option><option value="has" ${f.faction==="has"?"selected":""}>Has faction</option></select></label></div>`;',
    'faction Results filter'
  );

  replaceIn(
    userscript,
    '        document.getElementById("ra-results-search").oninput=()=>renderResults();',
    '        let resultsSearchSaveTimer=null;\n        document.getElementById("ra-results-search").oninput=e=>{renderResults();clearTimeout(resultsSearchSaveTimer);resultsSearchSaveTimer=setTimeout(async()=>{const next={...getModeResultsSettings().filters};const value=String(e.target.value||"").trim();if(value)next.search=value;else delete next.search;await saveResultsModeState({filters:next});},250);};',
    'persisted Results search'
  );

  replaceIn(
    userscript,
    '        document.getElementById("ra-select-all").onclick=()=>{resultRows.forEach(r=>selectedIds.add(Number(r.userId)));renderResults();};',
    '        document.getElementById("ra-select-all").onclick=()=>{getProcessedResultRows().forEach(r=>selectedIds.add(Number(r.userId)));renderResults();};',
    'select visible Results only'
  );

  replaceIn(
    userscript,
    '        document.getElementById("ra-scout-all").onclick=()=>runScoutQueue(resultRows.map(x=>x.userId),{source:mode}).catch(e=>setStatus(e.message,true));',
    '        document.getElementById("ra-scout-all").onclick=()=>runScoutQueue(getProcessedResultRows().map(x=>x.userId),{source:mode}).catch(e=>setStatus(e.message,true));',
    'Scout current filtered result set'
  );
}

console.log('Prepared v4.2 tests and Results polish');
