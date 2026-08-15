# Recruitment Agency v4.4 Smart Match Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local-only Smart Match vacancy profiles, candidate metadata, and an interactive hover intelligence card that calculates a transparent 0-100 Match Score without adding permanent clutter to default Results.

**Architecture:** Add a pure `src/match-core.js` module for profile normalization, candidate normalization, component scoring, completeness, and breakdown generation. Keep IndexedDB persistence, profile management, hover lifecycle, and Results integration inside the userscript, with only the minimal Match-value plumbing added to `src/results-core.js`. All Smart Match configuration and candidate data remain local and must never enter the v4.3 Global Intelligence payload.

**Tech Stack:** Vanilla JavaScript userscript, Node 20 `node:test`, IndexedDB, existing Scout/Results/Global core modules.

## Global Constraints

- Version target is `4.4.0`.
- IndexedDB upgrade is additive from version `10` to `11`; never delete or recreate existing stores.
- New local stores are `candidateLocal` keyed by `userId` and `matchProfiles` keyed by `profileId`.
- Smart Match profiles, salary budgets, recruiter notes, desired role/company, availability, Match Score, and Match breakdown remain local only.
- The v4.3 Global Intelligence whitelist must remain exactly unchanged.
- Match and Scout Fit remain separate concepts and separate displayed values.
- Existing Results default columns remain unchanged. `Match` is optional and disabled by default.
- Unknown candidate-specific values are excluded from the Match denominator, not scored as zero.
- No enabled known criteria means Match is unmeasured, not `0`.
- Numeric positive-is-better criteria use `min(actual / target, 1) * weight`.
- Salary uses `min(maxBudget / expectedSalary, 1) * weight` when salary is known and positive.
- Company, role, and availability use full weight for normalized match, zero for known mismatch, and denominator exclusion for unknown.
- Hover information must be usable by mouse and keyboard focus.
- Hover rendering/calculation errors must never block Results rendering or Scout operation.
- Smart Match operations are local and must not consume Torn API calls.
- Torn API scheduler remains capped at `75` calls/minute with at least `800 ms` between script Torn API calls.
- Protected Recruit Scout service endpoints remain forbidden.

---

## File Structure

**Create**
- `src/match-core.js` - pure Smart Match profile/candidate normalization and scoring engine.
- `tests/match-core.test.js` - unit tests for scoring, normalization, completeness, and precedence helpers.

**Modify**
- `src/results-core.js` - expose an optional `match` column/filter/sort value without changing default visible columns.
- `tests/results-core.test.js` - Match sort/filter regression coverage.
- `R4G3RUNN3R-Recruitment-Agency.user.js` - load Match core, IndexedDB v11 stores, local candidate persistence, profile manager, hover card, editing, and result-row Match enrichment.
- `tests/userscript-static.test.js` - version/store/UI/privacy/scheduler invariants.
- `package.json` - bump to `4.4.0` and syntax-check `src/match-core.js`.
- `README.md` - document v4.4 Smart Match, local-only privacy boundary, hover card, and optional Match column/filter.
- `docs/scout-engine.md` - document that Match consumes Scout data locally but is separate from Fit and makes no API requests.

---

### Task 1: Build the pure Smart Match scoring engine

**Files:**
- Create: `src/match-core.js`
- Create: `tests/match-core.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces browser global `window.RA_MatchCore` and CommonJS `module.exports`.
- Produces constants/functions:
  - `CRITERIA_KEYS`
  - `AVAILABILITY_VALUES`
  - `createDefaultProfile(name?)`
  - `normalizeProfile(input)`
  - `normalizeCandidate(input)`
  - `normalizeRole(value)`
  - `normalizeCompany(value)`
  - `normalizeAvailability(value)`
  - `scoreNumeric(actual, target, weight)`
  - `scoreSalary(expectedSalary, maxBudget, weight)`
  - `scoreCategorical(actual, expected, weight, normalizer)`
  - `evaluateMatch({row, candidate, profile})`
  - `mergeCandidateValues({manual, parsed})`
- Consumes only plain objects. No DOM, IndexedDB, Torn API, or Google code.

- [ ] **Step 1: Write failing tests for numeric and salary scoring**

Create `tests/match-core.test.js` with:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const MatchCore = require('../src/match-core');

test('positive numeric criteria scale linearly and cap at full weight', () => {
  assert.deepEqual(MatchCore.scoreNumeric(50, 100, 20), {known:true, earned:10, available:20, ratio:0.5});
  assert.deepEqual(MatchCore.scoreNumeric(150, 100, 20), {known:true, earned:20, available:20, ratio:1});
  assert.deepEqual(MatchCore.scoreNumeric(null, 100, 20), {known:false, earned:0, available:0, ratio:null});
});

test('salary rewards values at or below budget and degrades proportionally above it', () => {
  assert.equal(MatchCore.scoreSalary(2_000_000, 2_000_000, 15).earned, 15);
  assert.equal(MatchCore.scoreSalary(1_500_000, 2_000_000, 15).earned, 15);
  assert.equal(MatchCore.scoreSalary(4_000_000, 2_000_000, 20).earned, 10);
  assert.equal(MatchCore.scoreSalary(null, 2_000_000, 20).known, false);
});
```

