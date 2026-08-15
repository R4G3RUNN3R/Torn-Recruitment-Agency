# Recruitment Agency v4.4 Smart Match Design

## Goal

Add local-only Smart Match vacancy profiles and candidate-specific recruitment metadata without turning the Results table into a wall of permanent columns. Smart Match answers a different question from Scout Fit: Fit measures the player's general activity/value signal, while Match measures suitability for the currently selected vacancy profile.

v4.4 also restores a prominent Settings entry point inspired by the original Recruitment Agency and adds contextual help to major UI sections so users can understand what each area does, what it checks, and which data source it uses without reading external documentation.

## Scope

v4.4 adds:

- local-only vacancy profiles
- a transparent 0-100 Match Score
- local candidate fields for desired company, desired role, expected salary, availability, and recruiter note
- a hover intelligence card attached to the player's name in Table and Cards views
- inline editing inside the hover card
- optional Match sorting/filtering and an optional Match column, disabled by default
- explicit confidence/completeness information when only some criteria are known
- a prominent `⚙ Settings` button in the main Recruitment Agency toolbar
- a collapsible Settings hub inside the main Recruitment Agency window
- relocation of the existing Simple/Advanced mode control into Settings
- consistent `ⓘ` help controls beside every major section heading
- plain-English help content describing each section's purpose, checks, and data source

v4.4 does not publish vacancy profiles, salary budgets, recruiter notes, role requirements, or candidate-local CRM data to Google Sheets. Global Intelligence remains limited to the v4.3 sanitized player-intelligence schema.

## User Experience

### Hover card

The player name becomes the hover target in Results Table and Cards. Hovering the name opens a compact intelligence card beside the player. The card remains open while the pointer is over either the player target or the card itself so the user can interact with controls without the card disappearing.

The default Results row remains unchanged. Candidate-specific fields are not added as permanent rows or default columns.

The card shows, when available:

```text
Player Name [ID]
Active vacancy profile

MATCH                         92 / 100
Scout Fit                     86
EE                            9
Activity 30d                  142h

WORK STATS
Manual                        5,430
Intelligence                  2,850
Endurance                     4,980

CANDIDATE
Desired company               Adult Novelties
Desired role                  Sales Assistant
Expected salary               $2m/day
Availability                  Immediate
Recruiter note                ...

MATCH BREAKDOWN
Work stats                    96%
EE                            100%
Scout Fit                     86%
Activity                      100%
Company preference            100%
Role                           100%
Salary                        90%
Availability                  100%

Completeness                  8 / 10 criteria known

[ Edit candidate ]   [ Scout ]
```

### Editing

`Edit candidate` switches the candidate section of the hover card into compact controls. Saving updates local IndexedDB data immediately and recalculates the Match Score without requiring a new Scout request.

Manual recruiter-entered values always take precedence over parser-derived guesses. Forum parsing may prefill only explicit, conservative values. Ambiguous information remains blank.

Unknown candidate-specific values do not count as a mismatch.

## Settings Hub and Contextual Help

### Main Settings button

The main Recruitment Agency toolbar includes a prominent `⚙ Settings` button. Clicking it expands a Settings hub inside the main Recruitment Agency window, directly beneath the existing header/status area. Clicking the button again or using the Settings close control collapses it.

Settings is not a separate managed/draggable window. It is the single obvious home for configuration and replaces the current pattern where configuration is mixed into the primary workflow surface.

The existing Simple/Advanced mode control moves inside Settings. The primary Recruitment Agency workflow remains uncluttered.

### Settings organization

The Settings hub is divided into these major subsections:

```text
GENERAL ⓘ
Theme
Density
Dock / launcher behaviour
Include inactive
Simple / Advanced mode

RECRUITMENT ⓘ
Company thread configuration
Faction thread configuration
Scan defaults
Enrichment defaults

SCOUT ⓘ
Torn API key
API rate / workers / call budget
Cache and history options

RESULTS ⓘ
Default view
Cards / Table preferences
Window layout reset

SMART MATCH ⓘ
Active Match Profile
Manage Match Profiles
Match display preferences

GLOBAL INTELLIGENCE ⓘ
Enable / Disable
Google Apps Script endpoint
Test connection
Retry global sync

DATA & RESET ⓘ
Reset window layout
Clear Scout cache
Clear local candidate data

DANGER ZONE ⓘ
Hard Reset / NUKE
```

