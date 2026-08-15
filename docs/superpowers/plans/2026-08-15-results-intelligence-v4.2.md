# Recruitment Agency v4.2 Results Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Recruitment Agency v4.2.0 with a simple-by-default Results window, reusable sortable/filterable column model, per-mode persistence, richer recruitment fields, safer controls, and consistent Table/Card/CSV ordering.

**Architecture:** Add `src/results-core.js` as a pure UMD/CommonJS-compatible module beside `src/scout-core.js`. The userscript owns IndexedDB, Torn API, DOM rendering, and operations; `results-core.js` owns value parsing, column metadata, stable comparison, filters, Preferred Company normalization, Last Active normalization, and Scout freshness classification. All visible Results outputs consume one processed array.

**Tech Stack:** Vanilla JavaScript userscript, Torn API v2, IndexedDB, Node.js built-in `node:test`, GitHub Actions.

## Global Constraints

- Release version is **4.2.0**.
- Fresh Results UI is compact: Name/ID search plus closed **Filters** and **Columns** panels.
- Default visible columns are `Player | EE | Preferred Company | Activity | Last Active | Fit`.
- Detailed filters default empty and hidden; hidden active filters must be disclosed with a count.
- Sort/filter/visible-column state persists separately for Company, Faction, and Scout.
- Missing sort values always stay last in both directions.
- Table, Cards, and CSV must consume the same filtered/sorted row order.
- K/M/B numeric filters are case-insensitive and invalid text must not silently become zero.
- Preferred Company parsing is conservative and must not guess ambiguous text.
- Existing IndexedDB data and Scout history must survive unchanged.
- Torn API scheduling remains hard-capped at **75 calls per minute**, with at least **800 ms** global spacing at the cap.
- No dependency on Recruit Scout, `rs.dnonetwork.com`, membership/session endpoints, or proprietary grading APIs.
- Community/shared-history backend work is explicitly out of scope for v4.2.

---

## File Structure

- Create `src/results-core.js`: pure Results Intelligence functions and column definitions.
- Create `tests/results-core.test.js`: unit tests for parser/sort/filter/status behavior.
- Modify `R4G3RUNN3R-Recruitment-Agency.user.js`: v4.2 metadata, Results UI, persistence, rendering, window reset, busy state, sidebar recovery.
- Modify `tests/userscript-static.test.js`: v4.2 integration/safety contract.
- Modify `README.md`: document compact Results, sortable headers, Filters/Columns, new fields, and v4.2 behavior.
- Modify `docs/scout-engine.md`: document how Results consumes Scout Activity/Last Active/freshness without changing Scout API scheduling.

---

### Task 1: Build and test the pure Results Intelligence module

**Files:**
- Create: `src/results-core.js`
- Create: `tests/results-core.test.js`

**Interfaces:**
- Produces `window.RA_ResultsCore` in browsers and `module.exports` in Node.
- Produces `DEFAULT_VISIBLE_COLUMNS = ['player','ee','preferredCompany','activity30','lastActive','fit']`.
- Produces `DEFAULT_SORT = { key: 'fit', direction: 'desc' }`.
- Produces `SCOUT_STATUS_RANK` with `live,fresh,cached,provisional,stale,failed,unscouted` in that order.
- Produces functions:
  - `parseCompactNumber(value) -> { valid:boolean, empty:boolean, value:number|null }`
  - `normalizeCompany(value) -> string`
  - `parsePreferredCompany(text) -> string`
  - `formatCompany(key) -> string`
  - `idleSeconds(row, nowMs=Date.now()) -> number|null`
  - `classifyScoutStatus(row, nowMs=Date.now(), freshMs=12*60*60*1000) -> string`
  - `getColumn(key) -> column|null`
  - `sortRows(rows, sortState, nowMs) -> new array`
  - `applyFilters(rows, filters, nowMs) -> new array`
  - `processRows(rows, filters, sortState, nowMs) -> new array`
  - `activeFilterCount(filters) -> number`

- [ ] **Step 1: Write failing unit tests for compact numeric parsing**

Create tests that require:

```js
assert.deepEqual(R.parseCompactNumber('50k'), {valid:true, empty:false, value:50000});
assert.deepEqual(R.parseCompactNumber('2.5M'), {valid:true, empty:false, value:2500000});
assert.deepEqual(R.parseCompactNumber('1b'), {valid:true, empty:false, value:1000000000});
assert.equal(R.parseCompactNumber('').empty, true);
assert.equal(R.parseCompactNumber('potato').valid, false);
```

- [ ] **Step 2: Run `npm test` and verify failure because `src/results-core.js` does not exist**

