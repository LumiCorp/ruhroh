---
id: ruhroh-report-sample-routing
domain: development
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-10
depends_on:
  - ../../scripts/check-docs-samples.mjs
  - ../.vitepress/config.ts
  - ../report-gallery.md
  - ../public/samples/ruhroh-report.html
---

# Report Sample Routing

The report gallery links from VitePress pages to standalone HTML generated under
`docs/public/samples/`. These reports are static public files, not VitePress
routes. Treating them as ordinary documentation links can produce a client-side
404 even when the deployed `.html` file exists and returns HTTP 200.

## Required Link Shape

Use `withBase`, include the `.html` extension, and force native same-tab
navigation:

```vue
<script setup lang="ts">
import { withBase } from "vitepress";
</script>

<a :href="withBase('/samples/ruhroh-report.html')" target="_self">
  Open the report
</a>
```

Each part is required:

- `withBase('/samples/...')` adds the configured `/ruhroh/` deployment base;
- `.html` addresses the generated public file rather than a VitePress route;
- `target="_self"` prevents VitePress from intercepting the click and removing
  `.html` while still opening the report in the current tab.

Do not use normal Markdown link syntax for a generated report path such as
`/samples/ruhroh-report.html`.

VitePress renders the correct `href`, but its client router intercepts the click,
normalizes the URL to `/samples/ruhroh-report`, and tries to load a VitePress page
module. The result is the VitePress 404 page. Opening the `.html` URL directly can
still work, which makes source-only and HTTP-only checks insufficient.

Non-HTML assets such as `manifest.json` are not handled as VitePress pages and
may remain ordinary Markdown links.

## Known Failure Modes

Three regressions have produced similar symptoms:

| Symptom | Cause | Required fix |
| --- | --- | --- |
| URL contains `/ruhroh/ruhroh/samples/` | Source hardcodes the deployed base and VitePress adds it again. | Use `withBase('/samples/...')` or `/samples/...` in Markdown source. Never put `/ruhroh/` in a source sample link. |
| Report repeatedly refreshes | A Markdown route under `docs/samples/` emits the same path as a public report under `docs/public/samples/`. | Do not create route wrappers for generated report HTML. |
| Direct `.html` URL works, but clicking the gallery link reaches an extensionless 404 | VitePress intercepts the click and strips `.html` because `cleanUrls` is enabled. | Render an anchor with `target="_self"`. |

## Automated Guard

Run:

```bash
pnpm run docs:samples:check
```

`scripts/check-docs-samples.mjs` regenerates the public samples and rejects:

- source links that already include `/ruhroh/`;
- generated HTML links that omit `.html`;
- `.html` sample links that VitePress can intercept;
- Markdown routes that shadow generated public HTML;
- missing local links inside generated reports;
- stale or untracked generated sample files.

Do not weaken these checks to make a docs build pass. Fix the source link or the
generated sample layout instead.

## Browser Verification

Static checks prove that files and link attributes exist. A browser click proves
that VitePress does not take over navigation.

```bash
pnpm run docs:samples:check
pnpm run docs:build
pnpm run docs:preview -- --host 127.0.0.1 --port 4173
```

Then open `http://127.0.0.1:4173/ruhroh/report-gallery` and click at least one
HTML report link. Verify all of the following:

1. the destination URL still ends in `.html`;
2. the standalone report title renders;
3. the VitePress `PAGE NOT FOUND` view does not render;
4. an evidence link inside the report resolves.

Run this browser check whenever changing the VitePress `base`, `cleanUrls`,
router behavior, report-gallery links, generated sample paths, or anything under
`docs/samples/` and `docs/public/samples/`.
