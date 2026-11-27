# DeclareFX

Declare-authored interfaces for standalone JSFX, preserving hand-written EEL2 DSP.

**Current status:** checked subset-v1 compilation, standalone JSFX emission,
explicit CLI, safe regeneration and the complete gain example/golden are
implemented. The initial three-platform [CI checkpoint](docs/proof-evidence.md)
**passed at `8b89ec6`**; independent Standards/Spec review found one static
fractional-proof defect, now fixed with public regressions. **A new exact-SHA
matrix run for this fix is pending merge/revalidation.** No EEL2 execution or
REAPER/audio validation is claimed; [host handoff #15](https://github.com/gmcnicol/DeclareFX/issues/15)
remains entirely UNRUN. The [explicit numeric amendment](https://github.com/gmcnicol/DeclareFX/issues/6#issuecomment-7219873850)
resolves the [numeric policy blocker](docs/numeric-blocker.md): UI arithmetic uses
native EEL2 underflow, not promised JavaScript parity. Generated executable numbers
use plain decimal notation; scientific numeric tokens in author DSP are diagnosed,
not rewritten.

## Development

Use Node **24.16.0**, pnpm **12.23.0**, and the locked TypeScript **5.9.3**:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm check
pnpm test
pnpm verify:vendor
pnpm evidence
```

`build` cleans `dist/` and compiles TypeScript to Node ESM. `test` builds and runs
compiled tests using Node's built-in test/assert. No upstream checkout, compiler
download or bundler is needed during builds. Do not use npm or silently update
an incompatible lockfile. Tests verify artifact/notices, the pinned checked
frontend, and the public target compiler's validation and static lowering—not
EEL2 execution. `pnpm evidence` preserves actual tools/hashes, two clean relocated
frozen installs/builds and golden bytes under ignored `proof-evidence/`; it does
not run EEL2 or install/launch REAPER. CI also compares all three OS artifacts.

## Build the gain example

```sh
pnpm declarefx build examples/gain.declare --bindings examples/gain.bindings.json --dsp examples/gain.dsp.eel --out gain.jsfx
```

Inputs are author-owned; generated output is disposable. Existing unmarked
outputs and input/output aliases are refused. No installation or host launch is
automatic. [Complete output/golden](examples/gain.jsfx).

- [Standalone compiler, CLI, DSP and publication contracts](docs/emission.md)
- [Compiler interface and target representation](docs/compiler.md)
- [Implementation spec and ordered route](docs/implementation-spec.md)
- [Current proof evidence, CI status and remaining gates](docs/proof-evidence.md)
- [Real-host protocol — all checks pending](docs/host-validation.md)
- [Historical groundwork checks and limitations](docs/groundwork-evidence.md)
- [Third-party inventory and retained notices](THIRD_PARTY_NOTICES.md)
- [Domain terminology](GLOSSARY.md)
