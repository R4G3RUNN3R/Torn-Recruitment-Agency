# Recruitment Agency Simple/Advanced + Window System Design

## Goal

Make Recruitment Agency significantly easier for normal Torn users without removing power-user controls. The default experience should be simple, readable, safe on Torn API limits, and launched from Torn's Information sidebar. Advanced users must still be able to expose detailed Scout/API/scoring controls without losing settings.

Target release: **v4.1.0**.

## Approved UX Decisions

- **Simple mode is the default.**
- A persistent **Simple / Advanced** toggle appears at the top of the main window.
- Switching modes never resets values; Advanced only reveals more controls.
- The selected interface mode is remembered between sessions.
- Fit targets and weights remain available in Simple mode, but inside a collapsed **Fit Settings** section.
- The normal launcher is a Recruitment Agency icon inserted into Torn's **Information** icon row.
- The current floating `RA` button becomes fallback-only when the sidebar target cannot be located.
- Main, Results, and Scout History are independent floating windows that can remain open simultaneously.
- Every Recruitment Agency window is draggable and resizable at all times.

## Simple Mode

Simple mode must expose only controls that are useful for ordinary recruiting/scouting workflows.

### Main header

The title bar contains:

- Recruitment Agency version
- Simple / Advanced toggle
- normal window controls

Simple is selected for first-time users.

### Company / Faction workflow

Visible controls:

- Mode: Company / Faction / Scout
- Target thread ID or Torn forum URL
- basic Name / ID filter
- MAN minimum
- INT minimum
- END minimum
- TOTAL minimum
- Full Scan
- Update Scan
- Open Thread
- Scout Selected
- Scout All
- collapsed Fit Settings
- Results
- Theme

The interface should avoid exposing API internals in this mode.

### Scout workflow

Visible controls:

- player IDs / Torn profile URLs
- Scout IDs
- Scout Search Users Page
- basic Faction filter
- basic Activity filter
- Min Level
- Min Fit
- Scout Selected
- Scout All
- collapsed Fit Settings
- Results
- Theme

### Fit Settings in Simple mode

Fit Settings is collapsed by default and contains the five scoring targets and weights:

- Xanax
- Activity hours
- Refills
- Attacks
- Ranked War hits

Opening or changing Fit Settings must not switch the UI to Advanced mode.

## Advanced Mode

Advanced mode keeps every Simple-mode control and additionally reveals technical settings.

Advanced-only controls include:

- API calls/minute display/control
- worker count
- API call budget
- historical API gap
- cache diagnostic
- cache verdict
- max-candidate limit
- Auto Scout new recruits
- detailed net-worth filters
- active-streak filters
- best-streak filters
- stat-enhancer filters
- detailed history/cache tools
- other technical diagnostics added later

Advanced values remain stored when the user switches back to Simple.

## API Rate Safety

All **Scout API requests** must use one global scheduler.

Requirements:

- default: **75 calls/minute**
- hard maximum: **75 calls/minute**
- minimum spacing between scheduled Scout calls: approximately **800 ms**
- multiple Scout workers may process records concurrently, but every outbound Scout Torn API request must pass through the same scheduler gate
- retries for temporary Torn errors must also pass through the scheduler gate
- the UI must not allow a stored/displayed rate above 75
- existing API call budget behavior remains available in Advanced mode

The scheduler is the authority. Worker count must never permit bypassing the global rate limit.

## Theme Design

### Dark theme

Dark theme must use readable neon-green foreground text throughout Recruitment Agency UI.

Primary text color: `#39ff14`.

This applies to:

- labels
- table text
- buttons
- inputs
- selects
- textarea contents
- links
- result values
- headings
- informational/help text

Muted/help text may use the same neon green or a slightly dimmed green, but must remain clearly readable against the dark background. It must not fall back to black.

### Light theme

Light theme uses black or near-black foreground text.

Primary text: `#000000`.
Muted text: `#111111` or another clearly readable dark value.

All controls explicitly inherit Recruitment Agency theme variables so surrounding Torn CSS cannot make their foreground unreadable.

## Torn Information Sidebar Launcher

Recruitment Agency should inject a small launcher icon into Torn's existing **Information** icon row.

Requirements:

- use an inline SVG; no remote image dependency
- visually match Torn's native icon sizing, alignment, hover area, and spacing
- tooltip/title: **Recruitment Agency**
- clicking the icon opens the main Recruitment Agency window if closed
- if already open, clicking the icon brings the main window to the front
- use the Recruitment Agency neon-green accent where appropriate in dark theme
- do not duplicate the icon if already present

