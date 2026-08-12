# Torn Recruitment Agency

R4G3RUNN3R's Recruitment Agency v4.1 combines Company/Faction forum recruitment discovery with a local Scout intelligence engine for Torn.

The Scout engine is a clean-room local implementation. It does not call, authenticate against, or depend on `rs.dnonetwork.com`.

## Main features

- Simple interface by default, with a persistent Advanced toggle
- Collapsed Fit Settings available even in Simple mode
- Company and faction forum recruitment scanning
- Dedicated Scout mode
- Scout intelligence attached to Company/Faction recruits
- Torn Search Users page discovery
- Direct player-ID scouting
- Current, 7-day, and 30-day Personal Stats snapshots
- 12-hour cache plus permanent IndexedDB history
- Configurable 0-100 Fit scoring and weighted Trend
- Provisional Fit with confidence when 30 days are unavailable
- Hard API pacing cap of 75 calls/minute, with at least 800 ms between script Torn API calls
- Advanced controls for workers, call budget, history gap, cache diagnostics, Auto Scout and detailed filters
- Cards/table views, sorting, filtering, selection, and clipboard export
- Manual Scout / Scout Selected / Scout All
- Optional Auto Scout for newly discovered forum recruits
- Recruitment Agency launcher injected into Torn's Information sidebar, with floating RA fallback if insertion is unavailable
- Independent Main, Results and Scout History windows
- Every tool window is draggable and resizable, with saved geometry and viewport recovery
- Dark theme uses neon-green text; light theme uses black/dark text
- Non-destructive IndexedDB upgrades

## Install

Install `R4G3RUNN3R-Recruitment-Agency.user.js` in Tampermonkey or another compatible userscript manager.

A Torn API key is stored only in the browser database used by the script. Recruitment Agency talks directly to Torn from the browser.

## Simple and Advanced modes

**Simple** is the default. It exposes the normal Company, Faction and Scout workflows, basic filters, Results, Theme, and a collapsed Fit Settings section.

**Advanced** reveals technical controls such as API rate, workers, call budget, history spacing, cache diagnostics, maximum candidates, Auto Scout, detailed Scout filters, API-key controls, density and table/card settings. Switching modes does not reset saved values.

## API pacing

The script uses one shared scheduler for Torn API requests. The configurable rate is clamped to a maximum of **75 calls per minute**, which is **800 ms per call** at the cap. Workers cannot bypass this scheduler.

Scout also keeps its per-run call budget. Temporary retries pass through the same scheduler rather than firing outside the rate gate.

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

Recruit Scout was used only to understand observable behavior and Torn API usage patterns. This project implements its own scoring, storage, UI, scheduling, history, and filtering logic locally.
