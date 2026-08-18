# Property Rental Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Torn userscript that scans owned properties and current rental-market listings, recommends competitive rent, and prepares one native lease form per explicit user action without auto-submitting Torn game actions.

**Architecture:** The project lives under `property-rental-manager/` inside the existing repository but is isolated from Recruitment Agency runtime code. Pure property/pricing/draft/form modules are tested independently, API access is centralized behind a scheduler, and the final userscript bundles the modules into one installable file.

**Tech Stack:** JavaScript (UMD/CommonJS-compatible modules), Tampermonkey userscript APIs, Torn v2 API, browser `localStorage`/`sessionStorage`, Node 20 `node:test`, jsdom.

**Spec:** `docs/superpowers/specs/2026-08-18-property-rental-manager-design.md`

## Global Constraints

- Torn API calls must have at least **800 ms** spacing.
- Torn API calls must stay below a hard **75 calls per rolling minute**.
- API keys must be sent only through `Authorization: ApiKey {key}` headers to `api.torn.com` and never embedded in URLs.
- No programmatic native rental submission.
- No automatic `.click()` on Torn controls that cause a game request.
- No background non-API requests to `torn.com`.
- Default rental period is **30 days**, validated to **1-365 days**.
- Default undercut is **0.5%**.
- Default minimum median ratio is **0.70**.
- Desktop UI must be movable and resizable with persistent geometry.
- Simple and Advanced modes must both remain usable in dark and light themes.
- The installed userscript must match `https://www.torn.com/properties.php*` only.

---

### Task 1: Pure property and pricing engines

**Files:**
- Create: `property-rental-manager/src/property-core.js`
- Create: `property-rental-manager/src/market-core.js`
- Create: `property-rental-manager/tests/property-core.test.js`
- Create: `property-rental-manager/tests/market-core.test.js`

**Interfaces:**
- Produces `PropertyCore.normalizeProperty(raw, currentUserId)`, `PropertyCore.normalizeProperties(rows, currentUserId)`, `PropertyCore.isEligibleForLease(property)`, `PropertyCore.leaseUrl(propertyId)`, `PropertyCore.uniquePropertyTypeIds(properties)`.
- Produces `MarketCore.normalizeRental(raw)`, `MarketCore.happySimilarity(ownedHappy, listingHappy)`, `MarketCore.modificationSimilarity(a, b)`, `MarketCore.similarity(owned, listing)`, `MarketCore.selectComparables(owned, listings)`, `MarketCore.marketStats(owned, listings, settings)`.

- [ ] **Step 1: Write failing property-core tests**

Create tests that assert:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const PropertyCore = require('../src/property-core');

test('normalizes only properties owned by current user', () => {
  const rows = [
    { id: 10, property: { id: 13, name: 'Private Island' }, owner: { id: 3877028 }, happy: 4500, status: 'none', modifications: ['Airstrip'] },
    { id: 11, property: { id: 13, name: 'Private Island' }, owner: { id: 999 }, happy: 4500, status: 'none', modifications: [] }
  ];
  const out = PropertyCore.normalizeProperties(rows, '3877028');
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 10);
  assert.equal(out[0].propertyTypeId, 13);
});

test('lease eligibility is restricted to status none', () => {
  assert.equal(PropertyCore.isEligibleForLease({ status: 'none' }), true);
  for (const status of ['in_use', 'for_sale', 'rented', 'for_rent']) {
    assert.equal(PropertyCore.isEligibleForLease({ status }), false);
  }
});

