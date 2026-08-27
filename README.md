# Torn Recruitment Agency

R4G3RUNN3R's Recruitment Agency **v4.7.6** is a modular Torn recruitment workspace with separate Company and Faction recruitment workflows over one shared Player Intelligence identity, plus official forum discovery, Scout intelligence, local-only Smart Match scoring, optional Global Intelligence, contextual help, and safe browser-local persistence.

The Scout, Results, Global Intelligence, Smart Match, Forum Discovery, Company Recruitment, and Faction Recruitment modules are clean-room implementations. They do not call, authenticate against, or depend on `rs.dnonetwork.com` or another proprietary Recruit Scout grading backend.

## v4.7.6 private-chat Recruit workflow

**v4.7.6** adds a clear **Recruit** action to Company and Faction candidate rows. Recruit performs a fresh official Torn v2 membership check before preparing contact: Company recruitment checks the target's current job/company, while Faction recruitment checks current faction membership. If the player already belongs to the relevant organization type, recruitment stops and reports that membership.

Company and Faction recruitment templates are separate, browser-local settings. Company supports `{name}`, `{company_name}`, and `{company_type}`; Faction supports `{name}` and `{faction_name}`. The defaults are editable and saved for reuse.

Recruitment contact uses **Torn private chat**, not Torn Messages/Mail. For an eligible player, the script opens the target profile, opens the Torn private-chat surface, inserts the prepared text, and focuses the chat input. The final Torn **Send** remains a manual player action: v4.7.6 does not click Send, synthesize Enter, auto-submit a chat, or mutate recruitment stage merely because a draft was prepared. Do Not Contact protections remain in force with the existing deliberate override path.

The feature keeps DB15 unchanged, preserves strict Company/Faction workflow isolation, uses the shared official Torn v2 scheduler, and does not expand the Global Intelligence whitelist. A real-Chrome regression verifies the private-chat draft handoff and explicitly asserts zero Send clicks and zero Enter submissions.

## v4.7.5 dark-theme readability hotfix

**v4.7.5 hotfix:** the public shell now protects Recruitment Agency text contrast from Torn-host CSS rules that can otherwise turn table and Settings text black on the application's near-black dark panels. Company and Faction table body text uses the bright green accent, secondary IDs/details remain muted but readable, table controls retain bright text, Settings section headings/labels/form values use the bright green accent, and the Danger Zone remains red.

The contrast rules are scoped beneath `#ra-app` and use explicit high-priority shell overrides only where the host page can win the cascade. This is a shell-only release: all **29** application modules remain immutably pinned to reviewed source commit `999a2f9eafd28891dc5de461f08b1d29bbd41eea`, and the core runtime remains **v4.7.4**. The v4.7.5 public wrapper reports its own shell version in the title bar while still requiring the reviewed v4.7.4 application runtime.

## v4.7.4 bootstrap ownership hotfix

**v4.7.4 hotfix:** the public bootstrap no longer silently yields when the shared Torn document is already owned by an older Recruitment Agency version. A mismatched owner now gets one clean reload to flush stale in-memory code. If the older owner returns after that reload, the current build reports the exact conflicting version instead of allowing two script versions to run together or pretending the update succeeded. This addresses the failure mode where newer route fixes could be installed yet never become the active runtime in the current Torn page.

## v4.7.3 navigation ownership hotfix

**v4.7.3 hotfix:** Recruitment Agency navigation now binds only to controls inside its own `#ra-nav` sidebar. v4.7.2 still used document-global `[data-page]` / `[data-nav-toggle]` selectors, so Torn-owned controls could be claimed by the Recruitment Agency router. When one of those controls supplied a value that was not a Recruitment Agency route, the old live router normalized to Company Overview. v4.7.3 also rejects invalid live route requests instead of converting them to Company Overview. Startup restoration still safely normalizes legacy persisted routes.

Regression coverage now reproduces the exact `faction-candidates -> company-overview` fallback using a foreign Torn-style `data-page="2"` control, verifies the Torn control keeps its own click handler, verifies invalid live routes leave the current Recruitment Agency page untouched, and exercises Faction Requirements in-page controls through both the public bootstrap and a Tampermonkey-like isolated userscript world.

## v4.7.2 routing hotfix (historical)

v4.7.2 made the central route state synchronous and added stale asynchronous-render protection. Those changes remain valid, but user testing proved they did **not** eliminate the live Company Overview snapback because a separate document-global navigation ownership defect still existed. v4.7.3 supersedes v4.7.2 for that live defect.

## v4.7 Faction Recruitment release

**v4.7.1 historical hotfix:** Faction page controls were changed to retain the route the recruiter selected during local control rerenders. That fix addressed one downstream symptom, but it did not eliminate the underlying split route-authority race later fixed in v4.7.2.