Controls that already exist are moved/reorganized rather than duplicated. Existing persisted values continue to use their current storage keys unless v4.4 explicitly introduces a new setting.

The destructive hard reset remains visually isolated from ordinary reset/clear actions and keeps the project's existing confirmation behavior.

### Major-section help controls

Every major section or panel throughout Recruitment Agency receives a small `ⓘ` help control next to its heading. This includes, where present:

- Company recruitment
- Faction recruitment
- Scout
- Fit Settings
- Results Filters
- Results Columns
- Settings subsections
- Match Profiles
- Candidate / Match Breakdown sections
- Global Intelligence
- Data / Reset and Danger Zone

Individual inputs, checkboxes, and ordinary rows do not each receive a separate info icon. The goal is explanation without visual infestation.

### Help content contract

Each `ⓘ` control explains, in concise plain English:

1. what the section does;
2. what information it checks or changes;
3. where the information comes from or is stored;
4. whether the action can consume Torn API calls;
5. any important limitation or privacy note relevant to that section.

Examples:

```text
Scout
Checks current and historical Torn player activity and personal-stat signals used by Fit and Smart Match. Fresh scouting uses the Torn API and follows the script's global 75 calls/minute limit. Scout history is stored locally; only the v4.3 sanitized Global Intelligence fields may be shared when Global Intelligence is enabled.
```

```text
Smart Match
Compares a player against your currently selected local vacancy profile. Match is calculated entirely in your browser from available Scout/Results data plus your local candidate notes. Changing a Match Profile does not make Torn API calls and Match configuration is never uploaded to Global Intelligence.
```

```text
Global Intelligence
Uses the configured Google Apps Script service to contribute and retrieve sanitized player history. It never uploads Torn API keys, recruiter notes, salary expectations, availability, Match Profiles, or candidate CRM data.
```

### Help interaction

Help controls must work with both pointer and keyboard input:

- hover or focus reveals the explanation;
- click/tap pins or toggles it for touch devices;
- Escape closes the currently open help popover;
- only one help popover is open at a time;
- help text is rendered from a centralized static registry rather than duplicated inline across many render functions;
- popovers are clamped to the viewport and do not alter saved window geometry;
- help display never performs network requests.

The help control includes an accessible label such as `aria-label="About Scout"` and the popover is reachable by keyboard.

## Match Profiles

Profiles are local-only recruiter configuration. The Settings hub contains a `Smart Match` subsection with a `Match Profiles` manager where the user can create, duplicate, rename, edit, delete, and select an active profile.

Example profiles:

```text
Bad Decisions - Sales
Bad Decisions - Management
Training Candidate
Faction Recruit
```

A profile may configure targets or requirements for:

- Manual Labor
- Intelligence
- Endurance
- Employee Effectiveness
- Scout Fit
- Activity 30d
- Xanax 30d
- Refills 30d
- Attacks 30d
- Ranked War Hits 30d
- preferred company / desired company
- desired role
- expected salary budget
- availability

Each criterion has an enable flag and weight. Numeric criteria use a target. Categorical criteria use explicit matching rules.

One profile is active at a time. Switching the active profile recalculates all Match Scores locally and does not consume Torn API calls.

## Data Model

Recruitment Agency upgrades IndexedDB additively for v4.4.

Recommended database version: `11`.

### `candidateLocal`

Key path: `userId`.

```js
{
  userId,
  desiredCompany,
  desiredRole,
  expectedSalary,
  availability,
  recruiterNote,
  manualFields: {
    desiredCompany,
    desiredRole,
    expectedSalary,
    availability
  },
  createdAt,
  updatedAt
}
```

`manualFields` records which values were explicitly entered by the recruiter so parser-derived updates cannot overwrite them.

### `matchProfiles`

Key path: `profileId`.

