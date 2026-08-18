# R4G3RUNN3R Property Rental Manager Design

## Goal

Build a new Torn userscript that automatically scans the rental market for property types the user owns, evaluates comparable rental listings, recommends competitive rent, and prepares owned empty properties for rental listing with the minimum possible manual effort while remaining compliant with Torn's current scripting rules.

The first release is limited to **properties the user already owns**. It does not scan the sale market for properties to buy as rental investments.

## Current Torn constraints

This design was checked against Torn API OpenAPI version **6.10.2** on 2026-08-18.

Relevant official API endpoints:

- `GET https://api.torn.com/v2/user/properties`
  - Public access returns owned property data.
  - Limited-or-higher access exposes extended property status such as `none`, `in_use`, `for_sale`, `rented`, and `for_rent`.
- `GET https://api.torn.com/v2/market/{propertyTypeId}/rentals`
  - Public access.
  - Globally cached.
  - Provides `happy`, `cost`, `cost_per_day`, `rental_period`, `market_price`, `upkeep`, and `modifications`.
  - Response includes `rentals_timestamp`, optional `rentals_delay`, and pagination metadata.

Reference: `https://www.torn.com/swagger/openapi.json`.

Torn's current scripting rule states that software may use API data or data from a page the user manually loaded and is actively viewing, but non-API requests that are not directly and manually initiated by the user are prohibited.

Therefore the script MUST NOT silently submit rental listings, loop through native Torn listing actions, or perform background non-API Torn requests.

The compliant workflow is:

1. API market scanning and calculations may be automatic.
2. The user manually chooses an owned property from the manager.
3. That manual action opens Torn's native lease page for exactly one property.
4. The userscript may auto-fill visible form fields without causing a request.
5. The user manually submits Torn's native form.

No background auto-submit is included.

## Product shape

The userscript is a self-contained project within the existing repository and does not couple to Recruitment Agency internals.

Planned project root:

`property-rental-manager/`

The installed script will run on:

`https://www.torn.com/properties.php*`

The UI follows the newer R4G3RUNN3R Torn-tool conventions:

- one managed application shell
- movable and resizable desktop panel
- responsive mobile fallback
- persistent geometry and settings
- dark theme with off-white text and restrained green accents
- light theme with dark text
- Simple and Advanced modes
- local-only settings and cache
- no external service dependency

## High-level architecture

The project is split by responsibility and bundled as one installable userscript.

### `src/property-core.js`

Pure normalization and property-state logic.

Responsibilities:

- normalize `/user/properties` records
- identify truly owned properties
- classify `none`, `in_use`, `for_sale`, `rented`, and `for_rent`
- decide whether a property is eligible for a new lease listing
- derive the Torn lease URL:
  - `/properties.php#/p=options&ID={propertyId}&tab=lease`
- expose pure helpers usable by tests and UI

### `src/market-core.js`

Pure rental-market comparison and pricing logic.

Responsibilities:

- normalize market rental listings
- score similarity against one owned property
- select comparable listings
- remove obvious price outliers
- calculate floor, quartiles, median, and suggested daily rent
- calculate confidence level
- calculate total lease cost for the configured rental period

### `src/api-core.js`

All Torn API traffic.

Responsibilities:

- API-key handling
- shared request scheduler
- minimum **800 ms** spacing between Torn API calls
- hard cap of **75 Torn API calls per rolling minute**
- `Authorization: ApiKey {key}` header instead of putting the key in URLs
- paginated owned-property retrieval
- paginated rental-market retrieval
- per-property-type cache
- retry only transient API/network failures
- never make a non-API Torn request

### `src/draft-core.js`

Local listing-draft state.

Responsibilities:

- create a draft for one property
- persist the pending draft in `sessionStorage`
- default rental period: **30 days**
- valid period range: **1 to 365 days**
- remember the configured undercut percentage
- clear a draft after successful form preparation or expiry

### `src/form-core.js`

Visible-page form integration only.

Responsibilities:

- detect `#/p=options&ID={id}&tab=lease`
- wait for Torn's visible lease form
- target the current known lease controls under `#market ul.lease-input`
- fill rental period
- fill total rental cost
- dispatch `input` and `change` events so React-controlled fields update
- show the recommended daily rate, market floor, median, confidence, and total
- never call `.click()` on the final native submit button
- never submit a form programmatically

### `src/app.js`

