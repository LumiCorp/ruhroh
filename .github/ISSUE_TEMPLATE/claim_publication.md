---
name: Claim publication
about: Submit or review an artifact-backed Ruhroh benchmark claim.
title: "[claim] "
labels: claim, publication
---

## Claim summary

- Suite id and version:
- Adapter(s):
- Run count:
- Result path or bundle path:
- Intended audience:

## Publication gate

Attach or paste redacted output from:

```bash
pnpm exec ruhroh publish-check <results> \
  --suite-dir <suite-dir> \
  --suite <suite-id> \
  --run-plan <run-plan> \
  --bundle ruhroh-publication \
  --verify-sources \
  --json

pnpm exec ruhroh validate-bundle ruhroh-publication --json
pnpm exec ruhroh claim-index ruhroh-publication --require-publishable --json
```

## Evidence packet

Link or attach the publication bundle. It should include the benchmark claim,
summary, compare report, review queue, eval-quality report, manifest, README,
run plan, calibration report when present, and copied `sources/` evidence.

## Known blockers or accepted limitations

List any `publish-check` blockers, review items, excluded infrastructure
reruns, or methodology limitations that reviewers should inspect.