test('builds native lease hash URL', () => {
  assert.equal(PropertyCore.leaseUrl(123), 'https://www.torn.com/properties.php#/p=options&ID=123&tab=lease');
});
```

- [ ] **Step 2: Run property-core tests and verify failure**

Run:

```bash
node --test property-rental-manager/tests/property-core.test.js
```

Expected: FAIL because `property-core.js` does not exist yet.

- [ ] **Step 3: Implement property-core**

Implement a UMD module that:

```js
function normalizeProperty(raw, currentUserId) {
  const ownerId = String(raw?.owner?.id ?? raw?.owner_id ?? '');
  if (currentUserId && ownerId && ownerId !== String(currentUserId)) return null;
  return {
    id: Number(raw?.id ?? raw?.property_id ?? 0),
    propertyTypeId: Number(raw?.property?.id ?? raw?.property_type_id ?? raw?.type_id ?? 0),
    name: String(raw?.property?.name ?? raw?.name ?? 'Unknown property'),
    ownerId,
    happy: Number(raw?.happy ?? raw?.property?.happy ?? 0),
    status: String(raw?.status ?? '').toLowerCase(),
    modifications: [...new Set((raw?.modifications || []).map(v => typeof v === 'string' ? v : v?.name).filter(Boolean))],
    raw
  };
}
```

`isEligibleForLease` returns true only for normalized status `none`.

`uniquePropertyTypeIds` returns sorted unique positive numeric IDs from normalized properties.

- [ ] **Step 4: Run property-core tests and verify pass**

Run the same command. Expected: PASS.

- [ ] **Step 5: Write failing market-core tests**

Cover exact formulas from the spec:

```js
test('calculates happy and modification similarity', () => {
  assert.equal(MarketCore.happySimilarity(4500, 4500), 1);
  assert.equal(MarketCore.happySimilarity(4500, 4050), 0.9);
  assert.equal(MarketCore.modificationSimilarity(['A','B'], ['B','C']), 1/3);
});

test('widens comparable threshold when exact-like sample is too small', () => {
  const owned = { happy: 4500, modifications: [] };
  const listings = [
    { id: 1, happy: 4500, modifications: [], cost_per_day: 100 },
    { id: 2, happy: 4490, modifications: [], cost_per_day: 101 },
    { id: 3, happy: 4000, modifications: [], cost_per_day: 102 },
    { id: 4, happy: 3950, modifications: [], cost_per_day: 103 },
    { id: 5, happy: 3900, modifications: [], cost_per_day: 104 }
  ];
  assert.equal(MarketCore.selectComparables(owned, listings).length, 5);
});

test('removes extreme outliers and applies undercut with median floor', () => {
  const owned = { happy: 4500, modifications: [] };
  const listings = [100,101,102,103,104,105,106,1000].map((p, i) => ({ id:i+1, happy:4500, modifications:[], cost_per_day:p }));
  const stats = MarketCore.marketStats(owned, listings, { undercutPercent:0.5, minimumMedianRatio:0.70 });
  assert.equal(stats.marketFloor, 100);
  assert.equal(stats.median, 103);
  assert.equal(stats.suggestedDaily, 99);
  assert.equal(stats.confidence, 'Medium');
});
```

- [ ] **Step 6: Run market-core tests and verify failure**

Run:

```bash
node --test property-rental-manager/tests/market-core.test.js
```

Expected: FAIL because `market-core.js` does not exist yet.

- [ ] **Step 7: Implement market-core**

Implement:

- defensive rental normalization for snake_case/camelCase fields
- `happyScore = max(0, 1 - abs(listingHappy-ownedHappy)/max(ownedHappy,1))`
- Jaccard modification similarity with `1` when both sets are empty
- final similarity `happyScore * 0.7 + modScore * 0.3`
- comparable tiers `>=0.90`, then `>=0.75`, then top 10; max 30
- Tukey IQR cleaning when at least 4 prices exist; fall back when trimming leaves <3
- percentile interpolation for Q1/Q3 and arithmetic median
- `suggestedDaily = max(floor(floorPrice*(1-undercut/100)), floor(median*minimumMedianRatio))`
- confidence grades exactly as the spec defines

Return a stable stats object containing `marketFloor`, `q1`, `median`, `q3`, `sampleSize`, `averageSimilarity`, `suggestedDaily`, `confidence`, and selected comparable IDs.

- [ ] **Step 8: Run both Task 1 test files**

```bash
node --test property-rental-manager/tests/property-core.test.js property-rental-manager/tests/market-core.test.js
```

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add property-rental-manager/src/property-core.js property-rental-manager/src/market-core.js property-rental-manager/tests/property-core.test.js property-rental-manager/tests/market-core.test.js
git commit -m "feat: add property rental pricing engines"
```

