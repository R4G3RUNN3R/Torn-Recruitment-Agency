# Torn Recruitment Agency

R4G3RUNN3R's Recruitment Agency v4.3 combines Company/Faction forum recruitment discovery, local Scout intelligence, Results Intelligence, and an optional shared Google Sheets history layer for Torn.

The Scout, Results, and Global Intelligence client engines are clean-room implementations. They do not call, authenticate against, or depend on `rs.dnonetwork.com` or another proprietary grading backend.

## Main features

- Simple interface by default, with a persistent Advanced toggle
- Company and faction forum recruitment scanning
- Dedicated Scout mode with Scout intelligence attached to Company/Faction recruits
- Torn Search Users page discovery and direct player-ID scouting
- Current, 7-day, and 30-day Personal Stats snapshots
- 12-hour Scout cache plus permanent local IndexedDB history
- Configurable 0-100 Fit scoring and weighted Trend
- Provisional Fit with confidence when 30 days are unavailable
- Results filtering, sorting, selectable columns, Cards/Table views, and CSV export
- Optional **Global Intelligence** backed by a private Google Sheet through a Google Apps Script web app
- Failed global uploads are queued locally and never turn a successful Scout measurement into a failure
- Shared history is advisory and never silently replaces fresher direct/local Torn data
- Hard Torn API pacing cap of 75 calls/minute, with at least 800 ms between script Torn API calls
- Recruitment Agency launcher injected into Torn's Information sidebar, with floating RA fallback if insertion is unavailable
- Independent draggable/resizable Main, Results, and Scout History windows with saved geometry and viewport recovery
- Dark theme with neon-green text and a light theme with black/dark text
- Non-destructive IndexedDB upgrades

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

The client builds uploads from an explicit whitelist. It does **not** serialize complete settings, Scout records, forum records, or browser storage objects.

The following always remain local and are not part of the global schema:

- Torn API key
- recruiter notes
- private CRM/recruitment state
- contact history or message contents
- recruiter-entered salary/pay negotiations
- private role or availability notes
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

Follow [`global/google-apps-script/README.md`](global/google-apps-script/README.md) once to bind/deploy the service, then paste the resulting Apps Script `/exec` URL into **Advanced Settings -> Global Intelligence** and use **Test Global Service**.

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
- Scout Status distinguishes LIVE, FRESH, CACHED, PROVISIONAL, STALE, FAILED, and UNSCOUTED data
- Table and Cards use the same processed result order
- **Copy CSV** exports the currently filtered/sorted result set using the currently selected columns
- Select All and Scout All act on the currently processed/filtered result set
- **Reset Window Layout** restores Main, Results, and History geometry without deleting recruitment data or settings
- Conflicting scan/Scout start controls are visibly disabled while work is running
- Sidebar recovery uses bounded retries plus a debounced Torn SPA observer rather than repeatedly rescanning on every DOM mutation

The Results engine lives in `src/results-core.js`. Global sanitization, precedence, response normalization, and retry classification live in `src/global-core.js`, keeping those rules testable without Torn's UI.

## Install

Install `R4G3RUNN3R-Recruitment-Agency.user.js` in Tampermonkey or another compatible userscript manager.

A Torn API key is stored only in the browser database used by the script. Recruitment Agency talks directly to Torn from the browser.

## Simple and Advanced modes

**Simple** is the default. It exposes the normal Company, Faction and Scout workflows, Results, Theme, and a collapsed Fit Settings section. Results itself keeps detailed filters and extra columns hidden until the user opens them.

**Advanced** reveals technical controls such as API rate, workers, call budget, history spacing, cache diagnostics, maximum candidates, Auto Scout, detailed Scout filters, API-key controls, density, table/card settings, window-layout reset, and the optional Global Intelligence endpoint/test/retry controls. Switching modes does not reset saved values.

## API pacing

The script uses one shared scheduler for Torn API requests. The configurable rate is clamped to a maximum of **75 calls per minute**, which is **800 ms per call** at the cap. Workers cannot bypass this scheduler.

Results sorting/filtering and Google Apps Script traffic do not consume Torn API calls and are not routed through the Torn scheduler.

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

Recruit Scout was used only to understand observable behavior and Torn API usage patterns. This project implements its own scoring, storage, UI, scheduling, history, sorting, filtering, global sanitization, and shared-history service.