Expected: FAIL from module resolution.

- [ ] **Step 3: Implement UMD wrapper and `parseCompactNumber`**

Accept optional commas, whitespace, decimal values, and one optional K/M/B suffix. Reject non-finite, negative syntax errors, trailing junk, and multiple suffixes. Empty input returns `{valid:true, empty:true, value:null}`.

- [ ] **Step 4: Add failing tests for Preferred Company normalization**

Require explicit examples:

```js
assert.equal(R.parsePreferredCompany('Looking for Adult Novelties, preferably 10*'), 'adult_novelties');
assert.equal(R.parsePreferredCompany('Prefer AN, salary flexible'), 'adult_novelties');
assert.equal(R.parsePreferredCompany('Looking for a logistics company'), 'logistics_management');
assert.equal(R.parsePreferredCompany('Looking for 10* PSF'), 'private_security_firm');
assert.equal(R.parsePreferredCompany('I used to work in AN but want anything'), '');
```

The parser may use explicit intent phrases such as `looking for`, `prefer`, `seeking`, `want`, `after`, followed by recognized company names/approved abbreviations. It must not return a company merely because a company name appears elsewhere in prose.

- [ ] **Step 5: Implement company aliases and conservative parser**

Normalize the existing Torn company keys and supported explicit aliases including `AN`, `PSF`, `LM`, `Oil Rig`, `Adult Novelties`, and full company names. `formatCompany` returns title-case display text.

- [ ] **Step 6: Add failing tests for sorting and missing-value-last behavior**

Use fixtures containing `ee`, `preferredCompany`, `scout.metrics.activityHours`, `profile.lastActionTs`, `fit`, `trend`, working stats, and missing values. Verify:

```js
assert.deepEqual(ids(R.sortRows(rows,{key:'ee',direction:'desc'},now)), [high,low,missing]);
assert.deepEqual(ids(R.sortRows(rows,{key:'ee',direction:'asc'},now)), [low,high,missing]);
```

Also verify text A-Z/Z-A, Last Active newest/oldest, Scout Status rank, and deterministic ties by lower-cased player name then numeric Torn ID.

- [ ] **Step 7: Implement column definitions and stable comparator**

Column getters must support normalized combined rows with forum fields plus optional `scout` snapshot. Required getters include player name, MAN/INT/END/TOTAL, EE, Preferred Company, Fit, Trend, Activity 30d, Last Active, Scout Status, Level, Xanax, Refills, Attacks, RW Hits, Net Worth, Active Streak, Best Streak, post/discovery timestamp, and Scout age.

Treat `null`, `undefined`, empty string, and non-finite numeric values as missing. Zero remains a real value.

- [ ] **Step 8: Add failing tests for filters and active filter count**

Verify combined filters for search, numeric minimums, EE, company, Activity 30d, max idle days, Fit, level range, Net Worth, Scout Status, faction state, streaks, stat enhancers, Xanax/refills/attacks/RW hits, and data-age limits. Invalid numeric parser results must not be converted to zero by core filtering.

- [ ] **Step 9: Implement `applyFilters`, `activeFilterCount`, and `processRows`**

`processRows` must call filtering first and sorting second and never mutate the caller's array.

- [ ] **Step 10: Run `npm test`**

Expected: all Results core tests pass alongside existing Scout tests.

- [ ] **Step 11: Commit**

Commit message: `feat: add Results Intelligence core`

---

### Task 2: Define the v4.2 userscript contract before integration

**Files:**
- Modify: `tests/userscript-static.test.js`

**Interfaces:**
- Consumes the v4.2 design and `results-core.js` public names from Task 1.
- Produces static tests that fail against v4.1 and protect the integration while editing the large userscript.

- [ ] **Step 1: Update version expectations to 4.2.0**

Require both userscript header and `SCRIPT_VERSION` to be `4.2.0`.

- [ ] **Step 2: Add a failing test for the Results core dependency**

Require:

```js
/@require\s+https:\/\/raw\.githubusercontent\.com\/R4G3RUNN3R\/Torn-Recruitment-Agency\/main\/src\/results-core\.js/
```

and `window.RA_ResultsCore` initialization.

- [ ] **Step 3: Add failing tests for compact Results controls**

Require identifiers/text for:

- `ra-results-search`
- `ra-results-filters-toggle`
- `ra-results-columns-toggle`
- `ra-results-filters`
- `ra-results-columns`
- `ra-clear-filters`
- `aria-sort`
- `data-sort-key`