---

### Task 2: API scheduler and Torn v2 client

**Files:**
- Create: `property-rental-manager/src/api-core.js`
- Create: `property-rental-manager/tests/api-core.test.js`

**Interfaces:**
- Consumes `PropertyCore.uniquePropertyTypeIds(properties)`.
- Produces `ApiCore.createScheduler(options)`, `ApiCore.createClient(options)`, `client.fetchOwnedProperties()`, `client.fetchRentalMarket(propertyTypeId, { force })`, `client.scanMarkets(properties, { force })`.

- [ ] **Step 1: Write failing scheduler/client tests**

Use a fake clock and injected fetch implementation. Required assertions:

```js
test('uses Authorization header and never puts API key in URL', async () => {
  const calls = [];
  const client = ApiCore.createClient({
    apiKey:'secret-key',
    fetchImpl: async (url, init) => { calls.push({url, init}); return okJson({ properties: [] }); },
    now: () => 0,
    sleep: async () => {}
  });
  await client.fetchOwnedProperties();
  assert.match(calls[0].url, /^https:\/\/api\.torn\.com\/v2\/user\/properties/);
  assert.equal(calls[0].url.includes('secret-key'), false);
  assert.equal(calls[0].init.headers.Authorization, 'ApiKey secret-key');
});

test('deduplicates property types during market scan', async () => {
  const seen = [];
  const client = makeClientReturningMarkets(seen);
  await client.scanMarkets([{propertyTypeId:13},{propertyTypeId:13},{propertyTypeId:10}]);
  assert.deepEqual(seen.sort(), [10,13]);
});
```

Also test:

- minimum 800 ms scheduling gap
- maximum 75 timestamps in a rolling 60-second window
- same-origin `api.torn.com` continuation validation
- property pagination
- rental pagination
- fresh cache reuse and `force:true` bypass
- thrown messages redact the supplied key

- [ ] **Step 2: Run API tests and verify failure**

```bash
node --test property-rental-manager/tests/api-core.test.js
```

Expected: FAIL because `api-core.js` does not exist yet.

- [ ] **Step 3: Implement the scheduler**

`createScheduler({ minGapMs=800, maxPerMinute=75, now=Date.now, sleep })` maintains a request-start timestamp queue. Before every request it:

1. drops timestamps older than 60,000 ms
2. waits until `lastStartedAt + 800`
3. if 75 starts remain in the rolling window, waits until the oldest start is 60,000 ms old
4. records the start immediately before invoking the request

All client traffic passes through this one scheduler instance.

- [ ] **Step 4: Implement the Torn API client**

Rules:

```js
const API_ORIGIN = 'https://api.torn.com';
const API_BASE = `${API_ORIGIN}/v2`;
```

- Send `Accept: application/json` and `Authorization: ApiKey ${apiKey}`.
- Accept continuation URLs only when `new URL(next).origin === API_ORIGIN` and pathname starts with `/v2/`.
- Support response shapes where collections are direct arrays or nested under common keys (`properties`, `rentals`).
- Follow API-provided next links with a finite page guard of 100 pages.
- Retry HTTP 429, 502, 503, 504 and thrown network errors up to 2 retries with bounded backoff; do not retry invalid key/access errors.
- Cache rental-market responses per type in supplied storage.
- Reuse cache until `rentals_delay`/`rentals_timestamp` indicates it may be stale; otherwise use 15 minutes.

- [ ] **Step 5: Run API tests and verify pass**