The v4.7 release family adds the complete Faction Recruitment slice alongside the existing Company Recruitment workflow without merging their private state.

- IndexedDB now upgrades additively through **DB15**. DB13 owns `playerIntelligence`, `companyRecruitment`, and `factionRecruitment`; DB14 adds `companyVacancies`, `companyCampaigns`, `companyRecruitmentConfig`, and `companyRecruitmentSessions`; DB15 adds `factionSpecialistProfiles`, `factionCampaigns`, `factionRecruitmentConfig`, and `factionRecruitmentSessions`. No prior object store is deleted.
- One Torn player ID maps to one shared Player Intelligence identity. Company and Faction stages, notes, follow-ups, campaigns, waivers, matching context, and workflow history remain separate and local.
- Company Recruitment keeps its dedicated Overview, Today, Discover, Candidates, Pipeline, Vacancies, Campaigns, Follow-ups, Timeline, Stage Aging, Contact Outcomes, Recruitment Sessions, Talent Pool, Reactivation, Opportunity Queue, and Compare routes.
- Faction Recruitment adds dedicated Overview, Today, Discover, Candidates, Pipeline, Requirements, Campaigns, Follow-ups, Timeline, Stage Aging, Contact Outcomes, Recruitment Sessions, Reactivation, Opportunity, and Compare routes.
- Faction Baseline Hard failures block only **Invite Ready** unless individually waived. Specialist Hard failures affect only that specialist profile and never block Invite Ready when the baseline is eligible. Manual specialist pins are never silently overwritten.
- Faction waiver management records baseline or specialist scope, reason, review date, Active/Resolved state, and resolution history while keeping the failed underlying requirement visible. DNC remains a separate explicit flag and recruitment messaging remains manual-send only.
- Scout and recruitment observations update shared Player Intelligence only through the approved fact-field boundary; recruitment-private fields never enter Global Intelligence through the generic merge path.
- The public userscript pins all **29** runtime modules immutably to the reviewed v4.7.4 source commit recorded below. Its release regression suite fetches the exact pinned `v45-app.js` and verifies that its `SCRIPT_VERSION` equals the installer's expected runtime version before publication.

## What's new in v4.5

v4.5 replaces the older multi-window recruitment workflow with one managed, movable, resizable application shell and routed workspace.

### Recruitment

- **Overview** with Active, High Match, Shortlisted, and Replied KPIs
- **Discover** for Company Forum, Faction Forum, and explicit Train Buyer discovery
- **Candidates** as the single authoritative local candidate workspace
- **Pipeline** with exactly six stages:
  - Not Contacted
  - Contacted
  - Replied
  - Shortlisted
  - Hired
  - Rejected
- Add Candidate for direct Torn player IDs
- Fill Companies for sequential current-company enrichment
- Candidate detail drawer, reusable hover intelligence, context menu, keyboard access, inline stage changes, and Table/Card views
- Local recruitment-message preparation with approved placeholders and manual Torn compose only

### Intelligence

- **Scout** with direct player-ID scouting, queue/progress controls, pause/cancel, local cache/history, Fit, provisional Fit, and Trend
- **Smart Match** with local Match Profile management and zero Torn API calls for scoring
- **Global Intelligence** with strict sanitized field sharing and local retry queue

### Application

- **Settings** as a real routed page opened from the title bar without a duplicate sidebar entry
- **Data** for local store counts and CSV export
- **Logs** for sanitized local diagnostics in Advanced mode
- Simple/Advanced interface modes
- Responsive layout, saved normal-window geometry, collapsible sidebar, Torn Information launcher, and floating fallback launcher
- Routed content scrolls inside the managed window with a visible scrollbar while the title bar, page header, and sidebar remain in place
- **Maximize / Restore** fills the browser viewport without using browser fullscreen and restores the previous normal window geometry
- Centralized contextual help anchored to the relevant panel or section
- Dark theme with protected high-contrast green/off-white text, plus a light theme with black/dark text
- Proper **NUKE IT ALL!** Danger Zone reset scoped only to Recruitment Agency browser-local data

## Candidate workspace

A single Torn player ID maps to one local candidate record. Forum discovery, manual editing, Scout data, Match data, and company enrichment all compose into that candidate view without creating a second authoritative candidate database.

The default Candidates columns are:

`Player | Stage | Match | Fit | Looking For | Source | Last Active`

Additional columns can be enabled for company, work stats, availability, EE, Activity 30d, posted time, and Scout status.

Candidate filters include:

- text / player ID
- pipeline stage
- source
- Looking For
- current company
- minimum Match
- minimum Fit
- active-only
- advanced MAN / INT / END / Activity criteria