### SPA/rerender behavior

Torn may rebuild sidebar DOM nodes during navigation.

A MutationObserver must:

- detect when the Information block/icon row appears or is replaced
- reinsert the Recruitment Agency icon when needed
- avoid duplicate insertions

### Fallback launcher

The floating `RA` button is not normally shown.

It appears only when:

- the Torn Information sidebar cannot be found, or
- icon insertion fails after the page settles

If the sidebar launcher later becomes available, the fallback button should disappear.

## Shared Floating Window Manager

Main, Results, and Scout History must all use one shared window-management implementation rather than separate drag/resize logic.

Each window receives:

- unique persistent window ID
- independent position
- independent size
- independent minimum width and height
- click-to-front stacking
- draggable title bar
- resizable edges and corners
- viewport recovery
- persisted geometry

### Drag behavior

- title bar is the drag handle
- interactive title-bar controls must remain clickable
- dragging must work regardless of Simple/Advanced state
- movement is not reset when mode, theme, or recruitment source changes

### Resize behavior

Windows must be resizable from all edges and corners.

The implementation may use CSS `resize: both` only if it provides reliable browser behavior and persistence hooks; otherwise explicit resize handles should be used.

Minimum dimensions prevent controls/tables from becoming unusable.

### Persistence

Store geometry in existing metadata/settings storage, keyed per window, for example:

- `main`
- `results`
- `history`

Persist:

- x
- y
- width
- height

Open/closed state may also be remembered where it improves usability, but startup must not unexpectedly cover the Torn page with every previous window unless deliberately specified later.

### Viewport recovery

When restoring a saved window:

- clamp dimensions to the current viewport
- guarantee a usable part of the title bar remains visible
- recover windows saved on a larger/different monitor
- respond sensibly to browser resize events

### Stacking

A shared z-index counter brings a window to the front whenever it receives pointer/focus interaction.

Main, Results, and History can all remain open at once.

Scout History is no longer treated as a fixed modal overlay; it becomes an ordinary floating tool window.

## Data and Settings Changes

Existing IndexedDB data must remain intact.

Additive settings include:

- UI complexity mode: `simple` / `advanced`
- per-window geometry

Migration must be non-destructive. Existing Scout history, latest Scout data, users, metadata, API key, formula settings, and forum scan history must be preserved.

For existing v4.0.x users with no saved complexity mode, default to Simple.

Existing API-rate values above 75 are clamped to 75 on load/save.

## Error Handling

- Sidebar icon insertion failure must not prevent Recruitment Agency from starting; show the fallback launcher instead.
- Corrupt/invalid saved window geometry falls back to safe default geometry.
- API rates that are missing, invalid, or greater than 75 resolve to the safe default/cap.
- Theme values must fall back to a known readable dark/light palette.
- Changing Simple/Advanced mode must not interrupt an active Scout run.

## Testing Requirements

### Static/integration tests

Add regression assertions for:

- release version `4.1.0`
- Simple is the default complexity mode
- Simple/Advanced setting exists and is persisted
- Fit Settings remains available in Simple mode
- Advanced-only controls have a consistent Advanced marker/container
- Scout API default rate is 75
- Scout API hard cap is 75
- scheduler formula produces at least 800 ms spacing at the cap
- dark theme primary text is neon green
- light theme primary text is black
- sidebar launcher injection function exists
- fallback launcher logic exists
- duplicate launcher protection exists
- MutationObserver recovery exists
- shared window manager exists
- Main, Results, History are registered as managed windows
- persisted geometry is read/written
- viewport recovery/clamping exists

### Existing tests

All current Scout scoring, delta, provisional Fit, Trend, clean-room dependency, IndexedDB migration, forum parsing, and JavaScript syntax tests must continue to pass.

### TDD sequence

For behavioral changes, add failing tests first, observe the expected failure, implement, then observe the suite pass.

## Out of Scope

This release does not:

- change the Fit formula itself
- reproduce Recruit Scout's proprietary grading formula
- add server-side services
- add remote authentication/membership/payment systems
- replace Company/Faction/Scout workflows with a wizard
- remove Advanced controls

## Success Criteria

The release is successful when a new user can open Recruitment Agency from Torn's Information sidebar, use Company/Faction/Scout workflows without seeing technical API controls, expand Fit Settings when needed, and get readable dark/light UI.

Power users can switch to Advanced and recover the full technical configuration.

No Scout workload can schedule requests faster than 75 calls/minute, regardless of worker count.

Main, Results, and History can be moved, resized, positioned independently, and retain sensible geometry across page reloads and viewport changes.