```js
{
  profileId,
  name,
  criteria: {
    man:          {enabled, target, weight},
    int:          {enabled, target, weight},
    end:          {enabled, target, weight},
    ee:           {enabled, target, weight},
    fit:          {enabled, target, weight},
    activity30:   {enabled, target, weight},
    xanax30:      {enabled, target, weight},
    refills30:    {enabled, target, weight},
    attacks30:    {enabled, target, weight},
    rwHits30:     {enabled, target, weight},
    company:      {enabled, value, weight},
    role:         {enabled, value, weight},
    salary:       {enabled, max, weight},
    availability: {enabled, value, weight}
  },
  createdAt,
  updatedAt
}
```

The active profile ID lives in normal local Recruitment Agency settings.

Neither store participates in the v4.3 global upload queue or Google schema.

## Scoring Model

Match Score is calculated locally and independently from Scout Fit.

### Numeric target

For positive-is-better numeric criteria:

```text
componentRatio = min(actual / target, 1)
componentScore = componentRatio * weight
```

Examples include work stats, EE, Fit, Activity, Xanax, Refills, Attacks, and RW Hits.

### Salary budget

For salary, lower-or-equal to the configured maximum is a full match. When salary is known and exceeds the budget, the component degrades proportionally rather than creating a cliff:

```text
ratio = min(maxBudget / expectedSalary, 1)
componentScore = ratio * weight
```

### Categorical criteria

For company, role, and availability:

- known exact normalized match: full weight
- known mismatch: zero for that component
- unknown: excluded from the denominator

Role comparison is case-insensitive and whitespace-normalized. Company comparison uses existing canonical company keys. Availability uses a small normalized local enum rather than arbitrary free-text matching.

### Unknown values and denominator

Only enabled criteria with a known candidate value participate in the denominator.

```text
Match = earnedKnownWeight / availableKnownWeight * 100
```

A missing value therefore does not unfairly punish the candidate. The UI also displays completeness so a 90 based on three known criteria is visibly less complete than a 90 based on twelve.

If no enabled criteria have known values, Match is unmeasured rather than zero.

### Fit remains separate

Scout Fit is not replaced or renamed. Match may use Fit as one weighted input, but the two scores remain separately visible and sortable.

## Result Integration

### Default Results

No new default Results columns are added. Existing v4.3 default columns remain unchanged.

### Optional Match column

`Match` is added to the existing Columns chooser and is disabled by default. If enabled, it shows the active-profile score.

### Sorting and filtering

Results may sort by Match and filter by minimum Match using the active profile. These operations are local and consume no Torn API calls.

Changing candidate data or the active Match profile recalculates processed Results immediately.

### Cards view

Cards use the same hover-card component and Match calculation as Table view. There is one scoring path, not separate Table/Card implementations.

## Architecture

Create a pure `src/match-core.js` module with no DOM or IndexedDB dependency.

Responsibilities:

- profile normalization
- criterion normalization
- candidate normalization
- numeric/categorical component scoring
- denominator/completeness calculation
- normalized role/company/availability matching
- Match breakdown generation
- safe default profile creation

The userscript remains responsible for:

- IndexedDB persistence
- Settings hub expansion/collapse and subsection rendering
- Simple/Advanced mode control inside Settings
- centralized section-help registry and help-popover lifecycle
- Match Profile editor inside Settings
- active profile state
- hover-card lifecycle and positioning
- candidate editing
- combining local candidate data with existing Results/Scout data

`src/results-core.js` may receive only the minimum additions required to expose Match as a sortable/filterable row value. The Match algorithm itself stays isolated in `src/match-core.js`.

## Data Flow

```text
Existing Results / Scout row
        +
local candidateLocal record
        +
active matchProfiles record
        |
        v
RA_MatchCore.evaluateMatch(...)
        |
        +--> overall Match 0-100 or unmeasured
        +--> component breakdown
        +--> completeness
        |
        v
Results sort/filter + hover intelligence card
```

Editing a candidate or changing a profile triggers local recalculation only.

Settings/help data flow is entirely local:

```text
static HELP_CONTENT registry
        |
        v
ⓘ section control
        |
        v
single reusable help popover
```

No help action makes a network request or changes persisted recruitment data.

## Hover Behavior

