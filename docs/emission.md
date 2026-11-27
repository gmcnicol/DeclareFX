# Standalone effect compiler and CLI

The subset and ownership resolutions linked in [the spec](implementation-spec.md)
remain canonical, including the [approved numeric amendment](https://github.com/gmcnicol/DeclareFX/issues/6#issuecomment-7219873850).
The [numeric policy blocker is resolved](numeric-blocker.md); cross-platform CI,
actual host validation and final Standards/Spec review remain separate gates.
`compile()` still returns only the validated target program.
`buildEffect` from `dist/src/effect.js` adds DSP validation and standalone emission:

```js
const result = await buildEffect({
  source, bindingsSource, dsp,
  filename: 'gain.declare',
  bindingsFilename: 'gain.bindings.json',
  dspFilename: 'gain.dsp.eel',
});
// Success: { ok: true, jsfx, diagnostics }; failure: { ok: false, diagnostics }.
```

Inputs are source strings; binding JSON is parsed strictly before lowering.
Filenames supply diagnostics only. This interface does not publish files, load
DSP, execute EEL2 or run the generated effect.

## Run the example

After `pnpm install --frozen-lockfile` and `pnpm build`:

```sh
pnpm declarefx --help
pnpm declarefx --version
pnpm declarefx build examples/gain.declare --bindings examples/gain.bindings.json --dsp examples/gain.dsp.eel --out gain.jsfx
```

The package's local Node bin is `declarefx`; `pnpm declarefx` is its project
script. Paths resolve from invocation cwd. Only explicit `build`, `--help` and
`--version` are supported. Errors/warnings go to stderr with category/code and
source coordinates or binding-field context. Errors exit nonzero.

[The example](../examples/gain.declare) includes a literal background/label and a
half-viewport-width gain control. Its nested level rectangle depends on native
gain, providing visible host-to-UI feedback without dynamic strings or an
extra parameter. [Bindings](../examples/gain.bindings.json) and
[stereo DSP](../examples/gain.dsp.eel) are author-owned. The complete
[`examples/gain.jsfx`](../examples/gain.jsfx) is the committed golden; tests
compare all bytes, not a snapshot regenerated during the test. Updating it is
an intentional reviewable output change, not a way to silence a failing test.

## Emitted runtime

- Native `slider1` retains the parameter identity, source default, continuous
  linear-amplitude range 0–2 and host persistence. There is no custom serialize,
  duplicate saved gain or generated slider reset in initialization.
- `@block` reads one native scalar into `__dfx_audio_gain`, clamps finite values
  to 0–2 and substitutes 1 for non-finite input. Read-only `dfx_param_gain` is
  prepared before author block work and remains unchanged by generated code
  throughout that block's samples. UI changes need not invoke `@slider`.
- Graphics use separate `__dfx_ui_` scalars and static named strings. Geometry
  runs in a static topological dirty schedule, first before hit testing and
  again after edits. Inputs observe actual `gfx_w`/`gfx_h`, not requested initial
  dimensions. Dependency changes include validity transitions; exact `===`/`!==`
  comparisons do not discard small changes. Lazy expressions evaluate only
  taken branches; arithmetic results are checked before assignment can filter
  overflow to zero, including explicit zero-divisor checks. UI arithmetic uses
  native EEL2 underflow: tiny literals, stored values and intermediates, including
  tiny normals, may become zero. Exact comparisons operate on represented values,
  not promised Node values. No universal cutoff or cross-host tiny-branch parity
  is claimed; underflow-created zero denominators are guarded.
- Invalid geometry retains its last valid scalar, initially zero. Separate
  validity prevents a retained positive width from permitting a bad drag.
  `__dfx_ui_numeric_error` is a sticky bounded graphics diagnostic flag, not a
  log or host edit. Translated coordinates are also checked before drawing.
- Source-order rectangles/text translate through parents. Drawing/hits are
  limited to the root viewport; nested clipping is not promised. Labels use
  bitmap font 0 and EEL2 byte escapes, not JavaScript/JSON Unicode escapes.
  `gfx_ext_retina = 1` opts into the documented host behavior; native mouse and
  framebuffer coordinates are used together without a second scaling transform.
- A press inside the visible, valid positive-sized control starts relative
  horizontal dragging without editing. Motion uses the latest safe native
  value plus `2 * deltaX / current_control_width`, clamps to 0–2, and calls
  `slider_automate(1)` only for an actual value change. Stationary frames never
  replay a press-time value. No rollback, smoothing or exclusive UI lock exists.
- Notified touches end with `slider_automate(1, 1)`. Release (including outside),
  focus/visibility loss, invalid size, and closed-editor idle callbacks cancel
  the transient drag. The supported mechanisms are `gfx_getchar(65536)` flags
  and `options:gfx_idle` / `gfx_ext_flags & 2`, not an invented close callback.
  Closed-editor callbacks may run at a reduced rate: immediate cancellation
  latency is not promised. Actual interrupted gestures remain a host gate.

No generated layout, string work, UI traversal, indexed-memory allocation or
retry loop runs in `@block`/`@sample`. Trusted author DSP may of course perform
its own processing and use its own scratch/indexed memory.

All generated executable numbers use the shared finite plain-decimal formatter:
source constants, slot/default initializers, slider defaults, initial viewport
sizes and maximum-finite guards. It deterministically expands the shortest
finite decimal spelling without exponent syntax or dependencies. Non-finite
inputs remain invalid. Constant validation conservatively defers fractional and
underflow-sensitive proofs to the existing guarded runtime, not a software-float
runtime or global rounding/flushing policy.

## DSP boundary and limits

Optional `@init`/`@block` and required `@sample` are assembled once each. Their
bodies are retained, with CRLF/CR normalized to LF for output. Comments/strings
are distinguished when checking section and symbol use. The compiler refuses
other/duplicate lifecycle sections, imports, independent slider declarations,
case-insensitive `__dfx_` names (including namespace segments/named strings),
author graphics/mouse resources, parameter-notification APIs, alias/native
writes and definitions/shadowing. Known mutating API output arguments are
checked too. Init-defined helpers may read the alias when called later; direct
init execution, including statically visible helper calls, may not read it.
Executable scientific numeric tokens are rejected with `numeric/DFX_DSP_NUMBER`
and source coordinates rather than silently rewritten. Comments, quoted strings
and identifier names containing exponent-like text are not numeric tokens. Author
DSP is otherwise preserved; no generated underflow/rounding policy is applied to it.

This is **not an EEL2 compiler or sandbox**. It diagnoses detectable ownership
conflicts; it does not prove arbitrary DSP syntax, termination, dynamic string
captures, indirect namespace effects, memory bounds or runtime behavior safe.
Authors must preserve the read-only alias/native-parameter and initialization
contracts even where static detection is incomplete. Source is never executed
by DeclareFX to validate it. REAPER compilation remains an outstanding check.

## Determinism and publication

Output is UTF-8/LF. Its disposable marker/provenance identifies compiler version,
subset and upstream revision. `inputs-sha256` hashes UTF-8 encoding of
`JSON.stringify([source, bindingsSource, dsp])`, preserving raw decoded input
line endings/BOM and binding whitespace in identity. No diagnostic filenames,
absolute checkout paths, time or random staging names enter generated bytes.

The CLI refuses resolved input/output aliases, including hardlinks and aliased
parent directories. Existing outputs must be regular, non-symlink files with
the exact first-line compiler marker. Manual changes to marked outputs are
**disposable**; there is no edit merge/detection system.

Only a fully validated effect is staged in an exclusively created sibling file,
written/flushed/closed, and published. Output ownership/content is rechecked
before publication. Existing owned output uses same-filesystem atomic rename;
a new output uses a no-clobber hardlink of the complete staging file. Staging
files are removed; cleanup failure is a warning, not a false failed build after
successful publication. Unsupported filesystem operations fail without an
unsafe direct-write fallback. Failed validation/I/O before publication leaves
previous output untouched.

This protects ordinary local regeneration, not hostile concurrent filesystem
mutation. There is no portable compare-and-rename transaction against an
adversary swapping directories/files after the final check, nor a power-loss
recovery/directory-fsync guarantee. Three-OS/filesystem validation remains the
evidence ticket's gate; local Linux tests are not cross-platform evidence.

## References and evidence boundary

Context7 quota was exhausted, so official sources were fetched directly:

- [JSFX sections, persistence, slider declarations and gfx_idle](https://www.reaper.fm/sdk/js/js.php)
- [Exact comparisons, arithmetic and scalar model](https://www.reaper.fm/sdk/js/basiccode.php)
- [Graphics, focus/visibility flags, bitmap font, clipping and HiDPI](https://www.reaper.fm/sdk/js/gfx.php)
- [Automation/end_touch and mutating APIs](https://www.reaper.fm/sdk/js/advfunc.php)
- [Functions, private parameters and namespace behavior](https://www.reaper.fm/sdk/js/userfunc.php)
- [Strings and adjacent literal concatenation](https://www.reaper.fm/sdk/js/strings.php)
- [Official WDL EEL2 escape decoder](https://github.com/justinfrankel/WDL/blob/6a67ec5788ca6ee252b19cd8071796db49d763a7/WDL/eel2/nseel-eval.c)
- [Resolved numeric policy and historical source evidence](numeric-blocker.md)
- [Node 24 filesystem APIs](https://nodejs.org/docs/latest-v24.x/api/fs.html)

Compiler/CLI/golden tests and the independent arithmetic model are **not EEL2
execution**, audio renders, automation recordings, GUI checks or performance
measurements. Target REAPER 7.02+ has not been installed or run here. The exact
numerical/manual [host protocol](host-validation.md) remains entirely pending;
[current automated evidence and CI status](proof-evidence.md) are separate.
