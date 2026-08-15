# Approved Additions Lock - 2026-08-16

This addendum records approved requirements that extend the existing v4.4 Smart Match design/plan and v4.5 Forum Discovery design. These decisions are implementation requirements unless the user explicitly changes them later.

## v4.4 Settings and Contextual Help

The v4.4 implementation must include the already-approved Settings/help additions in addition to Smart Match:

- Add a prominent `Settings` button in the main Recruitment Agency toolbar.
- Settings expands/collapses inside the main Recruitment Agency window rather than opening a separate managed window.
- Move the existing Simple/Advanced mode control into Settings.
- Organize Settings into major subsections:
  - General
  - Recruitment
  - Scout
  - Results
  - Smart Match
  - Global Intelligence
  - Data & Reset
  - Danger Zone
- Reuse existing persisted settings rather than duplicating controls/state where possible.
- Put a contextual `info` control beside every major section/panel, not beside every individual input.
- Centralize help copy in one static registry/helper.
- Each help entry explains:
  1. what the section does;
  2. what it checks/changes;
  3. data source/storage location;
  4. whether Torn API calls are consumed;
  5. privacy/important limitations when relevant.
- Help must support pointer hover/focus, click/tap, Escape close, keyboard access, a single open popover, and viewport clamping.
- Help display performs no network requests and must never block the underlying section.
- Add static/integration coverage for the Settings button/hub, moved Simple/Advanced control, subsection presence, centralized help controls, keyboard/tap behavior, and privacy/API wording expectations.

## v4.5 Forum Discovery and Candidate Pipeline

The v4.5 design remains one candidate system. Forum Discovery feeds the existing Results/Scout/Smart Match/candidate model rather than creating a second authoritative PPPE-style database.

### Pipeline stages

Use exactly these six visible stages:

1. Not Contacted
2. Shortlisted
3. Contacted
4. Replied
5. Hired
6. Rejected

Do not add a hidden or automatic seventh stage. Opening a profile, forum post, or message composer never changes stage automatically.

### Candidate context menu

The candidate context menu must include:

- Message Player
- View Details
- Open Torn Profile
- Open Latest Forum Post
- Move to Stage -> the six exact stages above
- Availability
- Scout Player
- Edit Candidate
- Delete Candidate

`Message Player` should appear at or near the top of the menu.

### Message Player behavior

- Recruitment Agency prepares a message but does not auto-submit Torn mail.
- Open Torn's compose UI pre-addressed to the selected player.
- The recruiter remains responsible for the final Send action.
- Opening the composer does not automatically mark the candidate `Contacted`.
- A compact local preview/editor appears before opening Torn mail.
- The preview supports editing the one-off message, copying it, opening Torn compose, canceling, and explicitly saving the edited text as the default.
- Clipboard failure must not destroy the prepared message.

### v4.5 default recruitment message

Initial v4.5 scope includes one locally stored configurable default recruitment message under Settings -> Recruitment.

Supported candidate/recruitment placeholders include at least:

- `{name}`
- `{player_id}`
- `{looking_for}`
- `{company_name}`
- `{current_company}`
- `{match_score}`
- `{fit_score}`

Unknown placeholders are removed cleanly rather than left visible in the generated message.

The default message, prepared message text, and message editor state remain local-only and must never enter Global Intelligence.

## Later Named Context-Aware Message Templates

Named templates are intentionally deferred until after the initial v4.5 messaging foundation is stable, but the architecture must avoid blocking them.

The template system should eventually support at least these purposes:

- Own Company Recruitment
- Faction Recruitment
- Train Buyer
- General Job Seeker
- High Match Candidate
- Follow-up
- Custom user-created templates

### Recruiter-side automatic variables

Templates should automatically consume reliable information about the logged-in recruiter when available so users do not repeatedly type data the script can obtain itself:

- `{my_name}`
- `{my_company}`
- `{my_company_type}`
- `{my_company_stars}`
- `{my_faction}`

If the recruiter changes company or faction, template expansion should use the current reliable value rather than stale copied text.

### Candidate-side variables

Future named templates should support candidate/source context such as:

- `{name}`
- `{player_id}`
- `{looking_for}`
- `{current_company}`
- `{desired_company}`
- `{desired_role}`
- `{train_amount}`
- `{primary_stat}`
- `{match_score}`
- `{fit_score}`

### Context-aware suggestion

The UI may suggest a template based on candidate context, for example:

- `TRAIN BUYER` source -> suggest Train Buyer
- normal job seeker -> suggest Own Company Recruitment
- faction recruitment workflow -> suggest Faction Recruitment
- high Smart Match -> suggest High Match Candidate
- already Contacted/Replied -> suggest Follow-up

Suggestions are advisory only. The recruiter can select a different template before opening Torn mail. No template is auto-sent.

## Privacy boundary

Recruiter-specific template text, local company/faction recruitment wording, message history/preview text, pipeline state, notes, salary expectations, availability overrides, Match Profiles, and forum-source CRM data remain local-only. The v4.3 Global Intelligence whitelist is not expanded for these fields.

## Dependency order

Implementation order remains:

1. Finish v4.4 Smart Match + Settings + Contextual Help.
2. Build v4.5 Forum Discovery + Candidate Pipeline + default-message workflow on top of the v4.4 local candidate/settings foundation.
3. Add named context-aware message templates in a later scoped upgrade after the v4.5 foundation is proven.
4. Analytics & History follows once pipeline stages exist and are stable.