The candidate hover card should use delegated pointer events rather than attaching permanent listeners to every rerendered row.

Behavior:

- open after a short hover delay to prevent accidental flicker
- cancel opening if pointer leaves before the delay
- remain open while pointer is over the target or card
- close after a short leave grace period
- clamp to viewport bounds
- prefer positioning to the right of the player; flip left when space is insufficient
- only one candidate hover card open at once
- Escape closes the card
- interactive controls receive normal pointer/focus behavior
- keyboard focus on a player target must also be able to open the card, so Match information is not mouse-only

## Privacy and Global Intelligence Boundary

The following v4.4 fields remain strictly local:

- vacancy profile names and criteria
- role requirements
- salary budgets
- desired role
- desired company when recruiter-entered
- expected salary
- availability
- recruiter note
- Match Score and Match breakdown
- Settings layout state beyond already-existing local preferences
- contextual help display state

`src/global-core.js` and the Apps Script whitelist do not change for these fields.

Smart Match may consume existing global historical player intelligence as a lower-priority fallback only when the normal v4.3 provenance rules allow it. Local/live player data remains preferred.

## Error Handling

- Corrupt or incomplete local profiles are normalized against safe defaults rather than crashing Results.
- Missing active profile falls back to a generated default profile or an explicit `No active Match profile` state.
- Unknown candidate values remain unknown rather than being coerced to zero.
- Invalid salary/work-stat text is rejected in profile/candidate editors and not persisted.
- Deleting the active profile selects another existing profile or creates the default profile.
- Hover-card rendering failure must not prevent Results from rendering.
- Match calculations never make network requests and cannot make Scout fail.
- A Settings subsection rendering failure must not prevent the main Recruitment Agency workflow from opening.
- Missing help text for a section must fail gracefully by hiding/disabling that section's info control rather than showing an empty popover.
- Help popover failures must never block the underlying section controls.

## Testing

### `tests/match-core.test.js`

Cover:

- numeric target scoring
- target caps at full weight
- salary at/below/above budget
- categorical match/mismatch/unknown
- unknown-value denominator exclusion
- completeness calculations
- no-known-criteria returns unmeasured
- profile normalization
- company normalization
- role normalization
- availability normalization
- manual-value precedence helpers if placed in the pure core

### Userscript static/integration coverage

Assert:

- userscript version is `4.4.0`
- DB version is `11`
- `candidateLocal` and `matchProfiles` are created additively
- no `deleteObjectStore`
- `match-core.js` is loaded
- hover-card UI and Match Profile controls exist
- main toolbar contains a `Settings` button
- Settings panel/hub can be toggled without creating a new managed window
- Simple/Advanced mode control is rendered inside Settings rather than the normal workflow toolbar
- Settings contains General, Recruitment, Scout, Results, Smart Match, Global Intelligence, Data & Reset, and Danger Zone subsections
- major section headings render `ⓘ` controls through a shared help helper/registry
- help supports pointer/focus/tap and Escape close behavior
- help text includes data-source/API/privacy context where relevant
- Match is not added to default visible columns
- optional Match filter/sort integration exists
- v4.3 Google whitelist remains unchanged and candidate/private fields cannot enter global payloads
- Torn API scheduler cap remains 75/min and 800 ms minimum gap
- protected Recruit Scout endpoints remain forbidden

### Regression

Run the entire existing Scout, Results, Global, static, and syntax suites. v4.4 must not alter Global Intelligence behavior, Torn API scheduling, current Results defaults, persisted configuration values, or existing recruitment scan behavior.

## Versioning

- userscript `@version`: `4.4.0`
- `SCRIPT_VERSION`: `4.4.0`
- `package.json`: `4.4.0`
- IndexedDB: `11`

## Non-Goals for v4.4

The following remain for later versions:

- globally shared vacancy profiles
- multi-recruiter shared CRM
- recruitment pipeline status analytics
- conversion-rate dashboards
- company-level analytics
- automatic salary negotiation or messaging
- Match-based automatic rejection/contact actions
- per-input help icons for every checkbox/text field
- remote or dynamic help content

v4.5 remains the planned Analytics & History upgrade.
