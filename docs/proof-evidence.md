# Compiler proof evidence and handoff

**Initial Linux/macOS/Windows compiler CI: all passed at
`8b89ec6439eb1c2d01377a39056265e1e2079008`. Post-review run at `e680212`
FAILED Windows publication and dependent comparison. Publication fix revalidated
at `ba5f8ea585e26b4cd822fae18a18c12e65ae391a`: actual run **46020685164**
passed all three OS jobs and comparison. Real-host validation: all UNRUN.**
The initial checkpoint is historical, not coverage of either later fix. No
source/header/golden/model check executes EEL2 or proves REAPER behavior.

## Actual initial automated checkpoint

[Compiler proof run 46014620091](https://github.com/gmcnicol/DeclareFX/actions/runs/46014620091),
[attempt 1](https://github.com/gmcnicol/DeclareFX/actions/runs/46014620091/attempts/1),
**push** to `implement/declarefx-proof`, completed **SUCCESS**.
Created `2026-11-27T14:17:42Z`, updated `2026-11-27T14:19:36Z`.
Exact [tested commit](https://github.com/gmcnicol/DeclareFX/commit/8b89ec6439eb1c2d01377a39056265e1e2079008).
[Compact durable API/report/manifests/hash snapshot](evidence/46014620091/README.md)
preserves actual facts independently of machine-local handoff paths and artifact
expiry. The live API and downloaded ZIP/file digests were independently verified
again during the final fix pass; this is not inferred from workflow configuration.

| Actual job | OS / architecture | Runner image / version | Result |
| --- | --- | --- | --- |
| [Proof (linux), 140558451014](https://github.com/gmcnicol/DeclareFX/actions/runs/46014620091/job/140558451014) | Ubuntu 26.04.1 LTS, Linux x64; kernel `7.0.0-1020-azure` | `ubuntu-26.04` / `20261122.9.1`; ImageOS `ubuntu26` | SUCCESS |
| [Proof (darwin), 140558451485](https://github.com/gmcnicol/DeclareFX/actions/runs/46014620091/job/140558451485) | macOS 26.7.2, build 25G332, arm64; Darwin `25.6.0` | `macos-26-arm64` / `20261123.0526.1`; ImageOS `macos26` | SUCCESS |
| [Proof (win32), 140558451424](https://github.com/gmcnicol/DeclareFX/actions/runs/46014620091/job/140558451424) | Windows Server 2025 Datacenter `10.0.26100`, x64 | `windows-2025-vs2026` / `20261123.321.1`; ImageOS `win25-vs2026` | SUCCESS |
| [Cross-platform byte identity, 140559319985](https://github.com/gmcnicol/DeclareFX/actions/runs/46014620091/job/140559319985) | Ubuntu 26.04.1 LTS, x64 | `ubuntu-26.04` / `20261122.9.1` | SUCCESS |

All jobs recorded Actions runner **2.338.2**. All three proof reports recorded
**Node v24.16.0 / pnpm 12.23.0 / TypeScript 5.9.3**, the exact tested SHA, empty
worktree status and the actual run URL. Full OS/kernel strings and architectures
are retained in the platform summary. The comparison job used Node v24.16.0;
it did not run a separate pnpm/TypeScript gate.

| Actual gate at initial SHA | Linux | macOS | Windows |
| --- | --- | --- | --- |
| Frozen install; clean ESM build; type check | PASS | PASS | PASS |
| Complete compiled public compiler/CLI tests, golden, static/model checks | PASS **42/42** | PASS **42/42** | PASS **42/42** |
| Exact vendor artifact/provenance/four notice sidecars | PASS **2/2** | PASS **2/2** | PASS **2/2** |
| Two fresh relocated frozen installs/builds/CLI invocations | PASS **6/6 command exits 0** | PASS **6/6 command exits 0** | PASS **6/6 command exits 0** |
| No tracked input changes; artifact upload | PASS | PASS | PASS |
| Full input/dist/golden equality across all platforms | PASS, successful dependent comparison and downloaded-byte verification | Same comparison | Same comparison |

All test/vendor logs report zero failures, cancellations, skips and todo. Every
required job step succeeded; missing/failed/skipped gates were not counted as
passes. Local merger gates also passed at this exact SHA with the reference tools.
The [groundwork checkpoint](groundwork-evidence.md) remains historical, not this
42-test suite or the subsequent fix suite.

### Verified bytes and artifacts

| Material at initial SHA | Actual value |
| --- | --- |
| Complete golden and each of six hosted generated outputs | 22,103 bytes; SHA-256 `89a537274f8932bd0eeda87838639054aeee254f721c9dc007fd72088b5a804d` |
| Pinned compiler bundle | 5,175,114 bytes; SHA-256 `f5694d953e8e2df6abf51c113f465904b3fe5797665a4e66206dc16bf533ba3b` |
| Frozen lockfile | SHA-256 `b0f5a75c48bab1e66abb9797a068ff786c6c72fa297b395d65010e32989df41d` |
| Identical input manifests, 31 files each | Manifest SHA-256 `beb5beb805857b1d7d89f8e6b1feeaa524fac588ed4981f203210afec975b7db` |
| Identical dist manifests, 15 files each, both locations/all OSes | Manifest SHA-256 `b364da2eccedd2d039ed0678ff603569e378df31b3967e085deb149f2be7fe4b` |
| Downloaded complete Actions log ZIP | SHA-256 `ae97762e41b7fa38a066298cc81a389389c5cf8c6d5de4fef93613fceafa6de3` |

Input/dist counts describe the evidence command's explicit inventory, not every
repository file. Workflow/scripts are identified by the immutable tested commit.
The final fix changes compiler/dist/test inputs; these initial manifest hashes
must not be presented as the final fixed compiler's hashes. Golden/vendor/lock
bytes remain unchanged by the fix.

Each service SHA-256 below equals the independently hashed raw downloaded ZIP:

| Actual artifact | ZIP bytes | Service = downloaded SHA-256 |
| --- | ---: | --- |
| [proof-linux, 15204678216](https://github.com/gmcnicol/DeclareFX/actions/runs/46014620091/artifacts/15204678216) | 17125 | `b20e7ceb16c113ee16a16c47b22e67b2d130dfa2d9140f31464c73ce5d71b8a7` |
| [proof-darwin, 15205317682](https://github.com/gmcnicol/DeclareFX/actions/runs/46014620091/artifacts/15205317682) | 16928 | `a44f39d4e76b143db76bea0f39a1615b6937a644d09158c7de4a9077d01c3826` |
| [proof-win32, 15204527975](https://github.com/gmcnicol/DeclareFX/actions/runs/46014620091/artifacts/15204527975) | 17100 | `2f58a385ba71aecb5ef4d92be8c3337c1254f4deb76f43a418bfd9e3aa3bbe24` |
| [matrix-comparison, 15206101296](https://github.com/gmcnicol/DeclareFX/actions/runs/46014620091/artifacts/15206101296) | 330 | `f0170e94cdf329d934afc403d866fd97a1f99f72efc0690fc6cd4bbdf718df9b` |

**Retention:** these artifacts expire **2027-02-25T14:17:42Z** (90 days).
Run/job/commit identifiers do not make artifact/log bytes permanent. The committed
compact snapshot preserves original API responses, complete reports, manifests,
comparison output and integrity inventories, not full ZIPs/logs/vendor/golden
duplicates. Full raw copies currently reside under
`/tmp/declarefx-implementation/ticket-14-merge-evidence/`. Its full collection also
has a byte-verified machine-local archive at
`/home/gareth/.local/share/declarefx/proof-evidence/run-46014620091.tar.gz`
with sibling `SHA256SUMS`. Neither path promises permanent public storage.
No new service was provisioned. Hashes cannot reconstruct omitted logs.

## Failed post-review checkpoint and publication follow-up

[Run 46018203053, attempt 1](https://github.com/gmcnicol/DeclareFX/actions/runs/46018203053),
push at exact **`e68021234745ca835ff4d9d130b9ba2539e4f637`**, completed
**FAILURE** on 2026-11-27. This run includes the Spec fix in `e287167`;
its newly exposed publication failure is independent of that numeric finding.

| Actual job | Result |
| --- | --- |
| [Linux, 140570695569](https://github.com/gmcnicol/DeclareFX/actions/runs/46018203053/job/140570695569) | SUCCESS; 44/44 tests, 2/2 vendor, six reproducibility command exits 0 |
| [macOS, 140570695041](https://github.com/gmcnicol/DeclareFX/actions/runs/46018203053/job/140570695041) | SUCCESS; 44/44 tests, 2/2 vendor, six reproducibility command exits 0 |
| [Windows, 140570695516](https://github.com/gmcnicol/DeclareFX/actions/runs/46018203053/job/140570695516) | **FAILURE; 43/44 tests**; standalone vendor/reproducibility/tracked-change gates SKIPPED, not passed |
| [Comparison, 140571719855](https://github.com/gmcnicol/DeclareFX/actions/runs/46018203053/job/140571719855) | **FAILURE**; Windows `reproducibility/result.json` missing, correctly not counted as success |

The existing public CLI concurrent-reader test failed with `io/DFX_IO EPERM`
on rename of `.gain.jsfx.<uuid>.tmp` to `gain.jsfx`. The one-shot publication path
had no recovery for transient native rename denials. Windows access/sharing errors
can be transient or permanent; the log alone does not identify the particular
reader/scanner/handle responsible. The initial successful run remains valid
historical evidence, not a reason to hide this failed run or rerun until green.

The follow-up retains atomic rename and the real-reader test, adding only
[bounded, narrowly classified retries](emission.md#determinism-and-publication).
Public CLI subprocess filesystem-boundary fault injection checks transient
recovery, persistent denial, unrelated I/O failure and destination revalidation.
These Linux-runnable regressions do **not** reproduce native Windows sharing.
The fresh merger ran the new matrix successfully as recorded below; this does
not erase the earlier failed run. [Ticket 13 was reopened](https://github.com/gmcnicol/DeclareFX/issues/13#issuecomment-7221187181);
tracker resolution remains coordinator-owned, not performed by this merger.

Original failed-run APIs, runner/gate logs and four hash-verified artifact ZIPs
remain under `/tmp/declarefx-implementation/final-review-merge-evidence/46018203053/`.
[Compact original failed-run records](evidence/46018203053/README.md) preserve
the actual APIs, verification summary and failure/comparison logs. Full collection
also has a byte-verified machine-local archive at
`/home/gareth/.local/share/declarefx/proof-evidence/run-46018203053.tar.gz`
with sibling `SHA256SUMS`. Artifacts expire **2027-02-25T14:41:38Z**.
Machine-local archival is not permanent public storage; compact facts cannot
reconstruct omitted raw bytes.

## Successful publication-fix checkpoint

[Run 46020685164, attempt 1](https://github.com/gmcnicol/DeclareFX/actions/runs/46020685164),
**push** at exact merge **`ba5f8ea585e26b4cd822fae18a18c12e65ae391a`**,
completed **SUCCESS**. Created `2026-11-27T14:58:26Z`, updated
`2026-11-27T15:00:34Z`. This covers the fractional-proof review fix and the new
bounded Windows publication fix, not a rerun of the failed revision.
[Compact genuine collected records](evidence/46020685164/README.md) retain original
APIs, complete platform reports, setup logs, manifests and verification data.

| Actual job | OS / arch | Actual image / version | Result |
| --- | --- | --- | --- |
| [Linux, 140579246507](https://github.com/gmcnicol/DeclareFX/actions/runs/46020685164/job/140579246507) | Ubuntu 26.04.1 LTS, x64; Linux `7.0.0-1020-azure` | `ubuntu-26.04` / `20261116.202.1` | SUCCESS |
| [macOS, 140579246592](https://github.com/gmcnicol/DeclareFX/actions/runs/46020685164/job/140579246592) | macOS 26.7.2 build 25G332, arm64; Darwin `25.6.0` | `macos-26-arm64` / `20261123.0526.1` | SUCCESS |
| [Windows, 140579246027](https://github.com/gmcnicol/DeclareFX/actions/runs/46020685164/job/140579246027) | Windows Server 2025 Datacenter `10.0.26100`, x64 | `windows-2025-vs2026` / `20261123.321.1` | SUCCESS |
| [Comparison, 140580211640](https://github.com/gmcnicol/DeclareFX/actions/runs/46020685164/job/140580211640) | Ubuntu 26.04.1 LTS, x64 | `ubuntu-26.04` / `20261116.202.1` | SUCCESS |

All jobs used Actions runner **2.338.2**. All three proof reports record exact SHA,
empty worktree status, actual run URL, **Node v24.16.0 / pnpm 12.23.0 /
TypeScript 5.9.3**. Each OS passed frozen install/build/check, **47/47 tests**
(including unchanged real concurrent-reader publication and new fault injection),
**2/2 standalone vendor checks**, **six relocated command exits 0**, tracked-input
check and upload. No required step failed/skipped/cancelled; test/vendor counts
have zero failures/cancellations/skips/todo. Comparison used Node v24.16.0, not a
separate pnpm/TypeScript gate. Complete input/dist/golden equality was independently
verified from downloads against local/main dist and local relocated outputs.

| Fixed implementation material | Verified identity |
| --- | --- |
| Input manifest, 31 files | `cad0a38276a4a8ad1d37fb4323a1e8777d3936ccd16db796828c7f46e3e49d9e` |
| Dist manifest, 15 files, both locations/all OSes | `94df2c8f2b86cd74b7165b6259f1ac2e68ab6a9beed98daf5e64b8657f08658e` |
| Complete unchanged golden, all six hosted outputs and local outputs | 22,103 bytes; `89a537274f8932bd0eeda87838639054aeee254f721c9dc007fd72088b5a804d` |
| Vendor / frozen lock | Unchanged identities in initial table above |
| Complete Actions log ZIP | `db5d7940d07253b59951c9421045e0532ad604a1cf67c3121cd55cd4a41b7db3` |

All four raw downloaded ZIPs match service SHA-256 and exact size; every expanded
original entry was byte-verified. Integrity does not substitute for the separately
verified successful jobs, reports and logs.

| Actual artifact | ZIP bytes | Service = independently downloaded SHA-256 |
| --- | ---: | --- |
| [proof-linux, 15207114716](https://github.com/gmcnicol/DeclareFX/actions/runs/46020685164/artifacts/15207114716) | 17326 | `f0f1228d8a255c0a97416358b53754231e00247198a772dfb3aa5934dc2cea5b` |
| [proof-darwin, 15207908307](https://github.com/gmcnicol/DeclareFX/actions/runs/46020685164/artifacts/15207908307) | 17118 | `1e8668f47574bbe3de5cd0e8deb1ef3c6d0dbee93d288a354b2867e95f74c719` |
| [proof-win32, 15206974370](https://github.com/gmcnicol/DeclareFX/actions/runs/46020685164/artifacts/15206974370) | 17282 | `917aec6776b575d84b782d21e55640801c165abb8beb679868d11db2be565701` |
| [matrix-comparison, 15207913108](https://github.com/gmcnicol/DeclareFX/actions/runs/46020685164/artifacts/15207913108) | 330 | `146c910b8365ba4d60a399afc05e62277a965215542a95c8110a866d11bc2e59` |

Artifacts expire **2027-02-25T14:58:27Z**. Full API/ZIP/expanded/log records and
checksums are outside the repo at
`/tmp/declarefx-implementation/windows-publication-merge-evidence/46020685164/`.
Compact committed facts survive GitHub expiry, not omitted full raw bytes. No
permanent-public-evidence or host behavior claim follows. Bounded retries can
still fail on persistent locks/permissions; no unsafe unlink/truncate fallback.

## Completed independent review dispositions

Independent Standards and Spec reviewers inspected all authorship changes since
fixed base `78c24d5` in parallel. Standards: **0 hard findings**, two optional
readability/duplication suggestions addressed without changing generated bytes.
Spec: **one P2**, ordinary fractional constants evading static diagnostics
([reopened ticket 12](https://github.com/gmcnicol/DeclareFX/issues/12#issuecomment-7220749685)).
The shared proof now rejects ordinary negative sizes, zero divisors and overflow,
with public red/green regressions, while uncertain tiny proofs stay deferred.
See [analysis limits](compiler.md); no host cutoff/parity claim is introduced.

**Review fixes and new publication defect are merged and revalidated** in actual
run **46020685164** at **`ba5f8ea585e26b4cd822fae18a18c12e65ae391a`**.
Both optional Standards suggestions were addressed: graphics helpers now use
`slotValue`/`slotValidity`/`slotDirty`; shared `finiteGain` preserves separate
audio/UI scratch and the independent model oracle. The Spec P2 public fractional,
lazy and tiny/zero-quotient regressions pass. The complete golden is unchanged.

This factual evidence-only update cites the already-tested implementation SHA.
Its separate final documentation-SHA matrix result is reported externally in
`/tmp/declarefx-implementation/windows-publication-merge.md` and the coordinator
handoff, avoiding endless circular self-reference. No source/workflow/test change
is part of this evidence update. Only coordinator links/resolves tracker work.

The concrete [host handoff issue 15](https://github.com/gmcnicol/DeclareFX/issues/15)
exists outside the parent map with native dependency on ticket 14. All exact
REAPER/EEL2/audio/numerical/UI/automation/interruption/HiDPI/reload/runtime and
performance gates remain **UNRUN** under the parent exception. The separate
[complete host protocol](host-validation.md) is not replaced by compiler CI.
Only coordinator resolves tracker work; this fix does not close any ticket.

## Reproducibility and artifact protocol

[Compiler proof workflow](../.github/workflows/proof.yml) runs on every integration
push plus manual dispatch. Three independent `ubuntu-latest`, `macos-latest`,
`windows-latest` jobs disable fail-fast; exact runtime images/versions, not label
names, are evidence. Actions are commit-pinned/read-only, credentials not
persisted. There is no cache framework, host install/launch, publication or
external EEL2 interpreter.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm check
pnpm test
pnpm verify:vendor
pnpm evidence
```

Bash `-e -o pipefail` prevents `tee` hiding gate failures. Compiled Node tests cover
public compiler/CLI behavior, full golden/provenance, rejection, DSP ownership,
publication and independent arithmetic models, not EEL2 execution.
[`scripts/evidence.mjs`](../scripts/evidence.mjs) copies explicit build inputs to
two fresh temporary roots (one with spaces), frozen-installs, clean-builds and
runs the actual compiled CLI. It checks unchanged lock bytes, every dist hash and
complete output equality against the committed reviewed golden; temporary roots
are removed. **`docs/`, including `docs/evidence/`, is not a build input.**

The three proof artifacts contain `gates/*.log`, `reproducibility/result.json`
(actual revision/dirty state/run URL/environment/command exits), `inputs.json`,
`dist-{1,2}.json`, six command logs and `gain-{1,2}.jsfx`. Upload runs even after
failure where files exist. The comparison artifact holds actual comparator
output; the dependent job requires all three successful same-revision reports,
reference tools and complete input/dist/golden equality. To check downloaded
artifacts, retain their directory names and run at the **tested revision**:

```sh
node scripts/compare-evidence.mjs <download-directory>
```

Bootstrap failure/cancellation may leave only Actions logs or no artifacts.
Artifact existence alone is not success; comparison success cannot override a
failed proof job. Consult actual step results and retain FAIL/UNRUN/BLOCKED.

## Inventory and claim boundaries

[Inventory/notices](../THIRD_PARTY_NOTICES.md) covers the pinned bundle, four
notice sidecars and locked TypeScript/@types/node/undici-types. Clean upstream
rebuild/source-bundle parity remain unverified and are not prerequisites of the
selected artifact route. No new assets, libraries or legal-audit claim.
[README CLI commands](../README.md#build-the-gain-example) retain author inputs,
refuse aliases/unmarked outputs and safely publish disposable generated output.
Local-filesystem tests do not prove hostile concurrent mutation, power-loss
recovery or every filesystem.

The [numeric amendment](numeric-blocker.md) permits native underflow, including
tiny normals/intermediates; exact comparisons use represented values and guards
remain. No software floats, forced rounding/flushing, blanket tiny rejection or
Node/host tiny-branch parity. A passing compiler matrix is **compiler proof;
host validation pending**, not audio/UI correctness or release-ready portability.

Official documentation checked directly after Context7 quota exhaustion:
[workflow syntax/shells](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions),
[artifact upload](https://github.com/actions/upload-artifact/tree/v4),
[artifact download](https://github.com/actions/download-artifact/tree/v4),
[pnpm frozen install](https://pnpm.io/cli/install),
[Node 24 child processes](https://nodejs.org/docs/latest-v24.x/api/child_process.html).
