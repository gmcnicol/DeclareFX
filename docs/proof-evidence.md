# Compiler proof evidence and handoff

**Initial Linux/macOS/Windows compiler CI: all passed at
`8b89ec6439eb1c2d01377a39056265e1e2079008`. Post-review run at `e680212`
FAILED Windows publication and dependent comparison. Bounded publication retry
fix: new actual exact-SHA matrix pending. Real-host validation: all UNRUN.**
Do not treat the initial checkpoint as CI coverage of either later fix. No
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
`/tmp/declarefx-implementation/ticket-14-merge-evidence/`; `/tmp` is not durable
archival. Coordinator must archive full downloads before expiry if raw replay is
required. No new service was provisioned. Hashes cannot reconstruct omitted logs.

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
A fresh merger must run the actual new three-platform matrix; missing/failed
Windows evidence is never success. [Ticket 13 was reopened](https://github.com/gmcnicol/DeclareFX/issues/13#issuecomment-7221187181);
ticket 14 and parent completion remain open.

Original failed-run APIs, runner/gate logs and four hash-verified artifact ZIPs
remain under `/tmp/declarefx-implementation/final-review-merge-evidence/46018203053/`.
Artifacts expire **2027-02-25T14:41:38Z**; this local collection is not durable
archival. Run/job links and this failure summary survive, but cannot reconstruct
omitted raw bytes. Preserve full downloads before expiry if raw audit is needed.

## Review fix and precise remaining automated gate

Independent Standards and Spec reviewers inspected all authorship changes since
fixed base `78c24d5` in parallel. Standards: **0 hard findings**, two optional
readability/duplication suggestions addressed without changing generated bytes.
Spec: **one P2**, ordinary fractional constants evading static diagnostics
([reopened ticket 12](https://github.com/gmcnicol/DeclareFX/issues/12#issuecomment-7220749685)).
The shared proof now rejects ordinary negative sizes, zero divisors and overflow,
with public red/green regressions, while uncertain tiny proofs stay deferred.
See [analysis limits](compiler.md); no host cutoff/parity claim is introduced.

**The post-review revision failed hosted CI; the publication follow-up still
needs its own actual run.** The fresh merger must:

1. Merge the committed publication-fix branch into current integration, run local gates,
   push only `implement/declarefx-proof` and observe its actual new matrix.
2. Require all three proof jobs and the dependent comparison to succeed at that
   exact merge SHA. Record actual run/attempt/job URLs, tools/OS/images,
   conclusions, new input/dist manifests, artifact identities/service digests and
   independently verified downloaded hashes. Failures remain explicit.
3. Preserve compact actual results and full-download handoff, and have the
   coordinator link the final exact tested SHA/run in tracker/result evidence.
   This document names the actual initial success and post-review failure, not
   a future passing SHA or circular evidence for its own documentation commit.

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
