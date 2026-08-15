# Recruitment Agency v4.2 Results Intelligence Design

## Goal

Make Recruitment Results simple by default while allowing users to sort and filter deeply when they choose. v4.2 replaces the current single sort dropdown with a reusable results engine that powers Table, Cards, and CSV consistently.

The default Results experience stays intentionally small:

```text
Recruitment Results                         [Filters] [Columns]
Search: [ Name / ID ]
42 candidates · Sorted by Fit ↓
[ Results ]
```

Advanced recruitment data is available on demand rather than shown as a wall of controls.

## Scope

v4.2 includes:

- clickable sortable Results headers
- reverse sort on repeated click
- per-mode remembered sort state for Company, Faction, and Scout
- a compact default column set
- an optional Filters panel containing all available filters
- an optional Columns panel for choosing visible columns
- new result fields: EE, Preferred Company, Activity 30d, Last Active, and Scout Status
- K/M/B numeric input parsing for filters
- identical filtered/sorted ordering for Table, Cards, and CSV
- missing-value-last sorting
- touch/PDA-safe header controls
- Reset Window Layout
- visibly disabled scan/scout controls while an operation is running
- improved bounded/debounced Torn SPA/sidebar recovery
- extraction of pure Results logic into a testable module

Out of scope for v4.2:

- candidate CRM/statuses/notes
- shared/community history backend
- vacancy Match Scores
- saved named filter presets
- historical charts/heatmaps
- virtualized rendering for very large datasets
- salary/role/availability NLP parsing beyond Preferred Company

## Architecture

Create a new pure module:

`src/results-core.js`

The userscript loads it with `@require` alongside `src/scout-core.js`. It owns data-normalization helpers, column definitions, comparison/sorting, K/M/B parsing, filter predicates, Scout freshness classification, and conservative Preferred Company parsing.

The userscript remains responsible for DOM rendering, IndexedDB persistence, Torn API access, window management, event binding, and operations.

This boundary keeps the expanding Results feature independently testable and prevents the main userscript from becoming the place every future feature goes to die.

## Column Model

Each Results column is described by a definition similar to:

```js
{
  key: 'ee',
  label: 'EE',
  type: 'number',
  sortable: true,
  defaultDirection: 'desc',
  getValue(row) { ... }
}
```

Column definitions control:

- label
- semantic type
- whether the column is sortable
- first-click sort direction
- normalized sort value
- table/card display behavior
- whether it is in the default visible set

Sortable columns include, where data exists:

- Player
- MAN
- INT
- END
- TOTAL
- EE
- Preferred Company
- Fit
- Trend
- Activity 30d
- Last Active
- Scout Status
- Level
- Xanax 30d
- Refills 30d
- Attacks 30d
- RW Hits 30d
- Net Worth
- Active Streak
- Best Streak
- discovery/post date
- Scout data age

## Default Columns

The initial visible Results table stays compact:

```text
Player | EE | Preferred Company | Activity | Last Active | Fit
```

Users can open **Columns** to add or remove supported columns. Column visibility is remembered per recruitment mode.

The Columns panel is closed by default on a fresh installation.

## Sorting Behavior

Clicking a sortable header selects that column. Clicking the active header again reverses its direction.

Examples:

```text
EE ↓
EE ↑
```

Numeric/performance columns default to descending. Text columns default A-Z. Last Active defaults to most recently active first.

The active header uses a visible arrow and `aria-sort`.

Missing values always sort after measured values regardless of direction. Reversing EE therefore produces:

```text
7
8
9
10
—
—
```

rather than promoting missing data above actual candidates.

Sorting is stable: equal values retain deterministic order by player name then Torn ID.

Sort state is stored separately for:

- Company
- Faction
- Scout

Fresh installs default all three to `Fit desc`.

Existing `resultSort` values are migrated to the closest new sort key without deleting other settings.

## Unified Results Pipeline

