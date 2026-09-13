# Recruitment Agency VPS Distribution

Recruitment Agency v4.8.1 continues the VPS-first distribution model introduced by v4.8.0: GitHub is the source/history and immutable runtime origin, while the stable end-user update authority is hosted by Voidsmith Industries.

## Stable production URL

`https://voidsmithindustries.com/torn/recruitment-agency/recruitment-agency.user.js`

Both `@updateURL` and `@downloadURL` point to this stable HTTPS endpoint. v4.8.0 served as the migration release for older installations that still checked GitHub `main`; v4.8.1 and later releases are promoted through the Voidsmith stable endpoint after verification.

## Release model

- Development source remains modular in GitHub.
- The GitHub migration wrapper keeps all runtime `@require` modules pinned to one immutable reviewed commit.
- VPS production distribution is built as one self-contained userscript with no remote runtime `@require` directives.
- Candidate artifacts are built and verified in the isolated Voidsmith testing workspace before promotion.
- Versioned release copies are retained so a known-good source artifact can be recovered without mutating historical releases.
- A broken public release is corrected by publishing a higher userscript version rather than lowering `@version`.

## Release gate

Do not promote a candidate merely because it builds. The applicable automated suite, browser checks, userscript syntax validation, immutable-runtime checks, and production HTTPS readback must pass before the stable endpoint is changed.
