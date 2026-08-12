# Scout Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Recruitment Agency v4.0.0 with a clean-room local Scout engine, dedicated Scout mode, and Scout intelligence embedded in Company/Faction recruitment records.

**Architecture:** Keep the existing v3 forum-recruitment workflow and IndexedDB database, but make the DB migration non-destructive and add `scoutLatest` and `scoutHistory` stores. Put pure scoring/history calculations in `src/scout-core.js` so they can be tested independently, then load that module from the userscript with `@require`. All Scout network calls go directly from the browser to Torn API v2; no Recruit Scout server calls exist.

**Tech Stack:** JavaScript userscript, Torn API v2, IndexedDB, Node 20 built-in test runner, GitHub Actions.

## Global Constraints

- Version is `4.0.0`.
- No calls, tokens, sessions, quotas, or authentication against `rs.dnonetwork.com`.
- Existing Company and Faction forum scanning remains available.
- Add dedicated Scout mode and Scout data to Company/Faction rows.
- IndexedDB upgrades must preserve existing `users` and `meta` data.
- Default targets are Xanax 60, Activity 120h, Refills 25, Attacks 200, RW hits 40.
- Default weights are 20 each and normalize to 100.
- Scoring is linear and capped per metric.
- Official Fit requires valid 30-day data; partial data is labelled Provisional Fit.
- Provisional Fit uses the longest trustworthy window and displays confidence.
- Full Scout history is retained, including original formula and Original Fit.
- Current Fit is recalculated from raw history using current settings.
- Extra stats are filter/display fields only: net worth, active streak, best streak, stat enhancers.
- Cache freshness is 12 hours.
- Search Users discovery and direct-ID scouting are supported.
- Hybrid Company/Faction behavior: cached data automatic, optional auto-scout, manual Scout/Selected/All always available.

---

### Task 1: Pure Scout scoring core

**Files:**
- Create: `tests/scout-core.test.js`
- Create: `src/scout-core.js`

**Interfaces:**
- Produces `window.RA_ScoutCore` in browsers and `module.exports` in Node.
- Exposes `DEFAULT_SCORING`, `normalizeScoring`, `scoreFit`, `computeTrend`, `deltaStats`, `metricsFromTotals`, `projectWindow`, `provisionalFit`, `provisionalConfidence`, `parseIds`, and `signature`.

- [ ] Write tests for weight normalization, linear score capping, default 100 score, delta conversion, weighted trend, provisional projection/confidence, ID parsing, and signatures.
- [ ] Run tests before the core exists and verify failure is due to missing `src/scout-core.js`.
- [ ] Implement only the pure core functions required by those tests.
- [ ] Run tests and verify all core tests pass.

### Task 2: CI and syntax verification

**Files:**
- Create: `.github/workflows/test.yml`
- Modify: `package.json`

**Interfaces:**
- `npm test` runs pure core tests.
- `npm run syntax` checks both module and userscript syntax.

- [ ] Configure GitHub Actions for pushes/PRs using Node 20.
- [ ] Run `npm test` and `npm run syntax` in CI.
- [ ] Verify a failing pre-core run and a passing post-core run.

### Task 3: Recruitment Agency v4 database and settings migration

**Files:**
- Create: `R4G3RUNN3R-Recruitment-Agency.user.js`

**Interfaces:**
- IndexedDB version 9.
- Existing stores preserved.
- Adds `scoutLatest` keyed by `userId` and `scoutHistory` keyed by `snapshotId`.
- Current settings include Scout targets, weights, filters, scheduler options, cache verdict, and auto-scout flag.

- [ ] Port existing v3 forum features into v4.
- [ ] Replace destructive DB upgrade with additive store creation.
- [ ] Add default Scout settings and safe settings merge.
- [ ] Add Scout history/latest persistence helpers.
- [ ] Verify script syntax in CI.

### Task 4: Torn Scout data collection and scheduler

**Files:**
- Modify: `R4G3RUNN3R-Recruitment-Agency.user.js`

**Interfaces:**
- `scoutPlayer(userId, options)` returns/stores a Scout snapshot.
- `runScoutQueue(ids, options)` applies filters, cache, workers, rate limit, budget, pause/resume/cancel.

- [ ] Implement direct Torn profile/personalstats calls.
- [ ] Collect current, 7-day, and 30-day personalstats using the observed historical timestamp pattern.
- [ ] Add profile age/level/status/faction enrichment.
- [ ] Add 12-hour latest cache.
- [ ] Add rate limiter, worker pool, budget, pause/resume/cancel, temporary-error retries, and fatal-key stop behavior.
- [ ] Implement official/provisional Fit and history persistence.
- [ ] Implement 35-second cache diagnostic and optional 32-second historical gap.

### Task 5: Scout discovery, filters, and integration

**Files:**
- Modify: `R4G3RUNN3R-Recruitment-Agency.user.js`

**Interfaces:**
- `readSearchUsersPage()` returns candidate IDs/names/status hints.
- Forum records can display latest Scout data independent of source mode.

- [ ] Add robust Search Users anchor parsing.
- [ ] Add multi-ID parser/input.
- [ ] Add Scout filters for faction, activity, level, idle days, Fit, net worth, streaks, and stat enhancers.
- [ ] Add cached Scout data to Company/Faction result rows.
- [ ] Add optional auto-scout after forum discovery.

### Task 6: Scout UI and result tools

**Files:**
- Modify: `R4G3RUNN3R-Recruitment-Agency.user.js`

**Interfaces:**
- Mode switch includes `scout`.
- Results support table/cards and selected rows.

- [ ] Add Scout launcher and mode panel.
- [ ] Add direct-ID and Search Users controls.
- [ ] Add Scout settings for targets/weights/rate/workers/budget/gap/auto-scout.
- [ ] Add Fit, Current Fit, Original Fit, Trend, components, extra stats, data age and provisional confidence.
- [ ] Add Scout/Scout Selected/Scout All buttons.
- [ ] Add sorting, filtering, table/cards, selection, and CSV clipboard export.
- [ ] Preserve theme/density/draggable survivability behavior.

### Task 7: Documentation and final verification

**Files:**
- Modify: `README.md`
- Create: `docs/scout-engine.md`
- Create: `docs/scoring.md`

**Interfaces:**
- Documentation describes install, data flow, API usage, scoring, provisional behavior, caching, and privacy.

- [ ] Document architecture and limitations clearly.
- [ ] Verify repository contains no `rs.dnonetwork.com` dependency in executable code.
- [ ] Verify `npm test` passes.
- [ ] Verify `npm run syntax` passes.
- [ ] Inspect final GitHub Actions run before declaring completion.
