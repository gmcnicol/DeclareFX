# DeclareFX

Declare-authored interfaces for standalone JSFX, preserving hand-written EEL2 DSP.

**Current status:** pinned compiler inputs and TypeScript build groundwork only.
The DeclareFX target compiler and CLI are not implemented yet; no REAPER/audio
validation is claimed.

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
an incompatible lockfile. The present tests verify artifact/notices and the
pinned checked-frontend seam, not target semantics or EEL2 execution.

- [Implementation spec and ordered route](docs/implementation-spec.md)
- [Actual groundwork checks and limitations](docs/groundwork-evidence.md)
- [Third-party inventory and retained notices](THIRD_PARTY_NOTICES.md)
- [Domain terminology](GLOSSARY.md)