Application shell and orchestration.

Responsibilities:

- startup
- API key setup
- scan orchestration
- dashboard rendering
- filters/sorting
- settings
- local cache controls
- route observation
- hand-off to `form-core`

### `R4G3RUNN3R-Property-Rental-Manager.user.js`

Installable entry point / bundled release script.

## API and cache model

### API key

The script requires a **Limited-or-higher** Torn API key for reliable property status information.

The key is stored browser-local only and is never transmitted anywhere except `api.torn.com`.

### Owned properties

The script calls `/v2/user/properties?limit=100` and follows only API-provided continuation links that remain on `api.torn.com`.

Only rows where the API owner ID is the current user are considered owned inventory.

### Rental market

The script requests rental listings only for unique property type IDs that occur in the user's owned inventory.

A market fetch is cached by property type. The cache stores:

- property type ID
- normalized listings
- `rentals_timestamp`
- `rentals_delay`
- local fetched-at time

A cached result is reused while Torn's own global cache cannot reasonably have changed. The implementation should prefer the API's `rentals_delay` when present; otherwise use a conservative 15-minute local fallback.

A manual `Refresh` may bypass the local freshness decision but still goes through the scheduler.

## Comparable selection

Comparables are always from the **same property type**.

Each listing receives a similarity score from 0 to 1.

### Happy similarity

`happyScore = max(0, 1 - abs(listingHappy - ownedHappy) / max(ownedHappy, 1))`

### Modification similarity

Modifications are treated as sets.

`modScore = intersectionSize / unionSize`

If both sets are empty, `modScore = 1`.

### Final similarity

`similarity = happyScore * 0.7 + modScore * 0.3`

Comparable selection order:

1. listings with similarity `>= 0.90`
2. if fewer than 5, allow `>= 0.75`
3. if still fewer than 5, use the 10 highest-scoring listings of the same property type

At most 30 comparables are used.

## Price cleaning

From selected comparables, use `cost_per_day` values greater than zero.

If at least 4 values exist, calculate Q1 and Q3 and remove values outside:

`[Q1 - 1.5 * IQR, Q3 + 1.5 * IQR]`

If cleaning would leave fewer than 3 values, fall back to the untrimmed comparable set.

The engine exposes:

- `marketFloor`
- `q1`
- `median`
- `q3`
- `sampleSize`

## Suggested pricing

Default strategy: **Fast Rent**.

Default undercut: **0.5%**.

`suggestedDaily = floor(marketFloor * (1 - undercutPercent / 100))`

Safety floor:

The recommendation must not fall below `70%` of the cleaned median unless the user explicitly changes the advanced safety setting.

Final formula:

`suggestedDaily = max(floor(marketFloor * (1 - undercutPct/100)), floor(median * minimumMedianRatio))`

Default `minimumMedianRatio = 0.70`.

The user may edit the suggested daily amount before preparing the lease.

## Confidence

- **High**: at least 8 cleaned comparables and average similarity >= 0.90
- **Medium**: at least 5 cleaned comparables and average similarity >= 0.75
- **Low**: everything else

Low-confidence recommendations remain visible but are not silently treated as authoritative.

## Dashboard

### Simple mode

Shows only actionable owned properties and essential numbers.

Columns/cards:

- Property
- Status
- Happy
- Market floor / day
- Suggested / day
- Lease period
- Total lease value
- Confidence
- Action

Primary action for an empty property:

`Prepare Lease`

The action creates a session draft and navigates, by direct user click, to:

`https://www.torn.com/properties.php#/p=options&ID={propertyId}&tab=lease`

For `for_rent`, `rented`, `for_sale`, and `in_use` properties, the dashboard shows status instead of offering a new lease action.

### Advanced mode

Adds:

- median and quartiles
- comparable count
- average similarity
- modification list
- market timestamp
- current listing rent for `for_rent`
- current renter and remaining period for `rented`
- per-property override of daily price
- undercut percentage
- minimum median ratio
- cache controls
- API diagnostics without exposing the key

## Lease-page form preparation

Known current Torn route:

`https://www.torn.com/properties.php#/p=options&ID={propertyId}&tab=lease`

Known current form structure includes:

- `#market ul.lease-input`
- `li.amount input.input-money:not([type=hidden])` for rental days
- `li.cost input.lease.input-money` for cost fields

The form integration must be defensive because Torn CSS classes and React markup can change.

Form preparation sequence:

1. Parse property ID from the hash.
2. Load the pending session draft for that exact ID.
3. Wait for the visible lease form with a bounded observer/timeout.
4. Fill days.
5. Fill total cost = `suggestedDaily * days`.
6. Dispatch `input` and `change` events.
7. Render an inline summary immediately beside the lease form.
8. Leave Torn's native submit control untouched.

If selectors fail, the script must show a clear `Form not recognized` message and leave the page unchanged rather than guessing.

## Safety and compliance requirements

Hard requirements:

- No programmatic native rental submission.
- No automatic `.click()` on Torn action controls that cause a request.
- No non-API background requests to `torn.com`.
- No loops that perform game actions.
- No CAPTCHA handling or bypass.
- No scraping other Torn pages in the background.
- No reading hidden/unfocused Torn pages for alerts.
- No external telemetry.
- No third-party backend.
- API key never appears in logs, DOM, URLs, exported data, or error messages.

Automatic behavior is limited to API calls, local calculations, UI updates, and input-field preparation on the actively viewed page.

## Persistence

Use browser-local storage only.

Suggested keys are namespaced under `r4g3_property_rental_manager`.

Persist:

- theme
- Simple/Advanced mode
- panel geometry
- API key
- default rental period
- undercut percentage
- minimum median ratio
- market cache
- last scan summary

Use `sessionStorage` rather than persistent storage for one-time pending lease drafts.

## Error handling

### API errors

- Invalid/insufficient key: show setup error and stop the scan.
- Rate limit: pause/retry through the scheduler, never spin.
- Network/transient API failure: retry a small bounded number of times.
- One market type failing does not erase successful data for other types.

### Data quality

- No market listings: mark `No market data`.
- Fewer than 3 usable prices: Low confidence.
- Invalid cost/day values: exclude them.
- Missing status because key access is too low: require a Limited-or-higher key instead of assuming availability.

### DOM changes

If the native lease form cannot be recognized, do not submit or synthesize network requests. Show a diagnostic status with the route and missing selector group.

## Testing strategy

Use Node 20+ and the same general testing discipline already used by Recruitment Agency.

Required automated coverage:

### `tests/property-core.test.js`

- ownership filtering
- status classification
- eligibility rules
- lease URL generation

### `tests/market-core.test.js`

- happy similarity
- modification Jaccard score
- comparable widening
- outlier removal
- quartiles/median
- 0.5% default undercut
- 70% median safety floor
- confidence grades

### `tests/api-core.test.js`

- 800 ms minimum spacing
- 75/min rolling cap
- unique-type market calls
- pagination
- `api.torn.com` continuation validation
- Authorization header use
- API key redaction

### `tests/draft-core.test.js`

- 1-365 day validation
- draft serialization
- property-ID matching
- expiry/clear behavior

### `tests/form-core.test.js`

Using jsdom fixtures:

- route detection
- lease-form detection
- days fill
- total-cost fill
- input/change event dispatch
- no submit click
- safe failure on missing selectors

### `tests/userscript-static.test.js`

Static safeguards:

- userscript matches `properties.php*`
- no external backend
- no `form.submit()`
- no native-submit `.click()` path
- no non-API Torn fetch/XHR helper
- no API key interpolation into URLs

## Release acceptance criteria

The first release is complete when all of the following are true:

1. Opening Torn Properties shows the manager without breaking Torn's native UI.
2. A Limited-or-higher API key loads all owned properties and statuses.
3. Rental market data is fetched automatically for every unique owned property type through the throttled scheduler.
4. Empty owned properties receive market statistics and a suggested daily rent.
5. Suggestions use comparable-quality filtering and outlier protection.
6. `Prepare Lease` stores exactly one draft and navigates to that property's native lease page only after the user's click.
7. The visible Torn lease form is auto-filled with period and total price.
8. The script never submits the lease itself.
9. Dark and light themes remain readable.
10. Desktop UI is movable/resizable and layout persists.
11. Simple mode is usable without exposing advanced pricing controls.
12. All tests and JavaScript syntax checks pass.

## Explicit non-goals for v1

- scanning the property sale market for investment purchases
- auto-buying properties
- automatic lease submission
- automatic repricing of already listed rentals
- automatic offer-extension submission
- external shared pricing database
- background notifications from unfocused Torn pages