Require default column keys `player`, `ee`, `preferredCompany`, `activity30`, `lastActive`, `fit`.

- [ ] **Step 4: Add failing tests for persistence and operations polish**

Require names/markers:

- `resultsByMode`
- `normalizeResultsSettings`
- `resetWindowLayout`
- `syncBusyControls`
- `scheduleSidebarRecovery`
- `SIDEBAR_RETRY`

- [ ] **Step 5: Keep every existing safety assertion**

Retain the 75/min hard cap, 800 ms spacing, additive IndexedDB, Scout/history, theme, sidebar fallback, and no Recruit Scout backend tests unchanged except version-specific text.

- [ ] **Step 6: Commit the red contract**

Commit message: `test: define v4.2 Results Intelligence contract`

---

### Task 3: Integrate v4.2 Results state, filters, columns, sorting, Cards, and CSV

**Files:**
- Modify: `R4G3RUNN3R-Recruitment-Agency.user.js`

**Interfaces:**
- Consumes `window.RA_ResultsCore` as `ResultsCore`.
- Consumes `ResultsCore.DEFAULT_VISIBLE_COLUMNS`, `DEFAULT_SORT`, `processRows`, `parseCompactNumber`, `activeFilterCount`, `getColumn`, `classifyScoutStatus`, `parsePreferredCompany`, and `formatCompany`.
- Produces `settings.resultsByMode` normalized separately for `company`, `faction`, and `scout`.
- Produces UI helpers `normalizeResultsSettings`, `getModeResultsSettings`, `readResultsFiltersFromUI`, `renderResultsFilterPanel`, `renderResultsColumnsPanel`, `setResultsSort`, `getProcessedResultRows`, and `renderResults`.

- [ ] **Step 1: Bump metadata/version and load Results core**

Set header and `SCRIPT_VERSION` to `4.2.0`, add Results core `@require` after Scout core, and abort with a clear console error if either required core is absent.

- [ ] **Step 2: Add additive default/migration state**

Replace the single `resultSort` source of truth with:

```js
resultsByMode: {
  company: {sort:{key:'fit',direction:'desc'},filters:{},visibleColumns:[...]},
  faction: {sort:{key:'fit',direction:'desc'},filters:{},visibleColumns:[...]},
  scout: {sort:{key:'fit',direction:'desc'},filters:{},visibleColumns:[...]}
},
resultsPanels: {filtersOpen:false, columnsOpen:false}
```

`normalizeResultsSettings` must merge old settings additively, migrate the old `resultSort` key (`fit`, `recent`, `trend`, `name`, `level`, `networth`) to the matching v4.2 sort key/direction, and never delete old metadata or IndexedDB stores.

- [ ] **Step 3: Remove the main-window Sort dropdown from the default/simple UI**

Results sorting is driven by Results headers. Do not replace it with another always-visible selector.

- [ ] **Step 4: Replace Results toolbar markup with compact controls**

Use:

```text
Search [............] [Filters] [Columns] [Clear Filters when active]
<meta/status> [Refresh] [Select all] [Clear selection] [Copy CSV]
```

Render `#ra-results-filters` and `#ra-results-columns` closed by default for new users. The Filters button text includes the active count when nonzero.

- [ ] **Step 5: Build filter UI from explicit supported fields**

Include search plus detailed fields from the design. Numeric inputs should be text inputs where K/M/B is allowed. Parse each with `ResultsCore.parseCompactNumber`; invalid fields receive `.ra-invalid`, set `aria-invalid="true"`, and do not update persisted filter state until corrected/cleared.

- [ ] **Step 6: Build Columns UI**

Render checkboxes from Results core column definitions. Prevent removal of every column; Player remains always visible. Persist the remaining selected keys for the active mode.

- [ ] **Step 7: Normalize forum and Scout rows into one Results shape**

Each row supplied to Results core must expose a stable `userId`, name, forum stats/EE/company/raw text, optional profile/API fields, and optional Scout snapshot. For forum rows, populate `preferredCompany` using existing explicit company field first and `ResultsCore.parsePreferredCompany(rawText)` as the conservative fallback.

- [ ] **Step 8: Route all filtering/sorting through one processed array**

`getProcessedResultRows()` must call:

```js
ResultsCore.processRows(resultRows, modeState.filters, modeState.sort, Date.now())
```

after applying the visible search value. Selection does not alter order.

- [ ] **Step 9: Render sortable Table headers**

Each sortable `<th>` contains a button or full-cell interactive target with `data-sort-key`. Active key shows `↑`/`↓` and correct `aria-sort="ascending|descending"`; inactive headers use `aria-sort="none"`.

