# Subset v1 compiler interface

After `pnpm build`, import `compile` from `dist/src/compiler.js`:

```js
const result = await compile({
  source: uiSource,
  filename: 'gain.declare',
  bindings: {
    version: 1, rootState: 'gain', controlPath: ['gainControl'],
    nativeSlot: 1, min: 0, max: 2,
  },
});
if (!result.ok) {
  console.error(result.diagnostics);
} else {
  // A validated target program, not upstream objects or executable JSFX.
  console.log(result.program);
}
```

The interface does not read author files, emit effects, or publish output. Its
binding input is an already parsed, strict v1 object. `buildEffect` owns JSON parsing; the CLI owns file diagnostics (see
[standalone emission](emission.md)). `filename` supplies diagnostic provenance, not a
file to load. Errors return `ok: false` without a program. Diagnostics retain
upstream codes/warnings and distinguish target unsupported/type/reference/cycle,
binding, numeric, text and resource failures. Binding errors name a field.
Diagnostic filenames are caller context; the emitter does not serialize
machine-dependent diagnostic paths into generated output or build identity.
Target body errors use the original containing expression's opening brace;
rewritten offsets are never presented as precise original inner spans.

## Checked frontend and rejection

Only the private adapter in `src/compiler.ts` imports the pinned bundle and knows
its tree shape. Pure upstream parsing is a **rejection preflight**, not an
alternative compiler: top-level includes/scripts (including trailing and empty
include directives), library/class bodies, methods, unsupported attributes,
implicit bodies and unsupported literal forms are refused before file/script
resolution. The checked frontend is called with empty in-memory files/manifest,
no fetch origins or script bundler. Every accepted program must pass upstream
`compile()` and supply its non-enumerable `.program`; parser success is not
enough. The returned target never includes that upstream program.

The same restricted TypeScript AST lowerer checks both authored bodies and
checked/resolved bodies. This matters because upstream removes some TypeScript
syntax: a type assertion or non-null assertion must not become silently accepted
source. Bodies are never evaluated to discover values or dependencies. Upstream
bytecode, trust stamps and dependency metadata are not executable contracts.

Supported syntax and policies remain defined by the canonical decisions linked
in [the implementation spec](implementation-spec.md), not by incidental upstream
acceptance. Declare's quoted literals use its pinned parser's minimal escape
rules; they are not ECMAScript/JSON string literals. Text limits apply to the
decoded literal, including actual NUL/unpaired surrogate rejection.

## Target representation and emitter obligations

`src/target.ts` describes the small target representation:

- `nodes` are deterministic source/preorder records with parent IDs. Geometry
  refers to scalar slot IDs. The root origin is zero; its width/height slots are
  **current viewport inputs**, not the positive literal `initialSize` request.
  Children translate through parents and draw in source order; clipping is to
  the root viewport, not nested boxes. Text uses the target bitmap font.
- Missing child geometry is zero; absent View fill is transparent; absent Text
  text is empty. Literal labels/fills are static data, not runtime expressions.
- Root number/boolean constants have literal expressions. Only the bound native
  gain is mutable. The binding records the uniquely resolved named View, native
  slot/range and source default; renaming/reparenting needs an updated path, not
  a new native slot. The source default must be finite and in 0–2.
- Every accepted read is a typed slot reference. `dependencies` lists unique
  reads in expression order, including potentially taken branches. `order` is a
  deterministic topological order of all slots; cycles are fatal. Observe gain
  and viewport inputs, dirty their transitive dependants and evaluate affected
  slots once in this order in graphics, before hit testing and again after an
  actual edit. This is a static schedule, not a settle loop or runtime solver.
- Expression nodes preserve TypeScript precedence, strict operand types, lazy
  `&&`/`||` and `?:`, and exact `===`/`!==` comparisons. Numeric operations require
  finite double values **at every evaluated intermediate**, not just the final
  result. Guard division by zero/overflow and evaluate only taken branches.
  EEL2 approximate equality must not replace exact comparisons/change detection.
- `invalid: 'retain'` requires last-valid geometry, initially `initial: 0`.
  `nonNegative` distinguishes sizes from positions. Keep evaluation validity
  separately from the retained number, with a bounded diagnostic flag: a failed
  width expression must cancel interaction even if the retained width is positive.
  Invalid/nonpositive current control width cancels without gain rollback.
- `invalid: 'safeGain'` requires clamping finite observed native gain to the
  binding range and substituting **1** for non-finite gain. Its `initial: 1` is a
  safe fallback, not a second source default or authoritative saved value. Mere
  UI observation/repair must not manufacture a host edit. Audio takes its own
  bounded block snapshot before author block processing, not UI-derived state.

The representation uses scalar slots/static strings only; no indexed-memory
allocator or general runtime is introduced. Static constant propagation rejects
provable invalid arithmetic and negative sizes, respecting known short-circuit
branches. Runtime-dependent validity is an emitter obligation, not something
this TypeScript analysis proves about EEL2.

## Validation limits

Compiler tests exercise the public result and diagnostics, including the full
literal-label example, every permitted operator, invalid/erased syntax, checked
frontend errors/warnings, scopes, cycles, strict bindings, text and resource
limits. They are target-structure and compile-time arithmetic checks, **not EEL2
execution**. This module does not validate or load DSP. DSP restrictions, standalone emission, generated host notification/gesture
handling, safe publication and end-to-end determinism are covered by the
[effect compiler and CLI](emission.md). Three-platform CI and actual
REAPER/audio/UI checks remain separate evidence gates. No host or performance claim follows from a
successful target program.
