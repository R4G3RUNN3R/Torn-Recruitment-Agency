# Torn Recruitment Agency

R4G3RUNN3R's Recruitment Agency v4.4 combines Company/Faction forum recruitment discovery, local Scout intelligence, Results Intelligence, local-only Smart Match vacancy scoring, contextual help, and an optional shared Google Sheets history layer for Torn.

The Scout, Results, Global Intelligence, and Smart Match client engines are clean-room implementations. They do not call, authenticate against, or depend on `rs.dnonetwork.com` or another proprietary grading backend.

## Main features

- Simple interface by default, with Simple/Advanced complexity controls inside the inline Settings hub
- Company and faction forum recruitment scanning
- Dedicated Scout mode with Scout intelligence attached to Company/Faction recruits
- Torn Search Users page discovery and direct player-ID scouting
- Current, 7-day, and 30-day Personal Stats snapshots
- 12-hour Scout cache plus permanent local IndexedDB history
- Configurable 0-100 Fit scoring and weighted Trend
- Provisional Fit with confidence when 30 days are unavailable
- Local-only **Smart Match** profiles for vacancy-specific 0-100 candidate suitability
- Reusable player-name hover card with Match breakdown, completeness, Scout context, and local candidate editing
- Optional Match Results column, sorting, and minimum-Match filtering without changing the default compact Results layout
- Inline Settings hub with centralized contextual help for major sections
- Results filtering, sorting, selectable columns, Cards/Table views, and CSV export
- Optional **Global Intelligence** backed by a private Google Sheet through a Google Apps Script web app
- Failed global uploads are queued locally and never turn a successful Scout measurement into a failure
- Shared history is advisory and never silently replaces fresher direct/local Torn data
- Hard Torn API pacing cap of 75 calls/minute, with at least 800 ms between script Torn API calls
- Recruitment Agency launcher injected into Torn's Information sidebar, with floating RA fallback if insertion is unavailable
- Independent draggable/resizable Main, Results, and Scout History windows with saved geometry and viewport recovery
- Dark theme with neon-green text and a light theme with black/dark text
- Non-destructive IndexedDB upgrades

## Smart Match v4.4

**Fit** and **Match** answer different questions.

- **Fit** is the general Scout activity/value signal calculated from player activity data.
- **Match** is suitability for the currently active local vacancy profile.

A Match Profile can enable any combination of MAN, INT, END, EE, Fit, Activity 30d, Xanax 30d, Refills 30d, Attacks 30d, RW Hits 30d, company, role, salary, and availability. Numeric criteria scale linearly up to their target and then cap at full credit. Salary receives full credit at or below budget and degrades proportionally above it. Known categorical mismatches score zero for that criterion.

Unknown candidate-specific values are **excluded from the denominator** rather than treated as zero. The hover card therefore shows both the Match score and completeness, for example `7 / 10 criteria known`. If none of the enabled criteria are known, Match is shown as **Unmeasured**, not `0`.

Smart Match remains deliberately local:

- Match Profiles stay in browser IndexedDB.
- Desired Company, Desired Role, Expected Salary, Availability, and Recruiter Note stay local.
- Match Score and Match breakdown are calculated transiently and are not uploaded to Global Intelligence.
- Editing a candidate or changing a Match Profile recalculates Match locally and consumes **zero Torn API calls**.

Hover or keyboard-focus a player name in Results to open the reusable candidate intelligence card. It shows Match, Fit, EE, Activity, work stats, local candidate context, the per-criterion breakdown, and completeness. **Edit candidate** modifies the local candidate record and recalculates immediately.

The default Results columns remain:

`Player | EE | Preferred Company | Activity | Last Active | Fit`

`Match` is an optional column. It can be enabled, sorted, and filtered with `Match ≥` without being forced into the default layout.

## Settings and contextual help v4.4

The main toolbar opens one inline **Settings** hub rather than another floating managed window. Its sections are:

- General
- Recruitment
- Scout
- Results
- Smart Match
- Global Intelligence
- Data & Reset
- Danger Zone

Simple/Advanced mode now lives under **Settings → General**. Existing persisted values are retained when switching complexity modes.

Major panels use one centralized contextual-help system. The information controls explain what a section does, what data it changes, where the data comes from or is stored, whether Torn API calls are consumed, and relevant privacy/limitations. Help opens on hover/focus or click/tap, supports Escape, stays within the viewport, and performs no network work.

## Global Intelligence v4.3

Global Intelligence lets Recruitment Agency installations contribute and reuse sanitized historical Torn player observations through one shared service.

The architecture is:

```text
Recruitment Agency userscript
        |
        | sanitized observation / history request
        v
Google Apps Script web app
        |
        v
Private Google Sheet
  Players | Observations | Meta
```

The Google Sheet itself stays private. The deployed Apps Script `/exec` URL is the public gateway.

### Shared fields

Only the following player-intelligence fields are eligible to leave the browser:

`playerId, name, observedAt, level, ee, activity30, xanax30, refills30, attacks30, rwHits30, networth, fit, fitType, lastActive, scoutStatus, sourceVersion`

The client builds uploads from an explicit whitelist. It does **not** serialize complete settings, Scout records, forum records, browser storage objects, Smart Match profiles, Match scores, or candidate CRM records.

The following always remain local and are not part of the global schema:

- Torn API key
- recruiter notes
- private CRM/recruitment state
- contact history or message contents
- recruiter-entered salary/pay negotiations
- private role or availability notes
- Smart Match Profiles, Match Score, and Match breakdown
- Google credentials

### Shared history behavior

Every fresh completed Scout measurement is first stored locally. If Global Intelligence is configured, a sanitized copy is queued for submission afterward.

The service keeps:

- `Players`: one latest accepted observation per Torn player
- `Observations`: append-only accepted historical observations
- `Meta`: schema/service configuration

Materially identical observations inside 30 minutes are deduplicated. Player-history responses are capped at the newest 100 observations.

If Google is unavailable, local Scout data remains successful and the sanitized observation stays in `globalSyncQueue` for a later capped retry. Automatic retries stop after the configured attempt limit rather than hammering the service indefinitely.

### Provenance and precedence

Recruitment Agency treats sources in this order:

```text
LIVE > LOCAL > GLOBAL > HISTORICAL > forum parsed
```

Global data provides historical context, deltas, first/last seen information, and fallback values when current data is genuinely absent. It is not allowed to overwrite fresher direct/local data.

The Scout History window shows the local history separately from the optional Global History section.

### Setup

The reproducible Apps Script service lives in [`global/google-apps-script/`](global/google-apps-script/).

Follow [`global/google-apps-script/README.md`](global/google-apps-script/README.md) once to bind/deploy the service, then paste the resulting Apps Script `/exec` URL into **Settings → Global Intelligence** and use the service test control.

The userscript remains fully functional when no endpoint is configured.

## Results Intelligence v4.2+

Results is deliberately small by default. A fresh view shows search plus the compact column set:

`Player | EE | Preferred Company | Activity | Last Active | Fit`

Additional power is available only when requested:

- **Clickable sortable headers** with sensible first-click direction and visible `↑` / `↓`
- Clicking the active header again reverses its direction
- Missing/unmeasured values always remain below measured values in either direction
- Sort state is remembered independently for Company, Faction, and Scout
- **Filters** opens the detailed filtering workspace; it is closed by default
- **Columns** lets the user choose which supported fields are visible; it is closed by default
- Active hidden filters are disclosed by a count and can be cleared in one action
- Search/filter/column state is remembered separately for each recruitment mode
- Numeric filters accept Torn-style shorthand such as `50k`, `2.5m`, and `1b`
- Invalid shorthand is rejected rather than silently becoming zero
- Preferred Company parsing is conservative and only records explicit recruiting intent
- Sortable/filterable Scout-backed fields include Activity 30d, Last Active, and Scout Status
- Smart Match adds optional Match sorting/filtering while leaving Match out of default columns
- Scout Status distinguishes LIVE, FRESH, CACHED, PROVISIONAL, STALE, FAILED, and UNSCOUTED data
- Table and Cards use the same processed result order
- **Copy CSV** exports the currently filtered/sorted result set using the currently selected columns
- Select All and Scout All act on the currently processed/filtered result set
- **Reset Window Layout** restores Main, Results, and History geometry without deleting recruitment data or settings
- Conflicting scan/Scout start controls are visibly disabled while work is running
- Sidebar recovery uses bounded retries plus a debounced Torn SPA observer rather than repeatedly rescanning on every DOM mutation

The Results engine lives in `src/results-core.js`. Smart Match scoring/normalization lives in `src/match-core.js`. Global sanitization, precedence, response normalization, and retry classification live in `src/global-core.js`, keeping those rules testable without Torn's UI.

## Install

Install `R4G3RUNN3R-Recruitment-Agency.user.js` in Tampermonkey or another compatible userscript manager.

A Torn API key is stored only in the browser database used by the script. Recruitment Agency talks directly to Torn from the browser.

## Simple and Advanced modes

**Simple** is the default. It exposes the normal Company, Faction and Scout workflows, Results, Theme, and a collapsed Fit Settings section. Results itself keeps detailed filters and extra columns hidden until the user opens them.

**Advanced** reveals technical controls such as API rate, workers, call budget, history spacing, cache diagnostics, maximum candidates, Auto Scout, detailed Scout filters, API-key controls, density, table/card settings, window-layout reset, Smart Match Profile management, and the optional Global Intelligence endpoint/test/retry controls. Simple/Advanced is changed from **Settings → General** and switching modes does not reset saved values.

## API pacing

The script uses one shared scheduler for Torn API requests. The configurable rate is clamped to a maximum of **75 calls per minute**, which is **800 ms per call** at the cap. Workers cannot bypass this scheduler.

Results sorting/filtering, Smart Match scoring/editing, contextual help, and Google Apps Script traffic do not consume Torn API calls and are not routed through the Torn scheduler.

Scout also keeps its per-run call budget. Temporary Torn retries pass through the same scheduler rather than firing outside the rate gate.

## Fit model

Default 30-day targets:

| Metric | Target | Weight |
|---|---:|---:|
| Xanax | 60 | 20 |
| Activity | 120 hours | 20 |
| Refills | 25 | 20 |
| Attacks | 200 | 20 |
| Ranked War hits | 40 | 20 |

Each component is linear and capped at its weight:

`component = min(actual / target, 1) * normalizedWeight`

Weights are normalized to 100 automatically.

## Notes

Recruit Scout was used only to understand observable behavior and Torn API usage patterns. This project implements its own scoring, storage, UI, scheduling, history, sorting, filtering, Smart Match, global sanitization, and shared-history service.
