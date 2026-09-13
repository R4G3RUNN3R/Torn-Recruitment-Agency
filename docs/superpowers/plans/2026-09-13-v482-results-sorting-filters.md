# Recruitment Agency v4.8.2 Sortable Results and Recruitment Filters

## Status

APPROVED by George on 2026-09-13. This is a bounded refinement of the v4.8.1 Search & Results surface.

## Intended outcome

Make the simplified Company and Faction Search & Results workspaces faster to use without reintroducing the older cockpit-style interface:

- sortable Player, END, MAN, INT and Last Online headers;
- compact Online / Idle / Offline filtering;
- partial current Company/Faction text filtering;
- Any / None / Has Company/Faction presence filtering;
- visible Current Company/Faction result column;
- explicit None vs Unknown organisation state;
- preserve active forum/API acquisition and safe manual-send private chat.

## Non-goals

- no database migration;
- no change to Company/Faction workflow-state isolation;
- no automatic message sending;
- no redesign of advanced workspaces;
- no new Torn API rate or authority model;
- no inference that missing organisation data means None.

## Implementation

### 1. Pure result helpers

Add tested helpers to both `src/v46-company-platform.js` and `src/v47-faction-platform.js` for:

- organisation state/label normalization;
- filtering by search, work-stat minimums, online status, organisation text and organisation presence;
- sorting by Player, END, MAN, INT and Last Online with unknown values always last;
- deterministic sort toggling/default directions.

Company organisation precedence:

1. non-empty `currentCompany` -> Has + company name;
2. positive `currentCompanyId` without a name -> Has + `Company #<id>`;
3. explicit `currentCompanyId === 0` -> None;
4. otherwise -> Unknown.

Faction organisation precedence mirrors Company using `factionName` / `factionId` and `Faction #<id>`.

### 2. Simplified UI

Update `src/v46-company-ui.js` and `src/v47-faction-ui.js`:

- add Status selector;
- add organisation text filter;
- add Any / None / Has organisation selector;
- add Current Company/Faction result column;
- render sortable header buttons with active direction marker;
- retain current relative Last Online rendering and use explicit Online / Idle / Offline / Unknown fallback.

### 3. Wiring

Update Company/Faction platform event binding so:

- Search still invokes active forum/API acquisition exactly once;
- new filters are included in the active Search request state;
- clicking a sort header only sorts/rerenders local results and never triggers API/forum acquisition;
- Clear resets filters but not product/runtime safety settings.

### 4. Release version and documentation

Bump the public userscript/runtime/package to `4.8.2`, preserve the existing Voidsmith VPS `@downloadURL` and `@updateURL`, update README/release notes, rebuild the self-contained distribution, and keep runtime GitHub pins immutable where applicable.

## Risks and safeguards

- **Unknown vs None:** explicit zero IDs are the only safe membership absence signal. Missing fields stay Unknown.
- **Sort correctness:** null/unknown values remain at the bottom in both directions.
- **API load:** sort controls are local-only. Search remains the only acquisition action.
- **Messaging:** no changes to fresh membership verification, private-chat preparation or manual final Send.
- **Data isolation:** no DB schema or shared/private field ownership changes.

## Acceptance criteria

1. Company and Faction tables sort correctly by all five approved headers.
2. Repeated click toggles direction; switching columns uses the approved default direction.
3. Unknown values remain last for ascending and descending numeric/activity sorts.
4. Status filter matches Online/Idle/Offline exactly and Any disables it.
5. Organisation text matching is partial and case-insensitive.
6. Presence filter distinguishes Has, None and Unknown.
7. Current Company/Faction column follows the approved label fallback rules.
8. Search continues to acquire candidates through existing v4.8.1 forum/API orchestration.
9. Sort clicks do not perform Torn API or forum requests.
10. Full unit/runtime/browser suite, syntax check, bundle build and diff check pass before release.
11. VPS versioned/stable copies and HTTPS readback match the verified bundle hash before catalogue status is updated.

## Rollback

The release is additive and has no schema migration. Rollback is the previously verified v4.8.1 single-file release copied back to the stable VPS path, followed by HTTPS hash/version readback. Browser-local recruitment data remains compatible.
