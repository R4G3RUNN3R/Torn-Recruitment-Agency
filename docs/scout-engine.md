# Scout Engine

## Purpose

Scout is the local player-intelligence subsystem inside Recruitment Agency v4.4. It is available as its own mode and also enriches Company/Faction recruitment records.

The browser talks directly to Torn for current player intelligence. The optional v4.3 Global Intelligence layer adds a separate Google Apps Script service for sanitized shared history. That service is not a grading backend and is never authoritative over fresher direct/local Torn data.

v4.4 adds Smart Match as a separate local decision layer. Scout supplies activity/Fit inputs to Match, but Scout does not own vacancy requirements, recruiter notes, salary expectations, desired roles, availability, Match Scores, or Match breakdowns.

## Data collection

For an uncached player, Scout requests public Torn user data and Personal Stats. The Personal Stats list is:

- `xantaken`
- `useractivity`
- `refills`
- `statenhancersused`
- `attackswon`
- `attackslost`
- `rankedwarhits`
- `networth`
- `activestreak`
- `bestactivestreak`

For accounts at least 30 days old, the normal data model is:

1. current totals
2. totals at roughly 7 days ago
3. totals at roughly 30 days ago
4. local subtraction to obtain 7-day and 30-day activity windows

The Torn API key is kept in the Recruitment Agency IndexedDB metadata record in the user's browser and is never included in Global Intelligence payloads.

## Young accounts and provisional data

An account younger than 30 days cannot have a complete 30-day activity window. Because the tracked Personal Stats are lifetime cumulative totals, Scout can use those totals as the account-to-date activity window when the account age is known.

That window is projected to 30 days and shown only as **Provisional Fit**. It is never labelled as an official 30-day Fit.

If account-to-date data cannot be used but a valid 7-day window exists, Scout can use the 7-day window provisionally instead.

## Caching

`scoutLatest` is considered fresh for 12 hours. A normal Scout action reuses a fresh record rather than consuming Torn API calls. Force-scout actions bypass freshness and create a new snapshot.

Every completed measurement is also stored permanently in `scoutHistory`.

## Database

Recruitment Agency v4.4 uses IndexedDB database `tornWorkerDB`, version 11.

Existing/local stores include:

- `users` - forum recruitment records from Company/Faction modes
- `meta` - application settings, synchronization history, UI mode, Results state, Global Intelligence configuration, Smart Match active-profile state, and window geometry
- `scoutLatest` - newest Scout snapshot per Torn user ID
- `scoutHistory` - immutable timestamped local Scout snapshots
- `globalLatest` - newest fetched shared-history response per Torn user ID, with cache timestamp
- `globalHistory` - locally cached shared observations keyed by player/timestamp
- `globalSyncQueue` - pending sanitized uploads that could not yet be delivered

v4.4 adds these stores additively:

- `candidateLocal` - recruiter/candidate context keyed by Torn user ID
- `matchProfiles` - local vacancy profiles keyed by `profileId`

The upgrade does not delete or recreate earlier stores.

## Historical Fit

Each Scout snapshot stores:

- raw current Personal Stats
- raw 7-day historical Personal Stats, when available
- raw 30-day historical Personal Stats, when available
- calculated window metrics
- the scoring targets/weights active when captured
- Original Fit
- original score type (official/provisional/unmeasured)
- Trend and metric trend components

When local history is displayed, **Current Fit** is recalculated from the stored raw/window data with the currently configured formula. This allows both questions to be answered:

- What did this player score under the rules I used at the time?
- What would this old snapshot score under my recruiting rules today?

Shared Global Intelligence Fit values are historical observations contributed by clients and are displayed as shared context rather than silently replacing the local calculation.

## Results Intelligence integration

The pure Results engine lives in `src/results-core.js`. Scout remains responsible for collecting/caching local intelligence; Results consumes those stored snapshots without changing the Scout API model.

Scout-backed Results fields include:

- **Activity 30d** from the measured 30-day `useractivity` window
- **Last Active** from the best available current Torn profile/last-action timestamp
- **Fit** and Trend
- **Scout Status**, classifying the local observation as LIVE, FRESH, CACHED, PROVISIONAL, STALE, FAILED, or UNSCOUTED
- optional detailed columns such as Xanax 30d, Refills 30d, Attacks 30d, RW Hits 30d, Net Worth, and streaks

Sorting, filtering, changing visible columns, switching Table/Cards, and CSV generation operate entirely on local result data. They do not make Torn API requests.

Company, Faction, and Scout each remember independent Results sort/filter/column state. Table, Cards, and CSV consume the same filtered and sorted row array so their order cannot diverge.

## Smart Match v4.4 integration

Smart Match is intentionally separate from Scout Fit.

```text
Scout
  -> supplies local Fit/activity intelligence

candidateLocal
  -> supplies Desired Company / Desired Role / Expected Salary / Availability / Recruiter Note

Match Profile
  -> supplies vacancy requirements, enabled criteria, targets, and weights

src/match-core.js
  -> calculates Match Score + completeness + transparent breakdown
```

The Match engine is pure/local. `refreshMatchScores()` reads the active Match Profile and local candidate record, maps the already-available Scout/Results fields into Match inputs, and calculates the result without making a Torn request.

Changing a Match Profile, switching active profiles, or editing a candidate immediately recalculates Match from existing local data. A recruiter can therefore change hiring rules repeatedly without rescanning players or consuming Torn API calls.

Match handles unknowns differently from a naive zero-fill model. An enabled criterion whose candidate value is unknown is excluded from the available denominator. Completeness separately reports how many enabled criteria are known. If no enabled criterion is known, Match is unmeasured rather than zero.