Clicking a new key applies its column default direction. Clicking the active key toggles direction. Persist and rerender without API calls.

- [ ] **Step 10: Render Cards from the same processed rows**

Cards use the same mode visibleColumns array and same processed rows. Switching view changes presentation only.

- [ ] **Step 11: Make CSV consume the same processed rows and visible columns**

Generate header labels from selected column definitions and rows in exactly the current displayed order. CSV generation must not call a second sorter/filter implementation.

- [ ] **Step 12: Update Results metadata/status text**

Display candidate count, active sort label/direction, active filter count, and current mode. Example: `37 candidates · Activity ↓ · 3 filters`.

- [ ] **Step 13: Run GitHub Actions through a pushed commit**

Expected: Results core unit tests pass; static userscript contract should now pass for Results integration except Task 4 markers if not yet implemented.

- [ ] **Step 14: Commit**

Commit message: `feat: add sortable filterable Results workspace`

---

### Task 4: Add window reset, busy-state UX, and bounded Torn SPA recovery

**Files:**
- Modify: `R4G3RUNN3R-Recruitment-Agency.user.js`

**Interfaces:**
- Produces `resetWindowLayout()`.
- Produces `syncBusyControls()`.
- Produces `scheduleSidebarRecovery(reason)` and a bounded retry constant/object containing `SIDEBAR_RETRY`.

- [ ] **Step 1: Implement Reset Window Layout**

Add an Advanced Settings button `#ra-reset-window-layout`. `resetWindowLayout()` removes only saved `windowGeometry.main`, `.results`, and `.history` entries from metadata, applies each registered window's default geometry through the existing clamp/window manager, and persists the restored geometry.

Do not reset API key, filters, Scout data, history, theme, or other settings.

- [ ] **Step 2: Implement a single busy-state synchronizer**

`syncBusyControls()` disables conflicting start controls when `forumScanning || scoutRuntime.running`:

- Full Scan
- Update Scan
- Scout IDs
- Scout Search Users Page
- Scout Selected
- Scout All

Keep Cancel enabled only while Scout is running and keep Pause/Resume semantics unchanged. Call the synchronizer at every scan/Scout start and in every `finally` path.

- [ ] **Step 3: Add short sidebar retry burst**

Define bounded retry settings such as:

```js
const SIDEBAR_RETRY = { attempts: 12, delayMs: 250, debounceMs: 600 };
```

On mount/navigation, attempt immediate insertion then schedule at most the configured attempts. Stop early once mounted.

- [ ] **Step 4: Debounce the MutationObserver path**

Use one timer-backed `scheduleSidebarRecovery()` so a mutation burst causes one delayed recovery rather than repeated full DOM scans. Keep launcher ID deduplication and floating fallback logic.

- [ ] **Step 5: Bind `hashchange` and `popstate` to recovery without adding duplicate listeners**

Navigation recovery should not trigger Torn API calls.

- [ ] **Step 6: Run `npm test` in CI after commit**

Expected: all static markers and existing safety tests pass.

- [ ] **Step 7: Commit**

Commit message: `feat: harden v4.2 window and operation UX`

---

### Task 5: Documentation and release verification

**Files:**
- Modify: `README.md`
- Modify: `docs/scout-engine.md`

**Interfaces:**
- Documents shipped behavior only; no speculative community-history backend claims.

- [ ] **Step 1: Update README version/features**

Document v4.2 compact Results, clickable headers, per-mode filters/columns, EE/Preferred Company/Activity/Last Active/Scout Status, K/M/B inputs, CSV matching the current view, and Reset Window Layout.

- [ ] **Step 2: Update Scout documentation**

Explain that Activity 30d, Last Active, and Scout freshness feed the Results layer while Scout collection/caching/API scheduling remain unchanged at the 75/min hard cap and 12-hour freshness model.

- [ ] **Step 3: Fetch the final userscript and tests from GitHub and inspect version/dependencies**

Verify `4.2.0`, both raw `@require` URLs, no protected Recruit Scout backend strings, and additive DB version behavior.

- [ ] **Step 4: Verify the latest GitHub Actions run**

Confirm unit tests and JavaScript syntax checks are successful. Do not claim browser/Torn visual verification because CI cannot reproduce an authenticated live Torn DOM.

- [ ] **Step 5: Commit documentation**

Commit message: `docs: document Recruitment Agency v4.2`

- [ ] **Step 6: Report release evidence**

Provide final HEAD SHA, successful Actions run/job IDs, raw userscript URL, implemented scope, and any live-Torn behaviors that remain unverified.