- [ ] **Step 2: Run the new tests and verify RED**

Run:

```bash
node --test tests/match-core.test.js
```

Expected: FAIL because `../src/match-core` does not exist.

- [ ] **Step 3: Implement UMD/CommonJS shell and primitive scorers**

Create `src/match-core.js` with this module shape:

```js
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RA_MatchCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CRITERIA_KEYS = Object.freeze([
    'man','int','end','ee','fit','activity30','xanax30','refills30','attacks30','rwHits30',
    'company','role','salary','availability'
  ]);

  const AVAILABILITY_VALUES = Object.freeze(['immediate','soon','flexible','not_available']);

  function finitePositiveOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function scoreNumeric(actual, target, weight) {
    const a = finitePositiveOrNull(actual);
    const t = finitePositiveOrNull(target);
    const w = finitePositiveOrNull(weight) || 0;
    if (a === null || t === null || t <= 0 || w <= 0) return {known:false, earned:0, available:0, ratio:null};
    const ratio = Math.min(a / t, 1);
    return {known:true, earned:ratio * w, available:w, ratio};
  }

  function scoreSalary(expectedSalary, maxBudget, weight) {
    const salary = finitePositiveOrNull(expectedSalary);
    const budget = finitePositiveOrNull(maxBudget);
    const w = finitePositiveOrNull(weight) || 0;
    if (salary === null || budget === null || budget <= 0 || w <= 0) return {known:false, earned:0, available:0, ratio:null};
    const ratio = salary <= 0 ? 1 : Math.min(budget / salary, 1);
    return {known:true, earned:ratio * w, available:w, ratio};
  }
```

Export these functions with the remaining interfaces added in later steps.

- [ ] **Step 4: Write failing tests for categorical normalization and unknown handling**

Add:

```js
test('categorical matching normalizes role/company/availability and excludes unknowns', () => {
  assert.equal(MatchCore.normalizeRole('  Sales   Assistant '), 'sales assistant');
  assert.equal(MatchCore.normalizeCompany('Adult Novelties'), 'adult_novelties');
  assert.equal(MatchCore.normalizeAvailability('Immediate'), 'immediate');

  assert.deepEqual(
    MatchCore.scoreCategorical(' Sales Assistant ', 'sales assistant', 10, MatchCore.normalizeRole),
    {known:true, earned:10, available:10, ratio:1}
  );
  assert.deepEqual(
    MatchCore.scoreCategorical('', 'sales assistant', 10, MatchCore.normalizeRole),
    {known:false, earned:0, available:0, ratio:null}
  );
});
```

- [ ] **Step 5: Implement normalizers and categorical scorer**

Use:

```js
function normalizeRole(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeCompany(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeAvailability(value) {
  const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  const aliases = {now:'immediate',available_now:'immediate',asap:'immediate',later:'soon',negotiable:'flexible'};
  const normalized = aliases[raw] || raw;
  return AVAILABILITY_VALUES.includes(normalized) ? normalized : '';
}

function scoreCategorical(actual, expected, weight, normalizer) {
  const a = normalizer(actual);
  const e = normalizer(expected);
  const w = finitePositiveOrNull(weight) || 0;
  if (!a || !e || w <= 0) return {known:false, earned:0, available:0, ratio:null};
  const ratio = a === e ? 1 : 0;
  return {known:true, earned:ratio * w, available:w, ratio};
}
```

- [ ] **Step 6: Write failing tests for profile/candidate normalization and manual precedence**

Add:

```js
test('manual candidate fields win over parser-derived values', () => {
  const merged = MatchCore.mergeCandidateValues({
    manual: {desiredRole:'Sales Assistant', expectedSalary:2_000_000},
    parsed: {desiredRole:'Manager', expectedSalary:1_000_000, availability:'Immediate'}
  });
  assert.equal(merged.desiredRole, 'Sales Assistant');
  assert.equal(merged.expectedSalary, 2_000_000);
  assert.equal(merged.availability, 'immediate');
});

test('default profile is safe and normalized', () => {
  const p = MatchCore.createDefaultProfile('Bad Decisions - Sales');
  assert.equal(p.name, 'Bad Decisions - Sales');
  assert.ok(p.profileId);
  assert.deepEqual(Object.keys(p.criteria), MatchCore.CRITERIA_KEYS);
});
```

- [ ] **Step 7: Implement profile/candidate normalization**

`createDefaultProfile(name)` returns a local profile with all criteria present and safe defaults. Use meaningful starter weights without imposing requirements the recruiter did not set:

```js
const DEFAULT_CRITERIA = {
  man:{enabled:false,target:0,weight:10},
  int:{enabled:false,target:0,weight:10},
  end:{enabled:false,target:0,weight:10},
  ee:{enabled:true,target:7,weight:15},
  fit:{enabled:true,target:70,weight:20},
  activity30:{enabled:true,target:120,weight:20},
  xanax30:{enabled:false,target:60,weight:10},
  refills30:{enabled:false,target:25,weight:10},
  attacks30:{enabled:false,target:200,weight:10},
  rwHits30:{enabled:false,target:40,weight:10},
  company:{enabled:false,value:'',weight:15},
  role:{enabled:false,value:'',weight:15},
  salary:{enabled:false,max:0,weight:15},
  availability:{enabled:false,value:'',weight:10}
};
```

Generate `profileId` without browser-only APIs by using an optional input ID or a deterministic-safe fallback such as `profile-${Date.now()}-${Math.random().toString(36).slice(2,8)}`.

`normalizeCandidate` returns only:

```js
{
  userId,
  desiredCompany,
  desiredRole,
  expectedSalary,
  availability,
  recruiterNote,
  manualFields,
  createdAt,
  updatedAt
}
```

`mergeCandidateValues` must use `manualFields`/explicit manual values first and parser-derived values only when the corresponding manual value is absent.

- [ ] **Step 8: Write failing end-to-end Match evaluation tests**

Add:

```js
test('evaluateMatch excludes unknown enabled criteria from denominator', () => {
  const profile = MatchCore.normalizeProfile({
    profileId:'p1', name:'Sales', criteria:{
      ee:{enabled:true,target:10,weight:20},
      fit:{enabled:true,target:100,weight:20},
      salary:{enabled:true,max:2_000_000,weight:20}
    }
  });
  const result = MatchCore.evaluateMatch({
    row:{ee:8, fit:90},
    candidate:{expectedSalary:null},
    profile
  });
  assert.equal(result.availableWeight, 40);
  assert.equal(result.earnedWeight, 34);
  assert.equal(result.score, 85);
  assert.equal(result.knownCriteria, 2);
  assert.equal(result.enabledCriteria, 3);
});

test('evaluateMatch returns unmeasured when no enabled criterion is known', () => {
  const profile = MatchCore.normalizeProfile({profileId:'p2',name:'Role',criteria:{role:{enabled:true,value:'sales',weight:10}}});
  const result = MatchCore.evaluateMatch({row:{},candidate:{},profile});
  assert.equal(result.score, null);
  assert.equal(result.availableWeight, 0);
});
```

- [ ] **Step 9: Implement `evaluateMatch` and breakdown generation**

Return:

```js
{
  score,                 // rounded to one decimal or null
  earnedWeight,
  availableWeight,
  knownCriteria,
  enabledCriteria,
  completeness,          // knownCriteria / enabledCriteria, null when none enabled
  breakdown: {
    man:{known,earned,available,ratio,label:'Manual Labor'},
    // ... one key per enabled criterion
  }
}
```

Map row values explicitly:

```js
const values = {
  man: row?.stats?.man ?? row?.man,
  int: row?.stats?.int ?? row?.int,
  end: row?.stats?.end ?? row?.end,
  ee: row?.ee,
  fit: row?.matchInputs?.fit ?? row?.fit,
  activity30: row?.matchInputs?.activity30 ?? row?.activity30,
  xanax30: row?.matchInputs?.xanax30 ?? row?.xanax30,
  refills30: row?.matchInputs?.refills30 ?? row?.refills30,
  attacks30: row?.matchInputs?.attacks30 ?? row?.attacks30,
  rwHits30: row?.matchInputs?.rwHits30 ?? row?.rwHits30,
  company: candidate?.desiredCompany || row?.preferredCompany,
  role: candidate?.desiredRole,
  salary: candidate?.expectedSalary,
  availability: candidate?.availability
};
```

Do not treat `0`, empty strings, or missing values as interchangeable for fields where zero can be a legitimate known numeric value; the primitive scorers already define knownness.

- [ ] **Step 10: Run the pure-core suite**

Run:

```bash
node --test tests/match-core.test.js
```

Expected: PASS.

- [ ] **Step 11: Bump package metadata and syntax command**

Change `package.json` version to `4.4.0` and syntax script to:

```json
"syntax": "node --check src/scout-core.js && node --check src/results-core.js && node --check src/global-core.js && node --check src/match-core.js && node --check R4G3RUNN3R-Recruitment-Agency.user.js"
```

- [ ] **Step 12: Run complete tests and syntax**

Run:

```bash
npm test && npm run syntax
```

Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add src/match-core.js tests/match-core.test.js package.json
git commit -m "feat: add Smart Match scoring core"
```

---

### Task 2: Add optional Match sorting and filtering to Results Core

**Files:**
- Modify: `src/results-core.js`
- Modify: `tests/results-core.test.js`

**Interfaces:**
- Consumes: normalized row property `matchScore` (`number|null`).
- Produces: optional Results column key `match`, numeric filter `minMatch`, sort behavior using the existing missing-last rules.
- Must not alter `DEFAULT_VISIBLE_COLUMNS`.

- [ ] **Step 1: Write failing tests that Match is optional and sortable/filterable**

Add tests equivalent to:

```js
test('Match exists as an optional column but is not visible by default', () => {
  assert.ok(ResultsCore.getColumn('match'));
  assert.equal(ResultsCore.DEFAULT_VISIBLE_COLUMNS.includes('match'), false);
});

