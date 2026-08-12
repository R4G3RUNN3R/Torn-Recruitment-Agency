# Torn Recruitment Agency

R4G3RUNN3R's Recruitment Agency v4 integrates forum recruitment discovery with a local Scout intelligence engine for Torn.

The Scout engine is a clean-room local implementation. It does not call, authenticate against, or depend on `rs.dnonetwork.com`.

## Main features

- Company and faction forum recruitment scanning
- Dedicated Scout mode
- Scout intelligence attached to Company/Faction recruits
- Torn Search Users page discovery
- Direct player-ID scouting
- Current, 7-day, and 30-day Personal Stats snapshots
- 12-hour cache plus permanent IndexedDB history
- Configurable 0-100 Fit scoring and weighted Trend
- Provisional Fit with confidence when 30 days are unavailable
- Configurable filters, rate, workers, call budget, and history-call gap
- Cache diagnostic
- Cards/table views, sorting, filtering, selection, and clipboard export
- Manual Scout / Scout Selected / Scout All
- Optional Auto Scout for newly discovered forum recruits
- Non-destructive IndexedDB upgrades

## Install

Install `R4G3RUNN3R-Recruitment-Agency.user.js` in Tampermonkey or another compatible userscript manager.

A Torn API key is stored only in the browser database used by the script. Scout calls Torn directly from the browser.

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