```bash
node --test property-rental-manager/tests/api-core.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add property-rental-manager/src/api-core.js property-rental-manager/tests/api-core.test.js
git commit -m "feat: add throttled Torn property API client"
```

---

### Task 3: Lease draft and native form preparation

**Files:**
- Create: `property-rental-manager/src/draft-core.js`
- Create: `property-rental-manager/src/form-core.js`
- Create: `property-rental-manager/tests/draft-core.test.js`
- Create: `property-rental-manager/tests/form-core.test.js`

**Interfaces:**
- Produces `DraftCore.createStore(storage, options)`, `store.save(draft)`, `store.loadFor(propertyId)`, `store.clear()`.
- Produces `FormCore.parseLeasePropertyId(locationLike)`, `FormCore.findLeaseForm(document)`, `FormCore.setNativeValue(input, value, windowLike)`, `FormCore.prepareLeaseForm({ document, window, location, draft })`.

- [ ] **Step 1: Write failing draft tests**

Assert:

```js
test('validates rental period 1 to 365', () => {
  assert.throws(() => store.save({propertyId:1, days:0, dailyPrice:100}));
  assert.throws(() => store.save({propertyId:1, days:366, dailyPrice:100}));
  store.save({propertyId:1, days:30, dailyPrice:100});
  assert.equal(store.loadFor(1).totalCost, 3000);
});

test('draft is property-specific and expires', () => {
  store.save({propertyId:7, days:30, dailyPrice:100});
  assert.equal(store.loadFor(8), null);
  clock += 31 * 60 * 1000;
  assert.equal(store.loadFor(7), null);
});
```

Use a 30-minute default draft expiry.

- [ ] **Step 2: Run draft tests and verify failure**

```bash
node --test property-rental-manager/tests/draft-core.test.js
```

Expected: FAIL.

- [ ] **Step 3: Implement draft-core**

Store one JSON record under `r4g3_property_rental_manager.pending_lease` in injected `sessionStorage`. Normalize:

- positive integer `propertyId`
- integer `days` between 1 and 365
- integer `dailyPrice > 0`
- `totalCost = days * dailyPrice`
- `createdAt`
- optional market summary fields used by the inline lease-page helper

Return `null` on malformed, expired, or mismatched drafts and remove invalid stored data.

- [ ] **Step 4: Write failing form tests with jsdom**

Fixture:

```html
<div id="market">
  <ul class="lease-input">
    <li class="amount"><input class="input-money" /></li>
    <li class="cost"><input class="lease input-money" /></li>
    <li class="actions"><button id="native-submit" type="button">Lease</button></li>
  </ul>
</div>
```

Assert:

- hash `#/p=options&ID=123&tab=lease` resolves property ID `123`
- days input becomes `30`
- cost input becomes total cost, not daily cost
- both `input` and `change` fire
- `native-submit.click()` is never invoked
- missing form returns `{ ok:false, reason:'form_not_recognized' }`
- mismatched route/draft returns safe failure

- [ ] **Step 5: Run form tests and verify failure**

```bash
node --test property-rental-manager/tests/form-core.test.js
```

Expected: FAIL.

- [ ] **Step 6: Implement form-core**

`findLeaseForm` must prefer the exact current structure:

```js
const root = document.querySelector('#market ul.lease-input');
const daysInput = root?.querySelector('li.amount input.input-money:not([type="hidden"])');
const costInput = root?.querySelector('li.cost input.lease.input-money');
```

Do not add a fallback that guesses unrelated inputs. `setNativeValue` must use the element prototype setter when available and dispatch bubbling `input` and `change` events.

`prepareLeaseForm` fills only after route/draft ID match and returns a summary object. It never invokes submit controls.

- [ ] **Step 7: Run Task 3 tests and verify pass**