The reusable player-name hover card displays Match beside Fit and the underlying candidate context. It also exposes the per-criterion breakdown and local candidate editor. Hover rendering/editing itself performs no network work. The explicit **Scout** action in the card is the only operation there that intentionally starts Scout/Torn activity.

`Match` is supported as an optional Results column, sort key, and `Match ≥` filter, but it is deliberately absent from `DEFAULT_VISIBLE_COLUMNS`.

### Smart Match privacy boundary

These values remain local and are not Global Intelligence fields:

- Match Profiles
- Desired Company
- Desired Role
- Expected Salary
- Availability override
- Recruiter Note
- Match Score
- Match breakdown/completeness

Match is not written into Scout history. Scout snapshots remain measurements of Torn player data; Match is a current local interpretation of those measurements under the recruiter's active vacancy rules.

## Global Intelligence v4.3

`src/global-core.js` is the pure client-side contract for the optional Google Sheets history layer. It owns:

- the explicit global-field whitelist
- sanitized observation construction
- Apps Script payload construction
- material-equality rules used by the shared observation model
- service-response/history normalization
- retry classification
- source precedence helpers

After a **fresh successful Scout measurement**, local persistence completes first. Recruitment Agency then constructs a sanitized observation and adds it to `globalSyncQueue`. Network delivery happens afterward and is fail-open.

The allowed shared fields remain exactly:

`playerId, name, observedAt, level, ee, activity30, xanax30, refills30, attacks30, rwHits30, networth, fit, fitType, lastActive, scoutStatus, sourceVersion`

Complete Scout objects, application settings, API keys, recruiter notes, contact history, private CRM status, message contents, recruiter-entered negotiation data, Smart Match profiles, and Match results are not serialized to the service.

The shared service uses a private Google Sheet with fixed `Players`, `Observations`, and `Meta` tabs. Google Apps Script is the public gateway and enforces its own validation, lock, deduplication, bounded-history, and lightweight rate controls.

### Provenance

When multiple observations exist, Recruitment Agency uses this priority:

```text
LIVE > LOCAL > GLOBAL > HISTORICAL > forum parsed
```

Definitions:

- `LIVE`: direct current Torn/API state from the active operation
- `LOCAL`: current local Scout observation/cache
- `GLOBAL`: recent shared observation from the configured Google Apps Script service
- `HISTORICAL`: older shared observations
- forum parsed: information inferred conservatively from recruitment posts

Global/history information is supplemental. It can provide previous values, first/last seen, observation count, deltas, and fallback data where current data is genuinely absent, but it cannot silently overwrite fresher direct/local fields.

### Global retries

Global traffic has its own queue and does not use the Torn API scheduler.

A failed global upload:

1. leaves the local Scout snapshot intact;
2. remains in `globalSyncQueue`;
3. receives capped exponential retry metadata;
4. is retried on later Recruitment Agency activity or by **Retry Global Sync**;
5. stops automatic retrying after the configured maximum attempt count.

Permanent invalid-schema/data responses are not retried forever.

## Search Users discovery

Scout can read Torn's current Search Users page by locating profile links that contain Torn user IDs. Discovery itself performs no Torn API calls. The extracted IDs are then passed through the same Scout queue as direct-ID lookups.

## Torn API scheduler

Recruitment Agency v4.4 retains one shared rate gate for **Torn API traffic generated by the script**.

The configured rate:

- defaults to **75 calls per minute**
- is hard-capped at **75 calls per minute**
- therefore enforces at least **800 ms between scheduled Torn API calls** at the maximum rate

Forum scans, profile enrichment, key validation, Scout current-stat requests, historical requests, cache diagnostics, and Scout retries all pass through the shared Torn scheduler. Worker count cannot multiply the global Torn request rate.

Google Apps Script requests and Smart Match calculations are not Torn API calls. They do not change or bypass the 75/min or 800 ms Torn limits.

Settings expose advanced Scout controls for:

- API calls per minute, limited to 10-75
- worker count
- total Scout call budget
- maximum candidates per run
- optional history gap in milliseconds
- pause/resume
- cancellation
- optional Global Intelligence endpoint, service test, enable/disable setting, queue status, and manual retry

Temporary Torn API code 5 responses are retried a limited number of times through the same Torn rate gate. Selected key/access error codes stop the active Scout queue instead of allowing hundreds of doomed requests to continue.

## Historical cache diagnostic

The optional cache diagnostic performs:

1. a 7-day historical Personal Stats request
2. an immediate 30-day historical request, subject to the Torn scheduler
3. a 35-second wait
4. the same 30-day request again

It compares stable signatures of the returned cumulative values. If the pattern indicates that an earlier historical response was reused, Recruitment Agency sets the historical gap to 32,000 ms for future Scout runs.

A flat player's totals can genuinely be identical, so a `flat` result does not automatically enable the delay.

## Forum integration

Company and Faction modes retain forum scanning and work-stat parsing. Their result rows look up `scoutLatest` by Torn user ID, so the newest Fit/Trend/Activity data appears regardless of which forum thread originally discovered the player.

Preferred Company parsing remains deliberately conservative. Only explicit recruiting intent is normalized into a company type; merely mentioning a company does not count as a preference.

Hybrid behavior:

- cached Scout data appears without new Torn calls
- **Scout** force-refreshes one player
- **Scout Selected** refreshes selected rows
- **Scout All** processes the current filtered result set
- optional **Auto Scout new** runs the Scout queue on players discovered by a forum scan
- opening Scout History can additionally retrieve cached/shared Global History when a compatible endpoint is configured
