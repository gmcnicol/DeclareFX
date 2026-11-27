# DeclareFX

Declare-authored interfaces for standalone JSFX, preserving hand-written EEL2 DSP.

**Current status:** pinned inputs, TypeScript build, and checked subset-v1
validation/lowering are implemented. JSFX emission and the CLI are not implemented
yet; no EEL2 execution or REAPER/audio validation is claimed.

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

- [Compiler interface and target representation](docs/compiler.md)
- [Implementation spec and ordered route](docs/implementation-spec.md)
- [Actual groundwork checks and limitations](docs/groundwork-evidence.md)
- [Third-party inventory and retained notices](THIRD_PARTY_NOTICES.md)
- [Domain terminology](GLOSSARY.md)
