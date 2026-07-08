## Change type

- [ ] Scenario or suite pack
- [ ] Evaluator or calibration update
- [ ] Adapter or runtime integration
- [ ] Reporting, claim, or registry workflow
- [ ] Documentation only

## Benchmark evidence

- [ ] `pnpm exec ruhroh first-run --json` or `pnpm exec ruhroh workflow --json`
- [ ] `pnpm exec ruhroh validate --scenario-dir scenarios --suite-dir suites --json`
- [ ] `pnpm exec ruhroh inspect-pack --scenario-dir scenarios --suite-dir suites --require-calibrated --require-risk-reviewed --json`
- [ ] `pnpm exec ruhroh calibrate-evaluator --scenario-dir scenarios --scenario <id> --json`
- [ ] `pnpm exec ruhroh validate-artifacts <results> --json`
- [ ] `pnpm exec ruhroh eval-quality <results> --json`
- [ ] `pnpm exec ruhroh review <results> --json`
- [ ] `pnpm exec ruhroh publish-check <results> --suite-dir suites --suite <id> --run-plan <plan> --verify-sources --json`
- [ ] `pnpm exec ruhroh validate-bundle ruhroh-publication --json`
- [ ] `pnpm exec ruhroh claim-index ruhroh-publication --require-publishable --json`

## Review notes

- Scenario versions and suite locks changed intentionally:
- Calibration cases added or updated:
- Contamination or reward-hacking review notes:
- Adapter metadata, model identity, and transcript evidence:
- Eval-quality or human-review findings:
- Preserved artifacts or publication bundle path:
