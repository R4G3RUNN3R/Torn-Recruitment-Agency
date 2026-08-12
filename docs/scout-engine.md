# Scout Engine

## Purpose

Scout is the local player-intelligence subsystem inside Recruitment Agency v4. It is available as its own mode and also enriches Company/Faction recruitment records.

The browser talks directly to Torn. The project has no external grading service, account service, analytics service, or remote player database.

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

The API key is kept in the Recruitment Agency IndexedDB metadata record in the user's browser.

## Young accounts and provisional data

An account younger than 30 days cannot have a complete 30-day activity window. Because the tracked Personal Stats are lifetime cumulative totals, Scout can use those totals as the account-to-date activity window when the account age is known.

That window is projected to 30 days and shown only as **Provisional Fit**. It is never labelled as an official 30-day Fit.

If account-to-date data cannot be used but a valid 7-day window exists, Scout can use the 7-day window provisionally instead.

## Caching

`scoutLatest` is considered fresh for 12 hours. A normal Scout action reuses a fresh record rather than consuming Torn API calls. Force-scout actions bypass freshness and create a new snapshot.

Every completed measurement is also stored permanently in `scoutHistory`.

## Database

Recruitment Agency v4 uses IndexedDB database `tornWorkerDB`, version 9.

Stores:

- `users` - forum recruitment records from Company/Faction modes
- `meta` - application settings, synchronization history, and UI state
- `scoutLatest` - newest Scout snapshot per Torn user ID
- `scoutHistory` - immutable timestamped Scout snapshots

The v4 upgrade is additive. It does not delete the existing `users` store when upgrading from the older database version.

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

When history is displayed, **Current Fit** is recalculated from the stored raw/window data with the currently configured formula. This allows both questions to be answered:

- What did this player score under the rules I used at the time?
- What would this old snapshot score under my recruiting rules today?

## Search Users discovery

Scout can read Torn's current Search Users page by locating profile links that contain Torn user IDs. Discovery itself performs no Torn API calls. The extracted IDs are then passed through the same Scout queue as direct-ID lookups.

## Scheduler

Configurable controls include:

- API calls per minute
- worker count
- total call budget
- maximum candidates per run
- optional history gap in milliseconds
- pause/resume
- cancellation

Workers share one rate gate, so increasing workers does not intentionally multiply the configured global request rate.

Temporary Torn API code 5 responses are retried a limited number of times. Selected key/access error codes stop the active Scout queue instead of allowing hundreds of doomed requests to continue.

## Historical cache diagnostic

The optional cache diagnostic performs:

1. a 7-day historical Personal Stats request
2. an immediate 30-day historical request
3. a 35-second wait
4. the same 30-day request again

It compares stable signatures of the returned cumulative values. If the pattern indicates that an earlier historical response was reused, Recruitment Agency sets the historical gap to 32,000 ms for future Scout runs.

A flat player's totals can genuinely be identical, so a `flat` result does not automatically enable the delay.

## Forum integration

Company and Faction modes retain forum scanning and work-stat parsing. Their result rows look up `scoutLatest` by Torn user ID, so the newest Fit/Trend data appears regardless of which forum thread originally discovered the player.

Hybrid behavior:

- cached Scout data appears without new calls
- **Scout** force-refreshes one player
- **Scout Selected** refreshes selected rows
- **Scout All** processes the current result set
- optional **Auto Scout new** runs the Scout queue on players discovered by a forum scan