Opening a Torn profile, forum source, candidate detail view, or message compose window **does not change pipeline stage**.

## Forum Discovery

Forum Discovery uses Torn's official v2 API only.

Discovery supports:

- Company Forum
- Faction Forum
- explicit Train Buyer posts
- manual candidate entry

The import sequence is intentionally safe:

1. Fetch the forum page.
2. Validate/normalize posts.
3. Persist forum source observations locally.
4. Merge into the single local candidate record.
5. Persist counters.
6. Persist the sanitized continuation checkpoint **last**.

If a page fails or the user cancels, already-saved work remains intact and the safe checkpoint is not advanced past unsaved candidate data.

Continuation URLs are accepted only from `api.torn.com` v2 paths and credential-shaped query parameters such as `key` and `comment` are removed before persistence.

## Recruitment messaging

Messages are prepared locally and are never sent automatically.

Supported placeholders are:

`{name}`, `{player_id}`, `{looking_for}`, `{company_name}`, `{current_company}`, `{match_score}`, `{fit_score}`

The workflow is:

1. Prepare/edit the message locally.
2. Optionally save it as the single global default recruitment message.
3. Copy the prepared text.
4. Open Torn's message compose page addressed to the player.
5. The user manually sends the message in Torn.

Opening message compose does **not** automatically move a candidate to Contacted.

## Smart Match

**Fit** and **Match** answer different questions.

- **Fit** is the general Scout activity/value signal calculated from player activity data.
- **Match** is suitability for the currently active local vacancy profile.

A Match Profile can enable any combination of MAN, INT, END, EE, Fit, Activity 30d, Xanax 30d, Refills 30d, Attacks 30d, RW Hits 30d, company, role, salary, and availability.

Numeric criteria scale linearly up to their target and then cap at full credit. Salary receives full credit at or below budget and degrades proportionally above it. Known categorical mismatches score zero for that criterion.

Unknown candidate-specific values are **excluded from the denominator** rather than treated as zero. If none of the enabled criteria are known, Match is **Unmeasured**, not `0`.

Smart Match remains deliberately local:

- Match Profiles stay in browser IndexedDB.
- Desired Company, Desired Role, Expected Salary, Availability, and Recruiter Note stay local.
- Match Score and Match breakdown are calculated locally.
- Editing a candidate or Match Profile recalculates Match with **zero Torn API calls**.

## Scout

Scout collects current Torn player intelligence through the same shared scheduler used by every Recruitment Agency Torn API request.

It supports:

- direct Torn player IDs / profile URLs
- current Personal Stats totals
- 7-day and 30-day historical windows where available
- Fit and provisional Fit
- weighted Trend
- local Scout cache/history
- configurable workers and per-run request budget
- pause and cancel controls

### API pacing

The application enforces a hard maximum of **75 Torn API calls per minute** and a minimum spacing of **800 ms** between Recruitment Agency Torn API calls.

Workers cannot bypass the shared scheduler. Forum Discovery, Fill Companies, Scout, and other Torn enrichment all pass through the same gate.

Smart Match scoring, local filtering/sorting, contextual help, and Google Apps Script traffic do not consume Torn API calls.

## Fit model

Default 30-day targets:

| Metric | Target | Weight |
|---|---:|---:|
| Xanax | 60 | 20 |
| Activity | 120 hours | 20 |
| Refills | 25 | 20 |
| Attacks | 200 | 20 |
| Ranked War hits | 40 | 20 |

Each component is linear and capped at its normalized weight:

`component = min(actual / target, 1) * normalizedWeight`

Weights are normalized to 100 automatically.

## Global Intelligence

Global Intelligence optionally contributes and reuses sanitized historical Torn player observations through a Google Apps Script web app backed by a private Google Sheet.

The shared schema is deliberately strict. Only these fields are eligible to leave the browser:

`playerId, name, observedAt, level, ee, activity30, xanax30, refills30, attacks30, rwHits30, networth, fit, fitType, lastActive, scoutStatus, sourceVersion`

The following remain local and are not part of the Global Intelligence schema:

- Torn API key
- forum text
- forum source URLs/history
- pipeline stage
- recruiter notes
- salary/pay negotiations
- availability overrides
- Smart Match Profiles
- Match Score and Match breakdown
- prepared/default recruitment messages
- local workflow state
- Google credentials

Fresh Scout measurements are stored locally first. Sanitized observations may then be queued for Global Intelligence. A Global Intelligence failure does not turn a successful local Scout measurement into a failure.

The reproducible Apps Script service lives in [`global/google-apps-script/`](global/google-apps-script/). Follow [`global/google-apps-script/README.md`](global/google-apps-script/README.md) to deploy it and configure the `/exec` endpoint under **Settings → Global Intelligence**.