```bash
node --test property-rental-manager/tests/draft-core.test.js property-rental-manager/tests/form-core.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit Task 3**

```bash
git add property-rental-manager/src/draft-core.js property-rental-manager/src/form-core.js property-rental-manager/tests/draft-core.test.js property-rental-manager/tests/form-core.test.js
git commit -m "feat: add safe native lease form preparation"
```

---

### Task 4: Application shell, persistence, and scan workflow

**Files:**
- Create: `property-rental-manager/src/app.js`
- Create: `property-rental-manager/tests/app-core.test.js`

**Interfaces:**
- Consumes all previous cores.
- Produces `PropertyRentalManagerApp.start(window, document)` and pure helper exports for settings normalization and row construction.

- [ ] **Step 1: Write failing application-helper tests**

Test settings normalization:

```js
test('normalizes safe default settings', () => {
  const s = App.normalizeSettings({});
  assert.equal(s.mode, 'simple');
  assert.equal(s.theme, 'dark');
  assert.equal(s.days, 30);
  assert.equal(s.undercutPercent, 0.5);
  assert.equal(s.minimumMedianRatio, 0.70);
});
```

Test row construction with normalized properties + market stats:

```js
test('action is available only for empty owned properties', () => {
  const rows = App.buildRows([
    {id:1,status:'none',propertyTypeId:13,name:'Private Island',happy:4500,modifications:[]},
    {id:2,status:'rented',propertyTypeId:13,name:'Private Island',happy:4500,modifications:[]}
  ], new Map([[13, [{happy:4500,modifications:[],cost_per_day:100}]]]), App.normalizeSettings({}));
  assert.equal(rows[0].canPrepare, true);
  assert.equal(rows[1].canPrepare, false);
});
```

- [ ] **Step 2: Run app helper tests and verify failure**

```bash
node --test property-rental-manager/tests/app-core.test.js
```

Expected: FAIL.

- [ ] **Step 3: Implement settings and scan orchestration**

Settings key: `r4g3_property_rental_manager.settings`.

Normalize:

```js
{
  mode: 'simple' | 'advanced',
  theme: 'dark' | 'light',
  days: 1..365,
  undercutPercent: 0..20,
  minimumMedianRatio: 0.25..1,
  geometry: { left, top, width, height }
}
```

Startup sequence:

1. ensure one app instance
2. load settings
3. render launcher/panel
4. obtain API key from local storage; if missing, render setup
5. fetch owned properties
6. fetch unique rental markets
7. build priced rows
8. persist sanitized last-scan summary
9. render dashboard
10. observe route/hash changes for a pending lease draft

- [ ] **Step 4: Implement the UI shell**

Required behavior:

- fixed high-z-index panel
- title-bar drag except on buttons/inputs
- bottom-right resize handle
- geometry constrained inside viewport on restore
- geometry saved after drag/resize
- collapse/minimize control
- Simple/Advanced toggle
- Dark/Light toggle
- Refresh button
- Settings view with API key input, rental period, undercut, median ratio, clear-cache action
- Simple table/card columns from the spec
- Advanced extra columns/data from the spec
- loading/error/empty states
- dark theme uses off-white text with green accents; light theme uses dark text

- [ ] **Step 5: Implement `Prepare Lease` hand-off**

On the actual user click:

1. read the row's currently displayed/editable daily price
2. create exactly one session draft
3. assign `window.location.href = PropertyCore.leaseUrl(propertyId)`

Do not fetch the lease page, click native controls, or submit anything.

On the matching native lease route, wait up to 10 seconds using `MutationObserver` + timeout for the exact form selectors, then call `FormCore.prepareLeaseForm` and show an inline summary.

- [ ] **Step 6: Run app tests and verify pass**

```bash
node --test property-rental-manager/tests/app-core.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add property-rental-manager/src/app.js property-rental-manager/tests/app-core.test.js
git commit -m "feat: add property rental manager application shell"
```

---

### Task 5: Bundle userscript, package tooling, static safeguards, and release verification

**Files:**
- Create: `property-rental-manager/R4G3RUNN3R-Property-Rental-Manager.user.js`
- Create: `property-rental-manager/package.json`
- Create: `property-rental-manager/scripts/build.js`
- Create: `property-rental-manager/tests/userscript-static.test.js`
- Create: `property-rental-manager/README.md`

**Interfaces:**
- Consumes all source modules and creates one installable userscript.

- [ ] **Step 1: Write failing userscript static tests**

Tests must assert the built userscript contains:

```js
assert.match(script, /@match\s+https:\/\/www\.torn\.com\/properties\.php\*/);
assert.doesNotMatch(script, /form\.submit\s*\(/);
assert.doesNotMatch(script, /requestSubmit\s*\(/);
assert.doesNotMatch(script, /Authorization[^\n]*https?:\/\//);
assert.doesNotMatch(script, /[?&]key=/);
```

Also inspect source and bundle for:

- no `GM_xmlhttpRequest` to non-API Torn endpoints
- no literal third-party backend domain
- no `.click()` call whose receiver is a native lease/submit control
- one duplicate-instance guard

- [ ] **Step 2: Run static test and verify failure**

```bash
node --test property-rental-manager/tests/userscript-static.test.js
```

Expected: FAIL because the bundle does not exist yet.

- [ ] **Step 3: Create package tooling**

`property-rental-manager/package.json`:

```json
{
  "name": "r4g3-property-rental-manager",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "node scripts/build.js",
    "test": "node --test tests/*.test.js",
    "syntax": "node --check src/property-core.js && node --check src/market-core.js && node --check src/api-core.js && node --check src/draft-core.js && node --check src/form-core.js && node --check src/app.js && node --check R4G3RUNN3R-Property-Rental-Manager.user.js",
    "verify": "npm run build && npm run syntax && npm test"
  },
  "devDependencies": {
    "jsdom": "26.1.0"
  },
  "engines": { "node": ">=20" }
}
```

- [ ] **Step 4: Create deterministic bundler**

`build.js` reads source modules in this exact order:

1. `property-core.js`
2. `market-core.js`
3. `api-core.js`
4. `draft-core.js`
5. `form-core.js`
6. `app.js`

It strips CommonJS export branches from execution concerns by leaving each UMD module intact and concatenates them under one Tampermonkey metadata header. The final footer calls:

```js
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.R4G3PropertyRentalManagerApp.start(window, document);
}
```

Metadata includes:

```text
// ==UserScript==
// @name         R4G3RUNN3R Property Rental Manager
// @namespace    r4g3runn3r.property.rental.manager
// @version      1.0.0
// @description  Scan owned Torn properties, compare rental-market pricing, and safely prepare native lease listings.
// @author       R4G3RUNN3R[3877028]
// @license      MIT
// @match        https://www.torn.com/properties.php*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
```

- [ ] **Step 5: Build and run full verification**

From `property-rental-manager/`:

```bash
npm install
npm run verify
```

Expected: build succeeds, syntax succeeds, all tests pass.

- [ ] **Step 6: Write README**

Document:

- what the script does
- Limited-or-higher API key requirement
- API key stays browser-local and goes only to `api.torn.com`
- market scanning is automatic
- `Prepare Lease` requires a deliberate user click
- native Torn lease submission remains manual
- Simple/Advanced controls
- default pricing formula and 30-day period
- install instructions for the generated `.user.js`
- troubleshooting for invalid key, no market data, and form selector changes

- [ ] **Step 7: Re-run final verification after README/build**

```bash
npm run verify
```

Expected: PASS with zero failures.

- [ ] **Step 8: Commit Task 5**

```bash
git add property-rental-manager
git commit -m "feat: release property rental manager v1"
```

---

## Final branch verification

Run from repository root:

```bash
cd property-rental-manager
npm run verify
```

Then inspect:

```bash
git status --short
git log --oneline --decorate -5
```

Acceptance requires a clean worktree, passing tests, passing syntax checks, and an installable `R4G3RUNN3R-Property-Rental-Manager.user.js` that never auto-submits a Torn rental action.
