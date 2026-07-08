#!/usr/bin/env bash
set -euo pipefail

workspace="${RUHROH_WORKSPACE_PATH:-${RUHROH_WORKSPACE:-}}"
if [[ -z "$workspace" ]]; then
  echo "RUHROH_WORKSPACE_PATH is required" >&2
  exit 2
fi

mkdir -p "$workspace"
cat > "$workspace/index.html" <<'HTML'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Fixture Newsletter</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 2rem; line-height: 1.5; }
      main { max-width: 760px; margin: 0 auto; }
      article { border-top: 1px solid #ccc; padding: 1rem 0; }
    </style>
  </head>
  <body>
    <main>
      <h1>Fixture Newsletter</h1>
      <article><h2>Market Notes</h2><p>A concise update for local readers.</p></article>
      <article><h2>Build Log</h2><p>Progress from the product team this week.</p></article>
      <article><h2>Community Queue</h2><p>Three useful links and upcoming events.</p></article>
    </main>
  </body>
</html>
HTML

cat > "${RUHROH_RESULT_PATH:?RUHROH_RESULT_PATH is required}" <<JSON
{
  "version": "ruhroh_run_agent_result_v1",
  "status": "goal_satisfied",
  "runId": "fixture-${RUHROH_SCENARIO_ID:-scenario}-${RUHROH_ITERATION:-1}",
  "adapterVersion": "0.1.0",
  "model": {
    "provider": "fixture",
    "model": "fixture-newsletter"
  },
  "artifacts": {
    "fixtureOutput": "$workspace/index.html"
  }
}
JSON

printf '{"status":"goal_satisfied"}\n'
