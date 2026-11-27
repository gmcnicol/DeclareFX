# Third-party inventory

DeclareFX's own code is [MIT-licensed](LICENSE). This does not replace the
notices below. Ship `vendor/declare/` and this inventory together with the
compiler. No package has been published.

## Redistributed compiler artifact

| Material | Identity / licence | Retained notices |
| --- | --- | --- |
| Declare compiler and included Declare compiler-side/runtime helper code | David Temkin, 2026; upstream `cc62d9dfa0b39f84e20480ff28bed8107d986331`; MIT | [Upstream MIT](vendor/declare/LICENSE.declare) |
| Embedded TypeScript compiler and 57 standard-library declaration texts (ES2022 reference closure, including decorators) | Microsoft; TypeScript 5.9.3; Apache-2.0 and its third-party notices | [Apache-2.0](vendor/declare/LICENSE.typescript.txt), [full TypeScript third-party notices](vendor/declare/ThirdPartyNoticeText.typescript.txt) |
| esbuild-generated bundle helper glue | Upstream build tool locked to esbuild 0.28.1; MIT | [esbuild MIT](vendor/declare/LICENSE.esbuild), retained conservatively for generated glue; the esbuild package/binary is not shipped |

The compiler is the **unmodified committed bundle**, not a rebuilt or pruned
subset. Its exact origin, byte count, SHA-256 and each notice's source/checksum
are in [provenance.json](vendor/declare/provenance.json). Run
`pnpm verify:vendor` to check the artifact and sidecars. `.gitattributes` disables
text conversion on these files so checkout cannot change their verified bytes.

Audit basis:

- The pinned [bundle build script](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/tools/internal/build-compiler.mjs)
  bundles the browser compiler graph and TypeScript, embeds the `lib.es2022.d.ts`
  reference closure, and strips legal comments (`legalComments: "none"`). Thus
  the bundle alone is not an adequate notice inventory.
- The pinned [package lock](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/package-lock.json)
  records TypeScript 5.9.3 and esbuild 0.28.1. Inspection of the actual bundle
  independently found the TypeScript `5.9.3` version literal and 57 embedded
  `lib.*.d.ts` entries with Microsoft copyright/Apache headers. The copied
  TypeScript notices also match the installed 5.9.3 package byte-for-byte.
- The pinned checkout's repository URL, HEAD and unchanged tracked bundle/licence
  were verified before copying. Notice sources were fetched from their exact
  upstream version tags, not inferred from Declare's root MIT licence.
- No fonts, demos, GPU/browser runtime bundles, component library files,
  templates, images or upstream build tools were separately copied. Compiler-side
  helpers already inside the required bundle remain covered by the inventory.
  The EEL2 emitter and gain DSP are authored in this repository; the generated
  gain example contains no copied upstream compiler/runtime, font or third-party
  EEL2 template. Generated output does not need the compiler bundle at runtime.

This is a shipped-material review, not a clean upstream rebuild, source/bundle
parity proof or exhaustive historical legal audit. The compiler closure module's
historical OL5 provenance remains the explicit limitation recorded in the
[compiler integration decision](https://github.com/gmcnicol/DeclareFX/issues/8#issuecomment-7174540099),
not an established licence conflict. New copied material or a pin upgrade needs
another notice review; generated effects need notices for material actually
copied into them, not automatically this entire compiler inventory.

## Installed dependencies (not vendored)

The frozen [pnpm lockfile](pnpm-lock.yaml) records integrity and exact versions.

| Package | Use | Licence / retained by installed package |
| --- | --- | --- |
| `typescript@5.9.3` | `tsc` build/check; AST parser for the restricted lowerer | Apache-2.0; `typescript/LICENSE.txt` and `typescript/ThirdPartyNoticeText.txt` (also retained above) |
| `@types/node@24.10.1` | Development-only Node API declarations | MIT; DefinitelyTyped contributors/attribution in the package's README and declaration files; [source](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/node) |
| `undici-types@7.16.0` | Transitive development-only dependency of `@types/node` | MIT; installed package `LICENSE`; [source](https://github.com/nodejs/undici/tree/v7.16.0/types) |

No other application dependencies are installed. Node 24.16.0 and pnpm 12.23.0
are external development tools, not redistributed application code. pnpm 12
also records its own platform-specific package-manager bootstrap packages in a
separate lockfile document; those are tooling, not compiler imports. Installed
packages retain their notices; do not strip them if distributing `node_modules`.
There is no compiler fetch, dependency installation or bundler step in `build`.