The userscript remains functional without a Global Intelligence endpoint.

## Local storage and DB15

The current v4.7 application uses IndexedDB version **15** with additive migration only. DB13 introduces the shared/domain foundation, DB14 adds Company support stores, and DB15 adds Faction support stores. Existing stores are preserved.

Legacy v4.5 recruitment stores remain part of the additive upgrade path and include:

- `candidateLocal`
- `forumSources`
- `forumSyncState`
- Scout latest/history stores
- Global latest/history/queue stores
- Match Profiles
- sanitized application logs
- application settings/layout metadata

The upgrade path does not delete existing object stores.

### NUKE IT ALL!

The Danger Zone hard reset clears Recruitment Agency browser-local data, including candidate/forum data, Scout cache/history, Global cache/queue, Match Profiles, settings, layouts, local logs, default message, and workflow state.

It does **not** touch Torn account data, unrelated browser storage, or other userscripts.

## Settings

v4.5 Settings contains exactly these eight sections:

1. General
2. Recruitment
3. Scout
4. Candidates
5. Smart Match
6. Global Intelligence
7. Data & Reset
8. Danger Zone

Simple mode keeps the normal recruitment workflow visible while hiding technical noise such as Logs. Advanced mode exposes the additional operational/diagnostic controls without resetting saved settings.

## Install

Install [`R4G3RUNN3R-Recruitment-Agency.user.js`](R4G3RUNN3R-Recruitment-Agency.user.js) in Tampermonkey or another compatible userscript manager.

The public userscript metadata and shell version are **4.7.5**. All **29** application modules are loaded through immutable commit-pinned `@require` URLs pointing to reviewed source commit `999a2f9eafd28891dc5de461f08b1d29bbd41eea`. The pinned application core runtime remains **v4.7.4**, so the wrapper's `EXPECTED_APP_VERSION` deliberately remains `4.7.4`. `@updateURL` and `@downloadURL` remain on `main` for normal userscript-manager updates.

A Torn API key is stored only in the browser database used by Recruitment Agency. Torn API requests are made directly from the browser through the application scheduler.

## Testing

The repository test workflow runs:

```bash
npm test
npm run syntax
```

The v4.7 release regression suite covers Company/Faction workflow isolation, the exact domain stage contracts, additive DB11→DB15 upgrades, Faction waivers and specialist matching, shared Player Intelligence boundaries, the Global Intelligence whitelist, API pacing, manual messaging, routed UI/browser interaction, immutable userscript dependency order, exact pinned-runtime version integrity, state-first Company/Faction route ownership, stale asynchronous render rejection, dark-theme computed-style protection against hostile Torn CSS, and JavaScript syntax.

## Version history

- **v4.7.5** - protects dark-theme Company/Faction tables and Settings text from Torn host CSS, using neon-green primary text, readable muted/bright controls, and preserved red Danger Zone styling while retaining the immutable v4.7.4 core
- **v4.7.4** - detects stale/duplicate bootstrap ownership, performs one clean recovery reload, and reports persistent older-owner conflicts instead of silently yielding
- **v4.7.3** - scopes Recruitment Agency navigation ownership to its own sidebar, preserves Torn-owned controls, rejects invalid live routes instead of falling back to Company Overview, and adds public-bootstrap/isolated-world in-page regressions
- **v4.7.2** - central state-first route authority and stale asynchronous-render protection; valid but incomplete for the live Company Overview snapback, which still had a separate document-global navigation ownership cause
- **v4.7.1** - Faction route-control hotfix and complete Faction Recruitment workflow; later found incomplete for the broader live route-authority race fixed in v4.7.2
- **v4.6.0** - Company Recruitment foundation and complete Company workflow slice (publication later superseded by v4.7.1 after an immutable runtime-pin mismatch was detected)
- **v4.5.4** - internal routed-content scrolling, duplicate Settings navigation cleanup, viewport Maximize/Restore with normal-geometry preservation
- **v4.5.0** - routed recruitment application, Forum Discovery pipeline, unified candidate CRM, six-stage Pipeline, messaging workflow, DB12, Scout/Smart Match/Global pages, Settings/Data/Logs, privacy and release hardening
- **v4.4** - Smart Match and Settings/contextual-help improvements
- **v4.3** - optional Global Intelligence shared-history layer
- **v4.2+** - Results Intelligence, filtering/sorting, Scout integration and workflow hardening

## Notes

Recruit Scout was used only to understand observable behavior and Torn API usage patterns. This project implements its own scoring, storage, UI, scheduling, forum discovery, candidate workflow, history, sorting/filtering, Smart Match, global sanitization, and shared-history service.
