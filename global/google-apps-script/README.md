# Google Apps Script Deployment

This service turns a private Google Sheet into the optional shared Global Intelligence store used by Recruitment Agency v4.3.

## One-time setup

1. Create a Google Sheet named `Torn Recruitment Agency Global Intelligence`.
2. Keep the Sheet private. Do not grant public edit access.
3. Open **Extensions -> Apps Script** from the Sheet.
4. Replace the default script with `Code.gs` from this directory.
5. Open **Project Settings -> Script properties** and add:
   - Property: `SPREADSHEET_ID`
   - Value: the private Sheet ID from its URL.
6. Run `setup()` once from the Apps Script editor. Authorize the script when Google prompts. This creates/verifies `Players`, `Observations`, and `Meta`.
7. Choose **Deploy -> New deployment -> Web app**.
8. Set **Execute as** to the Sheet owner.
9. Set access to **Anyone** so Recruitment Agency users can submit/read sanitized observations without receiving your Google credentials.
10. Copy the resulting `/exec` URL into Recruitment Agency **Advanced -> Global Intelligence -> Apps Script endpoint**.

The `/exec` URL is not a secret. The Sheet itself and the Apps Script owner's credentials remain private.

## Test the deployment

### Service metadata

Open:

```text
<EXEC_URL>?action=meta
```

Expected fields include:

```json
{"ok":true,"schemaVersion":1,"serviceVersion":"4.3.0","dedupeWindowMinutes":30,"maxHistory":100}
```

### Missing player

```text
<EXEC_URL>?action=player&id=3877028
```

Before observations exist, the response should contain `latest:null`, an empty `history`, and `observationCount:0`.

### Valid observation

```bash
curl -L -X POST '<EXEC_URL>' \
  -H 'Content-Type: application/json' \
  --data '{
    "action":"observe",
    "schema":1,
    "player":{"id":3877028,"name":"R4G3","level":52},
    "observation":{
      "playerId":3877028,
      "name":"R4G3",
      "observedAt":1786788000000,
      "level":52,
      "ee":9,
      "activity30":142,
      "xanax30":61,
      "refills30":27,
      "attacks30":216,
      "rwHits30":44,
      "networth":2100000000,
      "fit":86,
      "fitType":"official",
      "lastActive":1786787700000,
      "scoutStatus":"fresh",
      "sourceVersion":"4.3.0"
    }
  }'
```

A second materially identical observation inside 30 minutes should return `deduped:true` and must not append another history row.

### Invalid schema

Posting `"schema":999` should return:

```json
{"ok":false,"code":"INVALID_SCHEMA"}
```

### Invalid player

Posting player ID `0` should return:

```json
{"ok":false,"code":"INVALID_PLAYER"}
```

### Oversized body

A request body larger than 16 KiB should return `INVALID_BODY`.

## Privacy boundary

The service accepts only the schema documented in `schema.md`. Recruitment Agency must not send Torn API keys, recruiter notes, contact history, message content, recruiter-entered salary/role/availability, settings objects, or arbitrary browser storage.

Global Intelligence is historical/advisory data. Fresh direct Torn data and local Scout measurements remain higher priority in the userscript.
