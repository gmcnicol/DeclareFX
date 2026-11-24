# Declare licensing and compiler extension points

Research for [Investigate Declare licensing and compiler extension points](https://github.com/gmcnicol/DeclareFX/issues/4), under [Wayfinder: Establish Declare → JSFX compiler architecture and prove the vertical slice](https://github.com/gmcnicol/DeclareFX/issues/1).

## Outcome and scope

**A separate, pinned lowering consumer is technically plausible without modifying upstream, but no existing EEL2 target plug-in was found.** The existing program tree is useful input, not a complete target-neutral executable IR. An upstream target interface would require upstream changes/agreement; adding a renderer alone does not remove the JavaScript runtime. These are research conclusions, not an architecture decision or a feasibility proof in REAPER.

Proposed investigation pin: **`cc62d9dfa0b39f84e20480ff28bed8107d986331`**, upstream `davidtemkin/declarelang`, fetched 2026-11-24; commit subject “The LZX apps rebuilt on OpenLaszlo, exact measureText, and four fixes” (commit dated 2026-11-23 -0800). [Permanent commit](https://github.com/davidtemkin/declarelang/commit/cc62d9dfa0b39f84e20480ff28bed8107d986331). Manifest identifies 0.7.1, MIT, private ESM distribution; it has CLI bins but no `exports` package API map. Pin the SHA, not the version label. [Manifest][manifest]

Source was cloned into `/tmp/declarefx-upstream-issue4`, never into this deliverable tree. Codegraph was discovered first with absolute worktree `projectPath`; it reported no index, so direct source reads/searches were used. No indexing/configuration was performed. The find-docs workflow's Context7 lookup found no `declarelang` library; pinned first-party source and bundled declarations were used instead. No external vendor selection was needed.

## Licence and notices

- Root licence is **MIT, Copyright (c) 2026 David Temkin. All rights reserved.** It permits use, copying, modification, distribution, sublicensing and sale, conditioned on retaining the copyright and permission notice in copies or substantial portions; it also disclaims warranties. There is no source-disclosure or upstream-contribution requirement in that text. This supports a standalone MIT DeclareFX toolchain while retaining upstream attribution; it does not make every bundled dependency/asset MIT. [Licence][license]
- Upstream explicitly says its browser compiler bundles TypeScript and `lib.d.ts`, and its distribution includes Roboto. Its notice records Microsoft/Apache-2.0 for TypeScript and Roboto Project Authors/SIL OFL 1.1 for fonts. Apache section 4 requires licence delivery, notices of modified files, retention of relevant attribution and any applicable NOTICE material. Carry applicable notices with redistributed compiler artifacts, rather than relying on stripped/minified comments. The bundler explicitly sets `legalComments: "none"`. [Third-party notices][notices], [bundle construction][bundle]
- Inventory depends on what ships. For a Node compiler consuming TypeScript/esbuild packages, inspect the exact shipped dependency closure and their own licence/NOTICE files. The manifest declares TypeScript `^5.9.3` and esbuild `^0.28.1`; the lock resolves TypeScript 5.9.3, while its root version still says 0.6.5. Do not infer a reproducible pnpm installation from the manifest alone: this pin ships `package-lock.json`, not a pnpm lock. No dependency install or lock conversion was tested. [Manifest][manifest], [lock][lock]
- Whole-repository redistribution needs more than the root licence: Vello has separate MIT/Apache texts, and weather assets include CC BY-SA/GFDL entries. These assets are unnecessary for compiler-only consumption and should not be assumed cleared by MIT. [Vello MIT][vello], [Vello Apache][vello-apache], [sky notices][sky], [map notices][maps]
- Distinguish **compiler distribution** from **generated effect distribution**. Compiler notices do not automatically mean every user's independently authored output must include the entire toolchain licence inventory. Conversely, copied upstream code/runtime templates or substantial translated library bodies in generated effects need a notice review. The examined MIT text does not provide a special generated-output exception. Decide what is copied, then preserve applicable notices (potentially a generated header/accompanying licence file); do not promise that output is notice-free. This is an engineering compliance reading, not legal advice or an exhaustive provenance audit.
- One provenance question deserves upstream clarification before copying broadly: `compiler/src/closure.ts` describes itself as ported from the OL5 compiler/Java dependency tracker model. That comment alone does **not** establish a licence conflict, but this investigation did not audit the historical source lineage. [Closure header][closure]

## Vocabulary used here

- **Program tree**: Declare `Program`/`Element` structure, with literals, class declarations and source-text bodies; it is not a typed expression AST.
- **Constraint dependencies**: slot read-paths attached to computed values. Not an already allocated graph of concrete cells.
- **Build closure**: files/directories and freshness validators plus compiler properties. Not a JavaScript function closure or the reactive dependency graph.
- **Renderer backend**: a running JS runtime's surface adapter, not a source-code generation target.

These distinctions follow the actual [parser types][parser], [dependency transport][deps], [build closure][closure] and [backend contract][backend]. They propose no new project-wide terminology or human decision.

## Actual compilation and extension seams

| Stage | Verified interface and behaviour | Publicness / consequence for DeclareFX |
|---|---|---|
| Parse | `parseProgram(source): Program`; `parse` handles an element and `parseLibrary` a library. `Program` holds classes/themes/styles/fonts/includes/scripts/root; `Element` holds attrs/decls/methods/children and positions. Code literals have `src`, optional `deps` and optional encoded `expr`; `Method.body` is a string. [Parser][parser], [entry surface][entry] | Parser functions and types are exported. Parsing is syntax recognition, **not** type validation. No public typed expression-node graph is returned. |
| Include and scope resolution | `compile(source, CompileOptions): Promise<Compiled>`; resolves explicit and auto includes and merges sources, checks structure, resolves bare names, and checks bodies. Node wrapper supplies filesystem/library host and esbuild script bundling. [Options/pipeline][compile], [Node wrapper][node] | Callable exported functions; hosts and `bundleScripts` are real input seams. Options do not include a target emitter callback/target registry. `bundleScripts` produces CommonJS for embedded JS, not a foreign-language backend. |
| Structural/type checking | `check(program)` and `programSchemas` use built-in schemas plus program classes. `typecheckBodies` builds synthetic instance types/scaffold, then a TypeScript program; `TypeOracle` answers method-call targets for extraction. Main compile calls typecheck before dependency annotation. [Typecheck][typecheck], [oracle][oracle], [compile tail][tail], [schemas][schemas] | Checker functions are exported; oracle is an internal collaboration between compiler modules, not a returned full typed IR. Upstream success proves Declare/JS validity, not supported EEL2 semantics. A lowering consumer must perform its own subset diagnostics. |
| Main output | `Compiled.source` is resolved Declare source with rewritten JS bodies, not a standalone JSFX or even just a JS module. `errors`, `warnings`, `diagnostics`, `report`, sources and walk-order deps are enumerable. Optional `.program` is the checked/resolved tree with deps/bytecode, deliberately **non-enumerable**; JSON, spreads and structured clone lose it; `carryProgram` preserves it in result copies. [Compiled][compiled] | Explicitly documented source-level interface but no separately versioned target ABI. Direct in-process consumption avoids reparsing and preserves authored positions. Serializing `Compiled` without explicitly preserving `program` loses the tree. |
| Program build | `programFromCompiled(c, {stripPos, facts, links})` returns `ProgramBuild`, rechecks, attaches deps if reparsing, determines used classes, lowers literal values/themes, routes slots, marks `trusted`, and strips positions by default. Browser `compileProgram` wraps this tail. [Program build][build], [browser entry][browser] | Exported building block, reused by CLI/browser. `stripPos:false` retains diagnostic locations. Build tail consumes/mutates the tree; don't assume a shared tree remains raw. `trusted` is an upstream validation stamp, not approval for an EEL2 subset. |
| Numeric expression encoding | `emitExpr` returns `{code, paths, consts}` or null; `annotateExprs` attaches compact bytecode only for eligible code values with nonempty deps. Covers numeric/boolean literals, slot reads, arithmetic, comparisons, conditions and selected Math calls, with limited pure numeric method inlining. Numeric slot eligibility is finally checked at binding time. [Emitter][expr], [annotation][annotate], [binder][bind] | Exported internal kernel helper, not complete language IR. Strings, general handlers, arbitrary functions and script modules remain JS. Even encoded expressions are candidates, not proof all reads are numeric. |
| Reactive dependencies | `extractProgram(program, oracle)` yields read-paths, dynamic status and extraction errors. `annotateProgram` puts empty deps on dynamic/error cases; compile rejects extraction residue errors. Legitimate dynamic tracking cases can remain empty. `serializeDeps`/`applyDeps` zip code values in fixed root/classes traversal; numeric encoding rides a marked `=E` entry. [Extraction][extract], [annotation rules][dep-annotate], [transport][deps], [compile tail][tail] | Read-path metadata, not an executable schedule. Missing/empty deps do **not** establish constancy. JS runtime binding resolves instance paths/cells; reactive runtime owns cells, constraints and settle. An independent target must bind paths and specify invalidation/order/cycles or refuse unsupported cases. [Reactive runtime][reactive] |
| File dependency closure | `compileTracked` adds a `Closure`: files/dirs, validators and props; cache helpers test freshness. [Node tracked entry][tracked], [closure model][closure] | Reusable build-cache seam, separate from reactive dependencies. Target/subset version and emitter options would need to participate in DeclareFX's own cache identity. |
| Component registry | Runtime `TAGS`, `LAYOUTS`, `DATA`, animator/source/state tables map names to JS constructors; `REGISTRY_NAMES` and `REGISTRY_MANIFEST` drive slimming. Schema registry is the checking half. User classes extend known bases and are resolved per program. Simple/Wrapping/Responsive layouts are Declare library classes, not native strategies in `LAYOUTS`. [Registry][registry], [schemas][schemas] | Explicit name tables and build-time slim substitution, **not** a supported generic `registerTarget` or foreign component ABI. `compiler/src/registry.ts` is a different registry: navigation destinations/anchors, not renderer/component registration. [Navigation registry][navigation] Adding EEL2-specific tags solely to runtime tables would miss checking/scaffolding and would not generate code. |
| Renderer | Public `RenderBackend` has `createSurface()` and `attachRoot(host: HTMLElement, root: Surface)`. `Surface` exposes geometry/paint/text/input and many richer facilities. `buildProgram` instantiates a tree, `renderProgram` mounts it through a backend. [Backend][backend], [boot][boot], [public entry][entry] | Genuine renderer seam for running upstream JS objects. `compileExpr`/`compileBody` still use JS functions (or supplied precompiled JS). A new backend cannot by itself make native standalone EEL2. [Expression runtime][runtime-expr] |

“Public” above means intentionally exported/re-exported at this pin, not an upstream promise of third-party compatibility. `private:true` plus absent package export map means consuming repository-relative dist modules/bundles needs an explicit packaging/pin strategy. No stable foreign-target compatibility commitment was established.

## Small executable inspection (no production implementation)

Executed on Linux, Node **v24.16.0**, against the committed `bundles/declare-compiler.js` at the pin, without dependency installation/rebuild. The bundle embeds its TypeScript lib definitions ([construction][bundle]); this tests the distributed artifact rather than a fresh build's source/artifact parity. The following is the complete core assert-based probe; run from a temporary checkout with `node inspect.mjs`:

```js
import assert from 'node:assert/strict';
import { compile, compileProgram } from './bundles/declare-compiler.js';
const src = `App [ width = 400, height = 200, gain: number = 1,
  View [ width = { parent.width / 2 }, height = 20, fill = #112233 ],
  Text [ text = { "Gain " + app.gain } ],
  onPointerDown() { gain = gain + 1 }
]`;
const c = await compile(src);
assert.equal(c.errors.length, 0, c.report);
assert.ok(c.program);
assert.equal(Object.keys(c).includes('program'), false);
assert.equal(JSON.parse(JSON.stringify(c)).program, undefined);
const width = c.program.root.children[0].attrs.find(a => a.name === 'width');
const text = c.program.root.children[1].attrs.find(a => a.name === 'text');
assert.ok(width.value.expr);
assert.equal(text.value.expr, undefined);
const b = await compileProgram(src, { stripPos: false });
assert.ok(b.program, b.report);
assert.equal(b.program.trusted, true);
assert.ok(b.program.root.pos);
const bad = await compile('App [ gain: number = "bad" ]');
assert.ok(bad.errors.length);
console.log({width, text, handler: c.program.root.methods[0], deps: c.deps});
```

**Observed: all assertions passed (exit 0).** Width retained source `parent.width / 2`, deps `["parent.width"]`, encoding `L0 K2 /`. Text became `"Gain " + this.$root.gain`, deps `["this.$root.gain"]`, **no** numeric encoding. Handler body became `this.gain = this.gain + 1`, still text. Wire deps were `[["parent.width", "=EL0 K2 /"], ["this.$root.gain"]]`. Invalid default produced `DECLARE2000`: `App.gain's default expects a number, got the string "bad"` at line 1, col 22. This establishes that the proposed consumer seam is real and that it still needs string/handler lowering; it does not test interaction, layout parity, generated EEL2 or performance.

## Integration alternatives (not a selection)

| Alternative | Feasible reuse | Work/risks that remain | Maintained fork? |
|---|---|---|---|
| Consume the existing program/encoded constraints | Call pinned compile in-process, explicitly retain `.program`, or use `programFromCompiled` with positions retained; walk classes/attrs/declarations, reuse available numeric encoding and deps. | Existing “IR” still contains JS, path-dependent binding and runtime class semantics. Need strict feature validation, own binding/scheduler, string/event lowering and native drawing/input. Bytecode-only consumption is insufficient even for the text + interactive gain probe. | No upstream edits required, but consumer adapts to internal tree/wire changes. Pin plus fixtures is necessary. |
| Add an upstream-compatible target seam | Propose a checked/resolved tree hand-off before JS-specific output or a versioned semantic expression representation; reuse parser/schema/checker and retain diagnostics. | No such callback in inspected options. Acceptance/API lifetime, where scope/type information survives, target-specific validation and testing are upstream questions. A renderer plug-in is not equivalent. Until accepted, patch maintenance still exists even if small. | Potentially none **after** upstream acceptance; not established today. |
| Thin restricted lowering pass over upstream output | Use exported compile as validation/resolution front end; translate only agreed classes, slot reads, literals, arithmetic and approved handler statements into a small DeclareFX target model; reject everything else. Existing numeric encoding may be used or reparsed with TypeScript. | Still must define number/string/boolean semantics, event effects, stable names/cells, subclass/default resolution and layout subset. Reject scripts/imports/closures/dynamic structures unless specifically supported. Full autogenerated library expansion can silently enlarge scope, so validate included bodies as well as author source. | No upstream changes required at this pin; own limited target semantics, plus pin-change fixtures. |

The first and third overlap: the distinction is whether existing program/bytecode is treated as the target contract or is explicitly validated/lowered into a smaller versioned DeclareFX contract. This report does not select one. Parsing only raw source is possible through the exported parser but would forgo full upstream include/name/type checking; building a second checker is not demonstrated as necessary.

## Questions for human tickets

- [Choose the Declare compiler integration boundary](https://github.com/gmcnicol/DeclareFX/issues/8): accept pinned source-level coupling, seek upstream cooperation, or use a deliberately restricted lowering contract? Which artifact and positions are retained? What update/fixture gate makes a pin change acceptable? Can upstream clarify API stability and closure-module provenance?
- [Define the first-slice language and EEL2 semantic contract](https://github.com/gmcnicol/DeclareFX/issues/6): what exact expression/handler/class/layout forms are allowed, including text concatenation, numeric truth/equality/rounding, undefined/null and defaults? How are unsupported or dynamic dependencies diagnosed? Which included library bodies are allowed?
- [Define parameter ownership and hand-written DSP composition](https://github.com/gmcnicol/DeclareFX/issues/3): how do resolved UI assignments map to parameters, reserved names, memory and generated sections without rewriting DSP? No ownership/threading choice is implied by the upstream tree.
- [Choose the reproducible CLI and proof validation gates](https://github.com/gmcnicol/DeclareFX/issues/2): consume committed bundles or rebuild TypeScript dist with pnpm? Define a fresh pinned dependency/notice inventory and reproducibility gate, then tests that go beyond this structural probe. What upstream code, fonts or libraries actually ship in effects?

## Limitations

Research only: no production compiler, dependency migration, PR or merge. No REAPER/audio/graphics/manual validation; no EEL2 output was produced. No upstream maintainer agreement was sought. The compiler probe used the committed bundle; a clean source rebuild, full upstream test suite, exhaustive language corpus, dependency licence audit and historical provenance audit were not run. Existing numeric bytecode cannot be assumed JSFX-compatible without the separate target semantic contract. No human decision ticket is resolved by these findings.

## Pinned source references

[manifest]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/package.json#L1-L52
[license]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/LICENSE#L1-L21
[notices]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/docs/legal/THIRD-PARTY-NOTICES.md#L1-L78
[bundle]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/tools/internal/build-compiler.mjs#L1-L138
[lock]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/package-lock.json#L1428-L1442
[vello]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/gpu/engine/vendor/vello/LICENSE-MIT#L1-L23
[vello-apache]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/gpu/engine/vendor/vello/LICENSE-APACHE#L1-L176
[sky]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/apps/weather/sky/LICENSES.md#L1-L28
[maps]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/apps/weather/maps/LICENSES.md#L1-L33
[closure]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/compiler/src/closure.ts#L1-L90
[parser]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/runtime/src/parser.ts#L62-L430
[deps]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/runtime/src/deps.ts#L1-L58
[backend]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/runtime/src/backend.ts#L275-L762
[entry]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/runtime/src/index.ts#L1-L95
[compile]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/compiler/src/compile.ts#L987-L1110
[node]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/compiler/src/compile-node.ts#L120-L157
[typecheck]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/compiler/src/typecheck.ts#L235-L286
[oracle]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/compiler/src/typecheck.ts#L501-L540
[tail]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/compiler/src/compile.ts#L1467-L1641
[schemas]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/runtime/src/program-schema.ts#L63-L118
[compiled]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/compiler/src/compile.ts#L246-L300
[build]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/compiler/src/program-build.ts#L155-L219
[browser]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/compiler/src/compile-browser.ts#L374-L383
[expr]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/compiler/src/expr-emit.ts#L1-L58
[annotate]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/compiler/src/expr-emit.ts#L319-L350
[bind]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/runtime/src/bind.ts#L110-L250
[extract]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/compiler/src/dep-extract.ts#L1695-L1747
[dep-annotate]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/compiler/src/dep-extract.ts#L1867-L1880
[reactive]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/runtime/src/reactive.ts#L731-L875
[tracked]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/compiler/src/compile-node.ts#L160-L185
[registry]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/runtime/src/registry.ts#L1-L130
[navigation]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/compiler/src/registry.ts#L29-L55
[boot]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/runtime/src/boot.ts#L611-L687
[runtime-expr]: https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/runtime/src/expr.ts#L261-L303

