# Recruitment Agency v4.5 Forum Discovery & Candidate Pipeline Design

## Goal

Turn recruitment-relevant Torn forum activity into actionable local candidate leads inside the existing Recruitment Agency Results/Scout/Smart Match workflow. v4.5 discovers job seekers and explicit train buyers, deduplicates them by Torn ID, preserves local pipeline state, and makes it fast to inspect, scout, classify, and message a candidate without creating a second competing candidate database.

## Design Principle

Forum Discovery is a **discovery source**, not a separate replacement Results system.

```text
Torn forum sources
      |
      v
Forum Discovery
      |
      v
Existing RA candidate/result record
      |
      +--> Scout
      +--> Smart Match
      +--> Hover candidate card
      +--> Candidate context menu
      +--> Pipeline stage
```

A Torn ID identifies one local candidate. Repeated posts update the same candidate and append source history while preserving recruiter-entered notes, availability overrides, expected salary, Smart Match metadata, and pipeline stage.

## Sources

Initial sources:

1. **Looking for Work / company recruitment posts**
2. **Explicit train buyers** from a configured marketplace/training thread
3. **Manual candidate** additions remain supported

Each candidate/source observation records provenance explicitly, for example:

```text
JOB SEEKER
TRAIN BUYER
COMPANY FORUM
MANUAL
```

The latest source reason is visible in the candidate hover/detail view. Source history remains available locally.

## Sync Behavior

The Forum Discovery section provides:

- `Sync Forum Posts`
- `Cancel Sync`
- `Open Torn Thread`
- `Open Training Thread`
- `Fill Companies`
- `Reset Forum Import`
- `Add Candidate`
- `Refresh View`

Sync status shows progress such as downloaded page count, recent posts found, candidates created/updated, and whether the recent-window page limit requires continuation.

### Continuation

Forum sync stores a local checkpoint/cursor. If the configured maximum pages are reached before the recent window is exhausted, the next manual Sync resumes from the checkpoint rather than starting from page one.

A completed recent-window sync advances the checkpoint to the newest processed boundary.

### API discipline

All Torn API requests use the existing shared Recruitment Agency Torn scheduler:

- hard maximum `75` Torn API calls/minute
- minimum `800 ms` between script Torn API calls
- forum sync, current-company fill, and any candidate enrichment cannot bypass the scheduler

No background non-API scraping of unseen Torn pages and no captcha/session bypassing are introduced.

## Candidate Deduplication and Source History

Candidates are keyed by Torn `userId`.

A repeated post:

- does not create a duplicate candidate;
- updates `latestForumPost` when newer;
- appends a deduplicated forum-source observation to local history;
- may update conservative parser-derived fields;
- never overwrites explicit recruiter-entered/manual fields;
- never resets pipeline stage, recruiter note, expected salary, or local availability override.

Recommended local source observation:

```js
{
  sourceId,
  userId,
  sourceType,
  threadId,
  postId,
  postedAt,
  postUrl,
  text,
  parsed: {
    desiredCompany,
    desiredCompanyStars,
    desiredRole,
    wantsTrains,
    trainAmountMin,
    trainAmountMax,
    primaryWorkStat,
    availability
  },
  importedAt
}
```

Forum text is local candidate/source data and is not added to Global Intelligence.

## Forum Intent Parsing

Parsing is conservative. v4.5 may recognize explicit signals such as:

- `looking for` / job-seeking intent
- Adult Novelties or other explicit company type
- explicit desired company stars such as `10* AN`
- `buying trains` / `looking to buy trains`
- explicit train amount or amount range when clearly stated
- explicit primary work-stat preference such as Intelligence
- explicit availability wording

Ambiguous language stays unknown. Parser-derived fields are marked as forum-derived and remain lower priority than recruiter-entered/manual values.

No model-generated guess is stored as fact without clear source text.

## Current Company and Work Stats

Forum candidates may be enriched with current company and available work-stat information using supported Torn API data already permitted by Recruitment Agency.

`Fill Companies` is a visible, cancelable operation that:

- processes candidates through the shared Torn scheduler;
- shows `checked X/Y` progress and lookup errors;
- updates local current-company display;
- does not alter pipeline stage or source history.

Where MAN / INT / END values are legitimately available from forum content or permitted API data, they may populate the existing candidate/result inputs. Missing values remain unknown rather than fabricated.

## Pipeline Stages

Use MoDuL's six visible stages exactly:

```text
Not Contacted
Shortlisted
Contacted
Replied
Hired
Rejected
```

Default for a newly discovered candidate: `Not Contacted`.

Stage changes are explicit local recruiter actions. Discovery, opening a profile, opening a message composer, or opening a forum post does **not** automatically advance stage.

`Hired` and `Rejected` may be treated as closed stages by the existing Active/closed filters, but the records remain locally available and can be reopened by changing stage.

## Candidate Context Menu

Right-clicking a candidate or using the keyboard-accessible equivalent opens:

```text
Message Player
View Details
Open Torn Profile
Open Latest Forum Post
-----------------------
Move to Stage >
    Not Contacted
    Shortlisted
    Contacted
    Replied
    Hired
    Rejected
Availability >
-----------------------
Scout Player
Edit Candidate
Delete Candidate
```

The menu is a fast-action surface. Detailed candidate information still lives in the v4.4 hover/detail experience and existing Results system.

`Delete Candidate` deletes the local candidate/import record only after confirmation. It does not affect Torn and cannot delete shared Global Intelligence data.

## Message Player

### Constraint

Recruitment Agency does not auto-submit Torn mail. `Message Player` prepares the message and opens Torn's compose UI addressed to the selected player. The recruiter remains responsible for the final Torn Send action.

### Default Recruitment Message

Settings -> Recruitment receives a local-only **Default Recruitment Message** editor.

Initial scope: one global default message, not multiple named templates.

The user may save text such as:

```text
Hi {name},

I saw your post about {looking_for}.

I run {company_name} and I think you may be a good fit.
If you're interested, feel free to message me back.
```

Supported placeholders:

```text
{name}
{player_id}
{looking_for}
{company_name}
{current_company}
{match_score}
{fit_score}
```

Placeholder values are escaped as plain text. If a value is unavailable, the placeholder is removed cleanly and surrounding whitespace/punctuation is normalized enough to avoid obvious broken template output.

The default message is stored locally with recruiter settings and is never uploaded to Global Intelligence.

### Message Preview Flow

`Message Player` opens a compact Recruitment Agency preview:

```text
Message GreenWall [2463973]

[prepared message text]

[Edit Message]
[Copy & Open Torn Message]
[Save as Default]
[Cancel]
```

Behavior:

1. Load the saved default message.
2. Substitute known candidate placeholders.
3. Let the recruiter edit this one message without changing the saved default.
4. `Save as Default` explicitly replaces the saved default with the current editor text.
5. `Copy & Open Torn Message` copies the prepared text to clipboard and opens Torn's compose page pre-addressed to the candidate.
6. Opening the compose screen does not automatically change stage to `Contacted`.

If clipboard access fails, the preview remains open with selectable text and the Torn composer can still be opened.

## Candidate Detail / Hover Integration

Forum Discovery extends the existing v4.4 candidate hover/detail view instead of creating a second permanent pipeline table.

Relevant added sections:

```text
RECRUITMENT
Stage
Availability
Source
Latest post time
Current company

LOOKING FOR
Latest forum intent summary
Train-buyer details when present
Primary work-stat preference when explicit

FORUM SOURCE
Latest forum post excerpt
[Open Latest Post]
```

Scout Fit and Smart Match remain visible separately.

Forum intent can feed Smart Match only where the active profile has a corresponding criterion and normal provenance/manual-precedence rules allow it.

## Results Integration

Forum-discovered candidates enter the existing RA Results/candidate system.

Supported local filters include:

- pipeline stage
- source type
- active candidates only
- Looking For / inferred explicit company type
- current company
- MAN / INT / END minimums
- text search over candidate name, Torn ID, company, explicit looking-for summary, and locally stored forum excerpt

No new permanent default column is required solely because a field exists. The existing Columns chooser remains the mechanism for optional display where appropriate.

Forum Discovery must not create a second authoritative candidate table or second candidate-ID namespace.

## Local Data Model

v4.5 is an additive IndexedDB upgrade after v4.4. Recommended DB version: `12`.

### Extend `candidateLocal`

Add local fields while preserving the v4.4 record:

```js
{
  userId,
  pipelineStage,        // six-stage enum
  availability,
  expectedSalary,
  recruiterNote,
  latestForumSourceId,
  discoverySources,    // compact source-type summary
  createdAt,
  updatedAt,
  ...existingV4_4Fields
}
```

