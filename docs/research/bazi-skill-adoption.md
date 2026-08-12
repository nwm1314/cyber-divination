# Bazi skill provenance and adoption

This project uses the local Bazi skill as a reviewed reference source. It does
not execute an agent skill in the public request path. Chart computation stays
in the deterministic project engine.

## Identity

`npm run sync:skill` copies the approved reference files and generates
`src/lib/bazi/references/manifest.ts`. The manifest hashes the skill entry
documents and the four reference documents. `npm run check:skill` fails when a
source reference, copied reference, or generated manifest is stale. Charts
record the resulting `referenceHash` under `meta.provenance`.

The runtime metadata exposes only a stable skill identifier, license label,
hashes, and execution mode; it does not expose local filesystem paths or the
full source text.

## Adoption map

| Area | Status | Project behavior |
| --- | --- | --- |
| Heavenly stems, earthly branches, hidden stems | adopted | deterministic tables in `src/lib/bazi/wuxing.ts` and calendar modules |
| Hour branch and day-stem hour mapping | adapted | project calendar policy, including unknown-hour sensitivity output |
| Dayun direction and start age | adapted | project `dayun` implementation; versioned by `ruleSetVersion` |
| Classical-text summaries | adapted | prompt guidance and claim-level `RuleEvidence`; no fabricated page citations |
| Agent interaction flow | omitted | not executed in API or UI request paths |
| Unverified external case corpus | omitted | internal golden fixtures remain regression evidence, not independent proof |

When the skill changes, update the generated manifest with `npm run sync:skill`,
review the hash and rule-set version together, and run the Bazi fixture suite.