Every presentation uses the same processed array:

```text
Raw candidates
    ↓
Normalize fields
    ↓
Apply active filters
    ↓
Apply active sort
    ↓
Render Table / Cards
    ↓
CSV export
```

There must be no separate CSV sort implementation and no independent Card ordering.

If the UI says `37 candidates · Activity ↓`, Table, Cards, and CSV all contain those same 37 candidates in the same order.

## Filters UX

Results opens with only the Name / ID search visible.

A **Filters** button opens an optional filter panel. All detailed recruitment filters live there.

The filter panel can include:

- MAN minimum
- INT minimum
- END minimum
- TOTAL minimum
- EE minimum/maximum where useful
- Preferred Company
- Activity 30d minimum
- Last Active maximum idle age
- Fit minimum
- Level range
- Net Worth minimum
- Scout Status
- Faction state
- Active Streak minimum
- Best Streak minimum
- Stat Enhancers minimum
- Xanax 30d minimum
- Refills 30d minimum
- Attacks 30d minimum
- RW Hits 30d minimum
- discovery/data age constraints

The default filter set is empty.

Filter values are remembered separately for Company, Faction, and Scout so a user can return to a working recruitment view. However, the Filters panel itself defaults closed for new users. When hidden filters are active, the Results toolbar must make that obvious, for example:

```text
[Filters · 5]
```

A visible **Clear Filters** action resets the active mode's filters without touching sort, columns, Fit settings, or candidate data.

This avoids the dangerous UX where an old invisible filter silently removes candidates with no indication why.

## Numeric Input Parsing

Relevant numeric filter inputs accept ordinary numbers and Torn-style shorthand:

- `50k` → 50,000
- `2.5m` → 2,500,000
- `1b` → 1,000,000,000

Suffixes K/M/B are case-insensitive.

Invalid text does not silently become zero. The input is marked invalid and that filter is not applied until corrected or cleared.

## EE

EE is a numeric sortable/filterable result field when a trustworthy value exists in the candidate record/enrichment data.

Unknown EE displays `—` and sorts last.

v4.2 does not invent EE from unrelated stats.

## Preferred Company

Preferred Company parsing is deliberately conservative.

The parser recognizes explicit company-type statements and normalizes recognized names/abbreviations to the existing Torn company-type list. Examples include explicit wording such as:

- `looking for Adult Novelties`
- `prefer AN`
- `want a logistics company`
- `looking for 10* PSF`

Ambiguous references remain unknown rather than being guessed.

The normalized value supports sorting and filtering. The original forum text remains unchanged.

Richer extraction of role, salary, availability, and alternative preferences is deferred to the recruitment-parser release.

## Activity 30d

Activity 30d uses Scout's measured 30-day `useractivity` window when available.

Young-account/account-to-date projections remain visibly provisional. No Scout measurement displays `—`.

Sorting uses the numeric measurement, not formatted text.

## Last Active

Last Active is separate from Activity 30d and represents how recently the player was active according to the best current Torn status/last-action information available to the script.

Display examples:

```text
Online
12m
3h
2d
18d
—
```

Sorting uses a normalized timestamp/idle-seconds value, never the display string.

First-click sort order is most recently active first.

## Scout Status

Each row can display a compact Scout data state:

- LIVE
- FRESH
- CACHED
- PROVISIONAL
- STALE
- FAILED
- UNSCOUTED

The classification is based on current/local Scout state and data age. It is descriptive, not an additional Fit formula.

The sort ranking is deliberate rather than alphabetical:

```text
LIVE
FRESH
CACHED
PROVISIONAL
STALE
FAILED
UNSCOUTED
```

No community-history state is added in v4.2.

## Cards

Card view consumes the same column definitions, filters, and sorted array as Table view.

Cards show the compact default fields plus any user-selected visible columns that have a useful card representation.

Switching Table/Cards never changes filtering or sorting.

## CSV

