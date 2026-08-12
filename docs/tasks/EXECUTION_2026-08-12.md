# Task-card execution evidence — 2026-08-12

本轮按依赖图分波执行：无依赖的安全、验证、体验、部署卡并行；随后执行
TASK-003/TASK-008，再执行 TASK-005/TASK-006/TASK-007，最后整合
TASK-010/TASK-012/TASK-015。代码工作已落地到当前工作区，未创建提交或 PR。

## Verification passed

- `npx.cmd tsc --noEmit`
- `npx.cmd eslint . --max-warnings=0`
- `npx.cmd vitest run` — 73 files, 578 tests passed
- `npm.cmd run build` — production build passed without network font fetch
- `npm.cmd run check:skill` — provenance manifest passed
- `npm.cmd run compare:iztro` — pinned `iztro@2.5.8`, 3 tests passed
- `npm.cmd run check:prod-env` — explicit Redis/proxy production profile passed
- `npx.cmd playwright test --list` — desktop, iPhone 13, and Pixel 5 Chromium projects, 24 tests listed (8 flows × 3 projects)
- Local system Chromium run — 4/4 desktop critical flows passed; the Windows runner
  did not exit cleanly after the pass, so this is recorded as local evidence rather
  than a CI-equivalent green exit code.
- Local Pixel 5 project-server run — 8/8 flows passed, including complete
  Bazi/Ziwei/Liuyao creation-to-reading journeys, archive/export/delete/sync
  disclosure, login entry, anonymous deletion protection, and API security
  checks. Desktop Chromium also passed 8/8. The final isolated Docker stack was
  tested with the official Playwright container: Chromium + Pixel 5 passed
  16/16, and the iPhone 13 representative viewport passed 8/8 after the suite
  was made robust to mobile keyboard and nested-navigation interactions.

## Completed cards

TASK-001/002/003 establish the server-authoritative Bazi boundary, complete
mutating-route guards, bounded parsing, same-origin checks, ownership protection,
and explicit direct/trusted-proxy rate-limit identity.

TASK-004/005/006/007 add the pinned independent Ziwei gate, visible deterministic
rule-scope boundaries, reproducible Bazi-skill provenance, and chart-evidence
envelopes for plain/LLM advice.

TASK-008 fixes all three archive push loops, records sync lifecycle state, exposes
local/cloud deletion scopes, preserves local data after cloud failure, and aligns
archive copy and controls with actual behavior.

TASK-010 adds API boundary coverage and required browser smoke/security flows;
TASK-011 adds application-level security headers and proxy parity;
TASK-012 reconciles the current register and supporting deployment/research docs;
TASK-013 restores a zero-warning lint gate; TASK-014 records controlled cold-start
measurements and a no-action recommendation.

## Closed evidence-gated cards

- **TASK-009 DONE** — the final official Playwright container run covered the
  desktop, Pixel 5, and iPhone 13 representative projects for 24/24 passing
  critical flows: three-art create/read journeys, archive/export/delete and sync
  disclosure, login entry, anonymous account-deletion protection, and API
  security checks. The iPhone 13 project uses the configured 390×844 CSS-pixel
  representative viewport; this is automated device emulation, not physical
  hardware certification.
- **TASK-015 DONE** — the current worktree was built and started on the isolated
  `hk-proxy` Docker host. Evidence includes non-root `nextjs` runtime, liveness,
  DB/Redis readiness, migration, named-volume persistence across web recreation,
  and the final 24/24 browser matrix. The first acceptance run found and fixed
  the Redis REST stub protocol and Compose port override. The local workstation
  has no Docker installation; no production deployment was touched.
