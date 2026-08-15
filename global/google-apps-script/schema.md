# Google Sheets Global Intelligence Schema

## Players

One latest row per Torn player.

```text
playerId | name | observedAt | level | ee | activity30 | xanax30 | refills30 | attacks30 | rwHits30 | networth | fit | fitType | lastActive | scoutStatus | sourceVersion | firstSeen | observationCount
```

`playerId` is the logical unique key. `firstSeen` is preserved across updates. `observationCount` increases only when a non-deduped observation is accepted.

## Observations

Append-only accepted history.

```text
playerId | name | observedAt | level | ee | activity30 | xanax30 | refills30 | attacks30 | rwHits30 | networth | fit | fitType | lastActive | scoutStatus | sourceVersion
```

The service writes values with `Range.setValues()`. It never calls `setFormula()`. String fields beginning with `=`, `+`, `-`, or `@` are prefixed with an apostrophe before storage.

## Meta

```text
key | value
schemaVersion | 1
serviceVersion | 4.3.0
dedupeWindowMinutes | 30
```

## API contract

The public Apps Script endpoint accepts only the fixed `observe`, `player`, and `meta` actions. Client input cannot choose a spreadsheet, tab, range, formula, or column index.

The globally shareable observation whitelist is exactly:

```text
playerId
name
observedAt
level
ee
activity30
xanax30
refills30
attacks30
rwHits30
networth
fit
fitType
lastActive
scoutStatus
sourceVersion
```

Recruiter-private data is not part of the schema and must never be submitted by the userscript.