### New `forumSources`

Key path: `sourceId`.

Indexes:

- `userId`
- `postedAt`
- `sourceType`
- `threadId`

Stores the source observation schema described above.

### New `forumSyncState`

Key path: `feedId`.

Stores configured thread IDs, recent-window cursor/checkpoint, last successful sync metadata, continuation state, and counters. It contains no Torn API key.

## Privacy and Global Intelligence Boundary

The following remain local and must never be added to the v4.3 Global Intelligence whitelist:

- forum post text/excerpts
- forum post URLs/history
- pipeline stage
- availability override
- expected salary
- recruiter notes
- default recruitment message
- prepared message text
- message preview/editor state
- discovery source history
- configured forum/thread workflow state beyond existing public player intelligence
- Match Score / Match Profile data

Global Intelligence continues to carry only its existing sanitized 16-field schema.

## Error Handling

- Forum API failure stops or pauses the current sync without corrupting the last successful checkpoint.
- Partial page success persists completed observations before presenting the failure.
- Cancel stops new work and leaves completed imports intact.
- Duplicate post IDs are ignored safely.
- A malformed forum post cannot crash Results; it is stored only when a valid Torn user identity/source record can be formed.
- Candidate parser failure leaves raw source text/history intact and parsed fields unknown.
- Company-fill failures are per-candidate and summarized; they do not abort all candidates unless the scheduler/request layer itself becomes unavailable.
- Message placeholder substitution never throws on missing candidate data.
- Clipboard failure does not lose the prepared message.
- Opening Torn profile/post/message links never changes pipeline stage automatically.

## Contextual Help

The v4.4 `ⓘ` system gains help entries for:

- Forum Discovery
- Sync Forum Posts
- Fill Companies
- Candidate Pipeline / Stage
- Message Player
- Default Recruitment Message

Help explains API usage, local storage, privacy, and the fact that Recruitment Agency prepares but does not auto-send Torn mail.

## Testing

### Forum/parser core tests

Prefer a pure `src/forum-core.js` module for:

- source normalization
- explicit train-buyer recognition
- company-type/stars parsing
- train amount/range parsing
- primary-stat parsing
- conservative availability parsing
- source deduplication key generation
- candidate/source merge precedence
- six-stage validation
- default-message placeholder substitution

Tests cover positive, negative, ambiguous, malformed, and duplicate cases.

### Userscript/static integration tests

Assert:

- userscript/package version target `4.5.0`
- DB version `12`
- additive `forumSources` and `forumSyncState` stores
- no `deleteObjectStore`
- six exact pipeline stages and no seventh hidden stage
- context menu contains Message Player, View Details, profile/post links, Move to Stage, Availability, Scout, Edit, Delete
- default message editor exists under Recruitment settings
- Message Player does not auto-submit mail and does not automatically set `Contacted`
- all forum/company enrichment Torn calls use the shared scheduler
- 75/min hard cap and 800 ms gap remain intact
- global whitelist remains unchanged
- local message/forum/CRM fields cannot enter global payloads
- protected Recruit Scout backends remain forbidden

### Regression

Run the complete Scout, Results, Global, Smart Match, Settings/help, forum, static, and syntax suites.

## Versioning and Roadmap

```text
v4.4  Smart Match + Settings + Contextual Help
v4.5  Forum Discovery & Candidate Pipeline
v4.6  Analytics & History
```

v4.6 can then use v4.5's explicit stages for local metrics such as discovered -> contacted -> replied -> hired conversion rates.

## Non-Goals for v4.5

- automatic Torn message submission
- automatic pipeline advancement based solely on opening a message composer
- multiple named recruitment-message templates
- globally shared recruiter CRM/pipeline state
- globally shared forum post text
- AI-generated recruiting messages
- background page scraping or captcha bypass
- a second standalone PPPE-style authoritative candidate database/table

## PPPE Source Review

This design is based on the observable behavior shown in MoDuL's PPPE screenshots and the features discussed with the user. When the PPPE Python source is provided, it should be reviewed for useful parsing/search/checkpoint ideas before v4.5 implementation. We may adapt concepts and algorithms where appropriate, but Recruitment Agency should keep its own API scheduler, local data model, privacy boundary, and existing Results/Scout/Smart Match architecture.
