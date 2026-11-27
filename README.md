# DeclareFX

Declare-authored interfaces for standalone JSFX, preserving hand-written EEL2 DSP.

**Current status:** checked subset-v1 compilation, standalone JSFX emission,
explicit CLI, safe regeneration and the complete gain example/golden are
implemented and tested locally. No EEL2 execution or REAPER/audio validation is
claimed; three-platform automated evidence remains pending. **Ticket 13 remains
blocked:** [finite subnormal preservation](docs/numeric-blocker.md) needs a verified
target mechanism or an explicit contract decision; full numeric conformance is
not established.

## Development

Use Node **24.16.0**, pnpm **12.23.0**, and the locked TypeScript **5.9.3**:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm check
pnpm test
pnpm verify:vendor
```

`build` cleans `dist/` and compiles TypeScript to Node ESM. `test` builds and runs
compiled tests using Node's built-in test/assert. No upstream checkout, compiler
download or bundler is needed during builds. Do not use npm or silently update
an incompatible lockfile. Tests verify artifact/notices, the pinned checked
frontend, and the public target compiler's validation and static lowering—not
EEL2 execution.

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
- [Actual groundwork checks and limitations](docs/groundwork-evidence.md)
- [Third-party inventory and retained notices](THIRD_PARTY_NOTICES.md)
- [Domain terminology](GLOSSARY.md)
