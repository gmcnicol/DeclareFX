# Groundwork evidence

Scope: [Establish pinned compiler inputs and reproducible TypeScript build](https://github.com/gmcnicol/DeclareFX/issues/11).
This checkpoint proves the selected inputs/build, not the DeclareFX target
compiler, CLI or generated effect. The [implementation spec](implementation-spec.md)
tracks subsequent gates. No research branch was merged.

## Environment and actual commands

Local process: Ubuntu 26.04.1 LTS, Linux `7.0.0-43-generic`, x86_64;
`node --version` = `v24.16.0`; `pnpm --version` = `12.23.0`;
`pnpm exec tsc --version` = `Version 5.9.3`.

| Command / check | Observed result |
| --- | --- |
| `git -C /tmp/declarefx-upstream-issue4 rev-parse HEAD` and `remote -v` | Required `cc62d9dfa0b39f84e20480ff28bed8107d986331`, origin `https://github.com/davidtemkin/declarelang.git` |
| `git -C /tmp/declarefx-upstream-issue4 diff --exit-code HEAD -- bundles/declare-compiler.js LICENSE package-lock.json tools/internal/build-compiler.mjs` | Exit 0; tracked inputs unchanged (unrelated untracked research probe not used) |
| `sha256sum vendor/declare/declare-compiler.js` | `f5694d953e8e2df6abf51c113f465904b3fe5797665a4e66206dc16bf533ba3b`, 5,175,114 bytes |
| `pnpm install` | Initial lockfile generated with the pinned pnpm; three application/development packages installed |
| `pnpm install --frozen-lockfile` | Exit 0, no resolution/lockfile update; also passed in two copies with empty `node_modules`/`dist` |
| `pnpm config get engineStrict` | `true` from committed `pnpm-workspace.yaml` |
| `pnpm build` | Exit 0; clean `dist/`, emit strict TypeScript as Node ESM |
| `pnpm check` | Exit 0; `tsc --noEmit` |
| `pnpm test` | Exit 0; four compiled Node test/assert tests pass |
| `pnpm verify:vendor` | Exit 0; two artifact/provenance/notices tests pass |
| Authored-file staged whitespace check | Exit 0 with exact-byte vendor bundle/notices excluded; the unfiltered check reports retained upstream CRLF/whitespace (exit 2), not authored-file defects |

The full checks ran in two isolated temporary directories under
`/tmp/declarefx-implementation/ticket-11-clean-{a,b}.*`, copied without `.git`,
`node_modules` or `dist`. The first install downloaded the three locked packages
into an empty `/tmp` pnpm store; the second reused that store. Both frozen installs
preserved the lockfile bytes. No compiler download/build from upstream occurred.

A Python assert-based comparison of all `dist/` file names and SHA-256 hashes
found equal bytes in both copies and the original worktree after another clean
build:

| Emitted file | SHA-256 |
| --- | --- |
| `test/upstream.test.js` | `c479bc8ff01e99a8adc7dc5c83170abeb96fa4c90baf06aaf0cb3f6a9acbd47b` |
| `test/vendor.test.js` | `ab2282059ea74db1b655c9768f81dc20eea893e90534f4c80b717ff43da92184` |

Authored whitespace check command:

```sh
git diff --cached --check -- . ':!vendor/declare/declare-compiler.js' ':!vendor/declare/LICENSE.*' ':!vendor/declare/ThirdPartyNoticeText.typescript.txt'
```

Negative frozen-install check: in the second disposable copy only, change the
TypeScript package requirement to `5.9.2` without changing the lockfile, then run
`pnpm install --frozen-lockfile`. Observed exit 1 (outdated lockfile) and identical
lockfile SHA-256 before/after. The real checkout's requirement remains `5.9.3`.

## Red / green sequence

At the approved artifact/build seams, before adding the corresponding deliverable:

1. Added the exact-artifact Node test. `node --test test/vendor.test.ts` failed
   (exit 1, one failed test, ENOENT `vendor/declare/declare-compiler.js`). Copied
   only the verified pinned bundle. The same command passed (exit 0, one test).
2. Added provenance/notice checks. The same command failed (exit 1, one pass/one
   failure, ENOENT `vendor/declare/provenance.json`). Added provenance and exact
   upstream notice sidecars. The command passed (exit 0, two tests).
3. Ran the public `pnpm build` command before build metadata existed: exit 1,
   `Command "build" not found`. Added the pinned package/config/lockfile and ESM
   `tsc` pipeline. `pnpm build`, `pnpm check`, `pnpm test` and
   `pnpm verify:vendor` passed. Subsequent normal tests run **compiled JS**, not
   Node's TypeScript stripping used to bootstrap the initial artifact red runs.

Two additional pinned-upstream characterization tests passed immediately:
`compile().program` is present/non-enumerable, the canonical literal-label
example has the expected named children without library inputs and repeat
checked trees match; a string numeric default fails at original line 1, column
49. These are regression characterization of already-vendored behavior, not
claimed red/green target implementation or source/bundle parity evidence.

Detailed command logs and comparison hashes were retained for the coordinator in
`/tmp/declarefx-implementation/ticket-11-*.log` and
`ticket-11-build-hashes.json`. Those machine-local logs are not required to run
the committed tests.

## Explicit limitations

- No clean upstream source rebuild or source/bundle parity test; neither is an
  acceptance prerequisite for the selected committed-artifact route.
- No DeclareFX subset validator, lowerer, EEL2 emitter, production CLI, publication
  checks or JSFX golden yet. Those belong to subsequent execution tickets.
- No macOS/Windows CI or end-to-end golden comparison. Same-platform TypeScript
  byte equality is not three-OS or generated-effect determinism evidence.
- No REAPER launch, EEL2 execution, audio rendering, manual UI/automation/reload
  check, HiDPI validation or performance measurement. Host gates remain unrun.
- The shipped-material notice review is recorded in
  [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md); it is not an exhaustive
  historical legal/provenance audit.