`Copy CSV` exports the currently filtered result set in the currently sorted order.

It exports visible/user-selected columns by default so the export corresponds to what the user is reviewing.

A future separate database-export feature may export all stored data; v4.2 does not overload Results CSV with that purpose.

## Window Layout Reset

Advanced Settings gains **Reset Window Layout**.

It clears stored geometry for Main, Results, and Scout History, then restores safe default positions/sizes through the existing shared window manager.

It does not clear recruitment data, filters, settings, API key, or Scout history.

## Busy-State Controls

While a forum scan or Scout queue is running, controls that would start conflicting duplicate work are visibly disabled.

Examples include:

- Full Scan
- Update Scan
- Scout IDs
- Scout Search Users Page
- Scout Selected
- Scout All

Pause/Resume/Cancel continue to reflect the active Scout state.

The underlying guards remain in place; disabling controls is explanatory UX, not the only concurrency protection.

## Torn SPA / Sidebar Recovery

Use a bounded recovery strategy:

1. initial sidebar attempt
2. a short retry burst after load/navigation
3. hash/popstate handling where appropriate
4. one debounced MutationObserver path

Do not create observers per mutation or continuously rescan unrelated DOM.

The launcher remains deduplicated and the floating RA fallback remains available when the Torn Information section cannot be found.

## Touch / PDA Behavior

Sortable headers must use the entire header cell/button as the touch target and must not depend on hover to communicate state.

Arrows remain visible on the active sort on desktop and mobile.

The Results window keeps Cards available for narrow displays. v4.2 does not require automatic forced Card mode, but no new control should be hover-only.

## Persistence

Extend application metadata additively. Conceptually:

```js
results: {
  company: {
    sort: { key: 'fit', direction: 'desc' },
    filters: {},
    visibleColumns: [...]
  },
  faction: { ... },
  scout: { ... },
  filtersOpen: false,
  columnsOpen: false
}
```

Exact storage shape may follow the existing metadata conventions, but requirements are:

- migration is additive
- current IndexedDB stores/history remain intact
- old `resultSort` is migrated
- per-mode sort/filter/column values survive reloads
- fresh installs start with no detailed filters and compact columns
- active hidden filters are always disclosed via an active-filter count/status

## Testing

Add `tests/results-core.test.js` for pure behavior including:

- numeric ascending/descending sorting
- text sorting
- Last Active sorting
- Scout Status ranking
- missing values always last in both directions
- deterministic tie-breaking
- K/M/B parsing
- invalid numeric input
- Preferred Company conservative parsing
- filter combinations
- per-mode default sort configuration

Update `tests/userscript-static.test.js` to require:

- userscript version `4.2.0`
- `@require` for `src/results-core.js`
- Results Filters and Columns controls
- sortable-header/`aria-sort` wiring
- Reset Window Layout
- busy-state update function
- bounded/debounced sidebar recovery markers
- preservation of existing v4.1 API safety, theme, window, Scout, and no-paid-backend tests

CI must continue running Node unit tests and JavaScript syntax checks.

## Release Version

This feature set ships as **Recruitment Agency v4.2.0**.

## Success Criteria

v4.2 is successful when:

1. A fresh user sees a compact Results screen rather than every filter/control.
2. Any supported header can be clicked to sort and clicked again to reverse.
3. Missing data never outranks measured data merely because direction changed.
4. Company, Faction, and Scout remember independent sort/filter/column choices.
5. Active hidden filters are visibly disclosed and can be cleared in one action.
6. Table, Cards, and CSV always agree on which candidates are included and their order.
7. EE, Preferred Company, Activity 30d, Last Active, and Scout Status can be sorted and filtered when available.
8. Numeric filters accept K/M/B shorthand safely.
9. Existing user/Scout/history/settings data survives the upgrade.
10. Existing 75 calls/minute API safety remains unchanged.
11. The script remains independent of Recruit Scout or any paid/proprietary backend.