test('minMatch filters measured rows and sorting keeps unmeasured Match last', () => {
  const rows = [
    {userId:1,name:'A',matchScore:88},
    {userId:2,name:'B',matchScore:null},
    {userId:3,name:'C',matchScore:72}
  ];
  const filtered = ResultsCore.applyFilters(rows, {minMatch:'80'});
  assert.deepEqual(filtered.map(x=>x.userId), [1]);
  const sorted = ResultsCore.sortRows(rows, {key:'match',direction:'desc'});
  assert.deepEqual(sorted.map(x=>x.userId), [1,3,2]);
});
```

- [ ] **Step 2: Run Results tests and verify RED**

Run:

```bash
node --test tests/results-core.test.js
```

Expected: FAIL because `match`/`minMatch` do not exist yet.

- [ ] **Step 3: Add the optional column definition**

Add to the existing column registry:

```js
{key:'match', label:'Match', type:'number', sortable:true, defaultDirection:'desc'}
```

Do not add it to `DEFAULT_VISIBLE_COLUMNS`.

- [ ] **Step 4: Add `minMatch` to numeric filter handling**

Use the same compact-number parser/invalid-filter behavior as `minFit`. Match filtering must read `row.matchScore` and treat null/unmeasured as non-matching when a minimum Match filter is active.

- [ ] **Step 5: Add Match sort value extraction**

In the existing sort-value function/switch, map `match` to `row.matchScore`. Reuse the existing missing-last comparator rather than creating a second sorting path.

- [ ] **Step 6: Run Results tests and full suite**

Run:

```bash
node --test tests/results-core.test.js
npm test && npm run syntax
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/results-core.js tests/results-core.test.js
git commit -m "feat: add optional Match Results integration"
```

---

### Task 3: Add IndexedDB v11 local candidate and profile persistence

**Files:**
- Modify: `R4G3RUNN3R-Recruitment-Agency.user.js`
- Modify: `tests/userscript-static.test.js`

**Interfaces:**
- Consumes: `window.RA_MatchCore`.
- New stores: `candidateLocal` (`keyPath:'userId'`) and `matchProfiles` (`keyPath:'profileId'`).
- New setting: `match.activeProfileId`.
- Produces functions:
  - `ensureDefaultMatchProfile()`
  - `getActiveMatchProfile()`
  - `saveMatchProfile(profile)`
  - `deleteMatchProfile(profileId)`
  - `getCandidateLocal(userId)`
  - `saveCandidateLocal(userId, patch)`
  - `buildMatchInputRow(row)`
  - `evaluateRowMatch(row)`
  - `refreshMatchScores()`

- [ ] **Step 1: Write failing static assertions for v4.4 module/version/stores**

Require:

```js
test('userscript v4.4 loads Match Core and DB v11 stores', () => {
  const s = source();
  assert.match(s, /@version\s+4\.4\.0/);
  assert.match(s, /SCRIPT_VERSION\s*=\s*["']4\.4\.0["']/);
  assert.match(s, /src\/match-core\.js/);
  assert.match(s, /RA_MatchCore/);
  assert.match(s, /REQUIRED_DB_VERSION\s*=\s*11/);
  assert.match(s, /candidateLocal/);
  assert.match(s, /matchProfiles/);
  assert.doesNotMatch(s, /deleteObjectStore/);
});
```

Add privacy assertions that the v4.3 global payload-building code still does not contain `desiredRole`, `expectedSalary`, `availability`, `recruiterNote`, `matchScore`, or `matchProfiles` inside the global observation mapping.

- [ ] **Step 2: Run static tests and verify RED**

Run:

```bash
node --test tests/userscript-static.test.js
```

Expected: FAIL on v4.4/Match assertions.

- [ ] **Step 3: Load Match Core and bump userscript/DB version**

Metadata:

```js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/match-core.js
```

Startup:

```js
const MatchCore = window.RA_MatchCore;
if (!Core || !ResultsCore || !GlobalCore || !MatchCore) {
  console.error('[RA] Required core module did not load.');
  return;
}
const SCRIPT_VERSION = '4.4.0';
const REQUIRED_DB_VERSION = 11;
```

- [ ] **Step 4: Upgrade IndexedDB additively**

Inside `onupgradeneeded` add:

```js
if (!d.objectStoreNames.contains('candidateLocal')) d.createObjectStore('candidateLocal', {keyPath:'userId'});
if (!d.objectStoreNames.contains('matchProfiles')) d.createObjectStore('matchProfiles', {keyPath:'profileId'});
```

Keep all v4.3 stores intact.

- [ ] **Step 5: Extend local settings with Match state**

Add:

```js
match: {
  activeProfileId: ''
}
```

`mergeSettings` must nested-merge this object exactly as Global/Scout are nested-merged.

- [ ] **Step 6: Implement default profile bootstrap**

```js
async function ensureDefaultMatchProfile() {
  const profiles = await idb.getAll('matchProfiles');
  if (profiles.length) {
    const active = profiles.find(p => p.profileId === settings.match.activeProfileId) || profiles[0];
    if (active.profileId !== settings.match.activeProfileId) await saveMetaSettings({match:{...settings.match,activeProfileId:active.profileId}});
    return MatchCore.normalizeProfile(active);
  }
  const profile = MatchCore.createDefaultProfile('Default Recruit');
  await idb.put('matchProfiles', profile);
  await saveMetaSettings({match:{...settings.match,activeProfileId:profile.profileId}});
  return profile;
}
```

- [ ] **Step 7: Implement candidate persistence with manual-field precedence**

`saveCandidateLocal(userId, patch)` must:

1. load existing record;
2. validate/sanitize via `MatchCore.normalizeCandidate`;
3. mark fields explicitly supplied by the editor in `manualFields`;
4. preserve `createdAt`;
5. update `updatedAt`;
6. store only the local candidate schema.

Do not reuse forum/global objects as the candidate record.

- [ ] **Step 8: Implement row-to-Match input mapping**

`buildMatchInputRow(row)` explicitly maps existing data:

```js
const scout = row.scout || (row.profile ? row : null);
const w = scout?.w30 || scout?.provisionalSource || {};
return {
  ...row,
  fit: snapshotFit(scout),
  matchInputs: {
    fit: snapshotFit(scout),
    activity30: w.activityHours ?? null,
    xanax30: w.xanax ?? null,
    refills30: w.refills ?? null,
    attacks30: w.attacks ?? null,
    rwHits30: w.rwHits ?? null
  }
};
```

- [ ] **Step 9: Implement local evaluation/cache enrichment**

For each `resultRows` row, load the candidate record and active profile, then attach only transient calculated properties:

```js
row.candidateLocal = candidate;
row.matchResult = MatchCore.evaluateMatch({row:buildMatchInputRow(row), candidate, profile});
row.matchScore = row.matchResult.score;
```

Do not persist `matchScore` into Global Intelligence or Scout snapshots.

- [ ] **Step 10: Ensure `refreshResults()` enriches Match before rendering**

After loading existing result rows and before `renderResults()`, call `await refreshMatchScores()`. If Match enrichment fails, catch/log it and still render normal Results.

- [ ] **Step 11: Run static/full tests**

Run:

```bash
npm test && npm run syntax
```

Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add R4G3RUNN3R-Recruitment-Agency.user.js tests/userscript-static.test.js
git commit -m "feat: add local Smart Match persistence"
```

---

### Task 4: Add Match Profile management in Advanced Settings

**Files:**
- Modify: `R4G3RUNN3R-Recruitment-Agency.user.js`
- Modify: `tests/userscript-static.test.js`

**Interfaces:**
- Consumes: Task 3 profile persistence functions.
- Produces UI/functions:
  - `renderMatchProfileManager()`
  - `populateMatchProfileEditor(profile)`
  - `saveMatchProfileFromUI()`
  - `duplicateActiveMatchProfile()`
  - `deleteActiveMatchProfile()`
  - controls `ra-match-profile-select`, `ra-match-profile-new`, `ra-match-profile-duplicate`, `ra-match-profile-delete`, `ra-match-profile-save`.

- [ ] **Step 1: Add failing static tests for Advanced Match Profile controls**

Require these strings/IDs:

```text
Match Profiles
ra-match-profile-select
ra-match-profile-new
ra-match-profile-duplicate
ra-match-profile-delete
ra-match-profile-save
ra-match-criterion-man
ra-match-criterion-fit
ra-match-criterion-salary
ra-match-criterion-availability
```

- [ ] **Step 2: Run static test and verify RED**

Run:

```bash
node --test tests/userscript-static.test.js
```

- [ ] **Step 3: Add the Advanced-only Match Profiles section**

Use one compact section with profile selector/actions followed by a criteria grid. Each numeric criterion row contains:

```html
<label><input type="checkbox" data-match-enabled="fit"> Fit</label>
<input data-match-target="fit" inputmode="decimal">
<input data-match-weight="fit" inputmode="decimal">
```

Categorical rows use a value/max input instead of target. Availability uses a select with blank, Immediate, Soon, Flexible, Not available.

- [ ] **Step 4: Implement profile selection and editor population**

On selector change:

```js
await saveMetaSettings({match:{...settings.match,activeProfileId:selectedId}});
await refreshMatchScores();
renderResults();
```

Do not rescout or make any network calls.

- [ ] **Step 5: Implement create/duplicate/save/delete behavior**

Rules:

- New profile starts from `MatchCore.createDefaultProfile('New Match Profile')`.
- Duplicate deep-copies the normalized active profile with a fresh `profileId`, name `${old.name} Copy`, and new timestamps.
- Save validates all numeric inputs with existing compact-number parsing where appropriate, rejects invalid values visually, normalizes criteria with `MatchCore.normalizeProfile`, stores it, then refreshes Match.
- Delete requires existing project confirmation style, removes only the selected profile, then selects another profile or creates `Default Recruit` when none remain.

- [ ] **Step 6: Run full tests/syntax**

Run:

```bash
npm test && npm run syntax
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add R4G3RUNN3R-Recruitment-Agency.user.js tests/userscript-static.test.js
git commit -m "feat: add Smart Match profile manager"
```

---

### Task 5: Add the hover intelligence card and local candidate editor

**Files:**
- Modify: `R4G3RUNN3R-Recruitment-Agency.user.js`
- Modify: `tests/userscript-static.test.js`

**Interfaces:**
- Consumes: enriched rows with `candidateLocal`, `matchResult`, `matchScore` and Task 3 persistence.
- Produces:
  - `renderCandidateHoverCard(row)`
  - `openCandidateHover(userId, anchor)`
  - `scheduleCandidateHoverOpen(userId, anchor)`
  - `scheduleCandidateHoverClose()`
  - `positionCandidateHover(anchor)`
  - `beginCandidateEdit(userId)`
  - `saveCandidateEdit(userId)`
  - one reusable DOM node `#ra-candidate-hover`.

- [ ] **Step 1: Write failing static assertions for hover and editor behavior**

Require:

```text
ra-candidate-hover
ra-candidate-hover-target
Edit candidate
Desired role
Expected salary
Availability
Recruiter note
MATCH BREAKDOWN
Completeness
```

Also assert code contains `pointerover`, `pointerout`, `focusin`, `focusout`, and `Escape` handling.

- [ ] **Step 2: Run static tests and verify RED**

Run:

```bash
node --test tests/userscript-static.test.js
```

- [ ] **Step 3: Make player names the delegated hover/focus target**

Modify only the Player-cell HTML generated by `displayColumn(row,'player')` to add attributes, not extra visible columns:

```html
<a class="ra-candidate-hover-target" data-candidate-id="3877028" ...>Player Name</a>
```

The existing profile link remains functional.

- [ ] **Step 4: Add one reusable hover-card DOM element**

Mount once with the other windows/panels:

```html
<div id="ra-candidate-hover" role="dialog" aria-label="Candidate intelligence" hidden></div>
```

It is not a draggable managed window and does not persist geometry.

- [ ] **Step 5: Implement delegated hover/focus lifecycle**

Use document/root delegation so rerendered Results rows need no per-row permanent listeners.

State:

```js
const candidateHoverRuntime = {
  userId:null,
  anchor:null,
  openTimer:null,
  closeTimer:null,
  editing:false
};
```

Behavior:

- `pointerover`/`focusin` on `.ra-candidate-hover-target`: schedule open after ~180 ms.
- entering `#ra-candidate-hover`: cancel close timer.
- `pointerout`/`focusout`: schedule close after ~220 ms only when neither target nor card contains the new related target/focus.
- Escape closes immediately.
- only one card open at once.

- [ ] **Step 6: Position card beside the player and clamp to viewport**

`positionCandidateHover(anchor)`:

1. measure anchor/card with `getBoundingClientRect()`;
2. prefer `left = anchor.right + 8`;
3. if card would exceed viewport width, use `anchor.left - card.width - 8`;
4. clamp left/top to at least 6 px and at most viewport minus card dimensions minus 6 px;
5. set `position:fixed`.

Reposition on window resize while open.

- [ ] **Step 7: Render read-only hover card**

Render:

- player name/ID
- active profile name
- Match Score or `Unmeasured`
- Scout Fit
- EE
- Activity 30d
- MAN / INT / END
- candidate Desired Company / Desired Role / Expected Salary / Availability / Recruiter Note
- Match Breakdown, one enabled criterion per line with ratio percent or `Unknown`
- Completeness as `${knownCriteria} / ${enabledCriteria} criteria known`
- buttons `Edit candidate` and `Scout`

All user-provided text must pass through the existing HTML escape helper.

- [ ] **Step 8: Implement in-card candidate editing**

Editor controls:

```text
Desired company: select using existing company keys plus blank
Desired role: text input
Expected salary: compact-number input
Availability: select blank/immediate/soon/flexible/not available
Recruiter note: textarea
```

On save:

```js
await saveCandidateLocal(userId, {
  desiredCompany,
  desiredRole,
  expectedSalary,
  availability,
  recruiterNote,
  manualFields:{desiredCompany:true,desiredRole:true,expectedSalary:true,availability:true}
});
await refreshMatchScores();
renderResults();
await openCandidateHover(userId, candidateHoverRuntime.anchor);
```

Reject invalid salary rather than storing `0`.

- [ ] **Step 9: Add optional Match display and filter control without changing defaults**

In `displayColumn(row,key)`:

```js
if (key === 'match') return row.matchScore == null ? '—' : Number(row.matchScore).toFixed(1);
```

Add `['minMatch','Match ≥']` to the existing detailed Results numeric filters. Do not add Match to `DEFAULT_VISIBLE_COLUMNS`.

- [ ] **Step 10: Make candidate edits/profile changes recalculate immediately**

After candidate save, profile save, profile switch, and profile deletion, call:

```js
await refreshMatchScores();
renderResults();
```

No network or Scout request is permitted for recalculation.

- [ ] **Step 11: Run full tests/syntax**

Run:

```bash
npm test && npm run syntax
```

Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add R4G3RUNN3R-Recruitment-Agency.user.js tests/userscript-static.test.js
git commit -m "feat: add Smart Match candidate hover card"
```

---

### Task 6: Privacy regression, documentation, and final verification

**Files:**
- Modify: `README.md`
- Modify: `docs/scout-engine.md`
- Modify: `tests/userscript-static.test.js`
- Modify: `tests/global-core.test.js` only if a stronger invariant belongs there; do not change the global whitelist.

**Interfaces:**
- Documentation and regression tests are the public contract for v4.4.

- [ ] **Step 1: Add explicit privacy regression tests**

Assert the exact Global whitelist remains:

```js
assert.deepEqual(GlobalCore.GLOBAL_FIELDS, [
  'playerId','name','observedAt','level','ee','activity30','xanax30','refills30',
  'attacks30','rwHits30','networth','fit','fitType','lastActive','scoutStatus','sourceVersion'
]);
```

Add static assertions that candidate/private strings do not appear in `buildGlobalObservation` / `GlobalCore.buildObservePayload` serialization paths.

- [ ] **Step 2: Add scheduler/security regressions if not already present**

Require:

```text
MIN_API_GAP_MS = 800
clampScoutRate maximum 75
no rs.dnonetwork.com
no /api/grade
no script-session
no deleteObjectStore
```

- [ ] **Step 3: Update README with a `Smart Match v4.4` section**

Document:

- Fit = general player activity/value signal.
- Match = suitability for the active local vacancy profile.
- Match Profiles are local only.
- Candidate Desired Role, Desired Company, Expected Salary, Availability, Recruiter Note are local only.
- Default Results columns are unchanged.
- Hover player name to see Match/candidate intelligence.
- Match can optionally be enabled as a column, sorted, and filtered.
- Unknown values are excluded from denominator and completeness is shown.
- No Smart Match action consumes Torn API calls.

- [ ] **Step 4: Update Scout engine docs**

Add a Smart Match integration section explaining:

```text
Scout -> supplies local Fit/activity inputs
CandidateLocal -> supplies recruiter/candidate context
Match Profile -> supplies vacancy requirements
Match Core -> calculates local Match + breakdown
```

State that Match is never written into Scout history or Global Intelligence and can be recalculated instantly when recruiter rules change.

- [ ] **Step 5: Run the complete verification suite**

Run:

```bash
npm test
npm run syntax
```

Expected: all unit/static tests pass; all JavaScript parses.

- [ ] **Step 6: Manually verify final static invariants**

Check the final tree contains:

```text
@version 4.4.0
SCRIPT_VERSION 4.4.0
package.json 4.4.0
REQUIRED_DB_VERSION 11
candidateLocal store
matchProfiles store
match-core.js @require
Match absent from DEFAULT_VISIBLE_COLUMNS
v4.3 GLOBAL_FIELDS unchanged
75/min Torn hard cap
800ms minimum Torn gap
no forbidden Recruit Scout backend strings
```

- [ ] **Step 7: Commit documentation/regressions**

```bash
git add README.md docs/scout-engine.md tests/userscript-static.test.js tests/global-core.test.js
git commit -m "docs: document v4.4 Smart Match"
```

- [ ] **Step 8: Verify exact final HEAD in GitHub Actions**

Confirm `.github/workflows/test.yml` on the final HEAD shows:

```text
Run unit tests: success
Check JavaScript syntax: success
```

Do not claim authenticated live Torn DOM testing unless it was actually performed.

---

## Plan Self-Review

### Spec coverage

- Pure scoring and normalization: Task 1.
- Unknown denominator/completeness: Task 1.
- Salary/categorical rules: Task 1.
- Optional Match Results sort/filter/column without default clutter: Task 2 + Task 5.
- IndexedDB v11 stores and local-only persistence: Task 3.
- Manual candidate precedence: Task 1 + Task 3.
- Advanced Match Profile CRUD/active profile: Task 4.
- Hover card, mouse/focus accessibility, positioning, edit-in-place: Task 5.
- No API calls for Match recalculation: Tasks 3-5 and docs.
- Global Intelligence privacy boundary unchanged: Task 6.
- Version/scheduler/protected-backend regressions: Task 6.
- README/Scout docs/final CI: Task 6.

### Placeholder scan

No `TBD`, `TODO`, `implement later`, vague error-handling steps, or undefined neighboring interfaces remain. Each implementation step names exact functions/properties and test commands.

### Type/name consistency

The plan consistently uses `RA_MatchCore`, `candidateLocal`, `matchProfiles`, `match.activeProfileId`, `matchScore`, `matchResult`, `evaluateMatch`, `refreshMatchScores`, and userscript/DB versions `4.4.0` / `11` across tasks.
