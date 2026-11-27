# DeclareFX first-slice implementation spec

Status: pinned inputs/build, checked subset-v1 lowering, standalone JSFX
emission and explicit CLI implemented. Initial three-OS compiler CI passed at
`8b89ec6439eb1c2d01377a39056265e1e2079008`. Post-review `e680212` fixed the
fractional-proof finding but failed Windows concurrent-reader publication.
The bounded rename-retry follow-up passed actual run **46020685164** at exact
merge **`ba5f8ea585e26b4cd822fae18a18c12e65ae391a`**: all three OS jobs and
byte comparison ([run evidence](proof-evidence.md)). Real-host evidence remains entirely
UNRUN. The [explicit numeric amendment](https://github.com/gmcnicol/DeclareFX/issues/6#issuecomment-7219873850)
resolves the [numeric policy blocker](numeric-blocker.md), not those evidence
gates. This is the ordered implementation handoff for the
[architecture and proof map](https://github.com/gmcnicol/DeclareFX/issues/1), not
a claim of JSFX or REAPER success.

## Canonical contracts

Decision detail remains in its resolution, not duplicated here:

- [Compiler integration boundary](https://github.com/gmcnicol/DeclareFX/issues/8#issuecomment-7174540099):
  in-process `compile().program`, pinned upstream coupling, one restricted
  TypeScript AST lowering path; no upstream fork, parser-only substitute, `eval`
  or upstream bytecode execution contract.
- [Subset v1](https://github.com/gmcnicol/DeclareFX/issues/6#issuecomment-7187429622):
  classless App/View/Text, literal labels, statically bound finite scalars,
  deterministic acyclic UI evaluation, geometry and relative drag semantics.
- [Approved numeric amendment](https://github.com/gmcnicol/DeclareFX/issues/6#issuecomment-7219873850):
  native EEL2 UI underflow, including tiny normals/intermediates; exact comparisons
  on represented values, no universal cutoff or Node/cross-host tiny-value parity.
  Preserve lazy finite/overflow/division guards, retained geometry and safe gain.
  Defer uncertain compile-time proofs; no software floats, blanket tiny rejection
  or global rounding/flushing. Emit every generated executable number as plain
  decimal, including defaults and maximum-finite guards. Diagnose scientific
  numeric tokens in executable author DSP with locations, never rewrite them or
  mistake comments/quoted text/identifiers for numeric tokens.
- [Parameter ownership and DSP composition](https://github.com/gmcnicol/DeclareFX/issues/3#issuecomment-7162839879):
  native slot 1 is authoritative; block snapshot/read-only `dfx_param_gain`,
  separate graphics/audio/author scratch, case-insensitive reserved `__dfx_`
  names, restricted DSP sections and safe disposable output.
- [CLI, packaging and validation gates](https://github.com/gmcnicol/DeclareFX/issues/2#issuecomment-7193405886):
  exact tools/artifact, strict versioned JSON, explicit command, deterministic
  provenance, safe publication, three-OS automated gates and manual host checks.
- [Pinned compiler investigation](https://github.com/gmcnicol/DeclareFX/issues/4#issuecomment-7135752403)
  and [syntax probes](https://github.com/gmcnicol/DeclareFX/issues/10#issuecomment-7174728162)
  explain the seam and diagnostic limits. Dynamic-label/handler probes are
  upstream capabilities, **not** permitted v1 source.
- [Runtime constraints](https://github.com/gmcnicol/DeclareFX/issues/7#issuecomment-7135740686)
  and [historical regression reminders](https://github.com/gmcnicol/DeclareFX/issues/9#issuecomment-7137480127)
  inform review; they do not establish runtime or performance evidence.

Use the existing [GLOSSARY.md](../GLOSSARY.md): a **Parameter** is persistent,
a **Control** edits it, a **UI gesture** is transient, and **Parameter binding**
is their explicit association, not another authoritative value. Do not change
these definitions to fit implementation storage.

## Reproducible inputs and commands

- Node **24.16.0**, pnpm **12.23.0**, TypeScript **5.9.3**. Exact package metadata,
  `.nvmrc`, `pnpm-workspace.yaml` engine enforcement and the pnpm-generated frozen
  lockfile are committed. Only these tool versions are the reference proof.
- [Vendored artifact provenance](../vendor/declare/provenance.json): upstream
  `cc62d9dfa0b39f84e20480ff28bed8107d986331`, SHA-256
  `f5694d953e8e2df6abf51c113f465904b3fe5797665a4e66206dc16bf533ba3b`.
  [Shipped inventory/notices](../THIRD_PARTY_NOTICES.md) covers the actual bundle,
  embedded TypeScript and separately installed packages. No whole upstream tree,
  compiler downloads during builds, asset library or bundler.
- `pnpm install --frozen-lockfile`; `pnpm build`; `pnpm check`; `pnpm test`;
  `pnpm verify:vendor`; `pnpm evidence` (clean relocated installs/builds, versions,
  hashes and complete golden artifacts). Build cleans only `dist/`, then runs `tsc` to Node ESM
  (ES2022/NodeNext, strict checking, LF). Tests are compiled TypeScript executed
  with Node's built-in test/assert. The [compiler interface](compiler.md) returns
  a validated static target program. The separate [effect compiler and CLI](emission.md)
  emit and safely publish standalone output.
- Source/bundle parity and a clean upstream rebuild are explicitly **not**
  prerequisites and remain unverified. Do not replace the selected artifact or
  silently regenerate a lockfile to make an incompatible toolchain work.

Current official references checked directly after Context7 quota exhaustion:
[pnpm install](https://pnpm.io/cli/install),
[pnpm settings](https://pnpm.io/settings),
[engine enforcement](https://pnpm.io/settings/cli#enginestrict),
[TypeScript configuration](https://www.typescriptlang.org/tsconfig/), and
[Node 24 test runner](https://nodejs.org/docs/latest-v24.x/api/test.html).
In pnpm 12, engine settings belong in `pnpm-workspace.yaml`, not `.npmrc`;
quoted test globs let Node expand them portably.

## Intended compiler input/output

The build command (available locally as `pnpm declarefx` after building) is:

```sh
declarefx build ui.declare --bindings gain.bindings.json --dsp gain.dsp.eel --out gain.jsfx
```

All paths resolve from invocation cwd. No discovery, interpolation, watching,
preview, installation or REAPER launch. `--help`/`--version` are the only other
entry points. Diagnostics carry category/code and honest original source
location or binding-field context on stderr; any error exits nonzero and
preserves existing output.

Representative UI (also exercised against the pinned frontend in
[`test/upstream.test.ts`](../test/upstream.test.ts)):

```declare
App [ width = 400, height = 160, gain: number = 1,
 background: View [ width = { parent.width }, height = { parent.height }, fill = #eeeeee ],
 label: Text [ x = 12, y = 12, width = 200, height = 20, text = "Gain" ],
 gainControl: View [ x = 12, y = 48, width = { parent.width / 2 }, height = 24, fill = #557799 ]
]
```

`gain.bindings.json` is exactly one strict record; source owns the default:

```json
{"version":1,"rootState":"gain","controlPath":["gainControl"],"nativeSlot":1,"min":0,"max":2}
```

Example hand-written DSP input:

```eel
@sample
spl0 *= dfx_param_gain;
spl1 *= dfx_param_gain;
```

Expected output is **one standalone UTF-8/LF `.jsfx` file** with a disposable,
compiler-owned provenance header, stable `slider1` gain identity/default/range,
parameter preparation before author `@block`, preserved author `@sample`, and
native generated `@gfx` drawing/interaction. No runtime imports, JavaScript,
browser, compiler, indexed-memory allocator or generated UI work in audio
sections. The implemented [example/golden](../examples/gain.jsfx) and
[emission interface](emission.md) provide the complete artifact.
UI/DSP/binding bytes must participate in deterministic build identity; no
absolute machine paths, timestamps or unstable traversal. Publication is atomic
only after complete validation, with resolved input/output aliases and unmarked
existing output refused.

## Module and test responsibilities

These are boundaries, not a mandate for extra wrappers or stub files. Keep
upstream imports/tree-shape knowledge private to frontend/lowering and its
compatibility tests. Expose target results/diagnostics, not upstream objects.

| Boundary | Responsibility | Public test seam |
| --- | --- | --- |
| Vendored input/build (present) | Exact artifact, provenance, notices, frozen tools, ESM compilation | `test/vendor.test.ts`; build/check/test commands |
| Upstream compatibility (present) | Non-enumerable checked tree, library-free literal example, type failure and source position | `test/upstream.test.ts`; this is external characterization, not target validation |
| Frontend/lowering (present; see [interface](compiler.md)) | Reject includes/scripts before loading/execution; mandatory checked frontend for accepted source; inspect every authored/implicit body; one restricted AST path; strict binding validation; static slot/dependency order and finite-value safety | Compiler interface valid/invalid fixtures, warnings, source diagnostics, cycles/types/bindings/text/resource limits |
| Emitter/DSP assembly (present) | Deterministic JSFX, native parameter observation, dirty geometry before hit tests and after edits, relative drag/touch completion, bounded block snapshots; optional `@init`/`@block`, required `@sample`; author lifecycle/symbol/resource checks | Compiler result, full golden bytes, DSP preservation, structural audio-section checks and independent arithmetic model (not EEL2 execution) |
| CLI/publication (present) | Read explicit inputs, stable errors/exit codes, input/output identity safeguards, compiler-owned marker, successful-build-only atomic replacement | Real subprocess tests: success/failure/help/version, aliases, unmarked output refusal, previous-output preservation, distinct checkout directories |
| Evidence/handoff (last) | Real Linux/macOS/Windows runs, deterministic golden comparison, exact tool/runner versions; actual host evidence or precise unrun checklist | CI artifacts/logs and separate REAPER numerical/manual evidence |

Do not weaken finite-number rules (including short-circuiting, safe native gain,
last-valid geometry and invalid-width cancellation), static binding, literal text
limits or DSP/publication restrictions to obtain a passing golden. A handwritten
DSP validator is not a sandbox; diagnose detectable conflicts without claiming
exhaustive protection from trusted author EEL2. Host interruption handling is an
acceptance obligation, not proven merely by emitting plausible calls.

## Ordered execution route

1. [Establish pinned compiler inputs and reproducible TypeScript build](https://github.com/gmcnicol/DeclareFX/issues/11):
   this groundwork, notices, tests and linked spec.
2. [Implement and test subset v1 validation and lowering](https://github.com/gmcnicol/DeclareFX/issues/12):
   compiler seam first, real red/green slices for accepted/rejected source and
   versioned bindings; no general plugin framework or runtime class support.
3. [Generate and test standalone gain JSFX through the CLI](https://github.com/gmcnicol/DeclareFX/issues/13):
   emitter, restricted DSP, safe publication, example inputs, complete golden,
   CLI tests and deterministic identities.
4. [Complete proof evidence and remaining-work handoff](https://github.com/gmcnicol/DeclareFX/issues/14):
   execute three-OS automated gates, update this matrix with actual artifacts,
   record host checks/unrun gates, and create only concrete exposed follow-ups.

## Evidence-status matrix

The detailed, maintained matrix and artifact collection sequence are in
[proof evidence and handoff](proof-evidence.md), not the historical
[groundwork checkpoint](groundwork-evidence.md).

| Gate | Status / evidence |
| --- | --- |
| Pinned artifact/notices; frozen install/build/check/tests/vendor | **Three-OS PASS at `ba5f8ea`**, exact reference tools; 47/47 compiled tests, 2/2 vendor checks per OS |
| Compiler/CLI, full golden, safe publication, repeated clean relocated build identity | **Three-OS PASS at `ba5f8ea`**, complete input/dist/output equality and unchanged concurrent-reader test; structural/static/model evidence, not EEL2 execution |
| Linux/macOS/Windows workflow and artifact comparison | **Actual run 46020685164 all passed** at `ba5f8ea`; initial success and intervening `e680212` Windows/comparison **FAILURE** remain in [history](proof-evidence.md) |
| Upstream clean rebuild / source-to-bundle parity | **Unrun; not required** by the selected artifact route |
| REAPER load, numerical audio, automation/gestures/interruption, UI/HiDPI/reload | **All UNRUN**; [complete protocol and per-platform status](host-validation.md). [Concrete handoff #15](https://github.com/gmcnicol/DeclareFX/issues/15), outside parent map, depends on #14 |
| Performance | **Unmeasured**; no CPU, audio, UI or latency claims |
| Final independent Standards/Spec review | **Completed independently in parallel since `78c24d5`**: 0 hard Standards findings; 2 optional improvements addressed; 1 Spec P2 fixed with public regressions. Merged and revalidated in actual run 46020685164; new Windows publication defect separately fixed/revalidated. No host claim |

The native UI-underflow policy blocker is resolved by the explicit amendment;
actual host validation is not. Preserve the numeric guards and plain-decimal
emission, not an obsolete gradual-underflow requirement. Target REAPER 7.02+
is a floor, not a validated range. No automatic host provision/launch, invented
CI evidence or claim that source/header/golden checks execute EEL2. Once actual
automated gates pass, the allowed final claim remains **compiler proof; host
validation pending** unless the separate real-host protocol has been executed.
No release-ready cross-platform claim follows from the compiler matrix.
