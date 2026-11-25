# First-slice syntax and binding feasibility (pinned research)

Research for [DeclareFX #10](https://github.com/gmcnicol/DeclareFX/issues/10), subordinate to [the map](https://github.com/gmcnicol/DeclareFX/issues/1) and [the checked-tree integration resolution](https://github.com/gmcnicol/DeclareFX/issues/8#issuecomment-7174540099). No language-policy choice or target implementation is made here.

## Result

**The committed compiler bundle accepts a small App/View/Text source with named children, root numeric gain, derived geometry, dynamic text and gain-writing handlers, without an upstream patch.** Both ordinary typed declarations carrying target metadata and external binding configuration are feasible inputs to a DeclareFX-owned validator; neither automatically binds anything to JSFX. Plain builtins require no included library bodies. A library Slider is a materially larger alternative, not interchangeable with the bare View region below.

All findings below were checked at upstream **cc62d9dfa0b39f84e20480ff28bed8107d986331**, not latest upstream. Existing checkout `/tmp/declarefx-upstream-issue4` reported that HEAD; tracked compiler/runtime/library inputs and bundle had no diff against it. Only temporary probes were written outside tracked upstream source. Codegraph was discovered and `codegraph_explore` called first with that absolute projectPath; it reported no index. Research therefore used pinned source directly, without installing, indexing or configuring anything.

Executable evidence: Node **v24.16.0**, committed [bundles/declare-compiler.js](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/bundles/declare-compiler.js), SHA-256 `f5694d953e8e2df6abf51c113f465904b3fe5797665a4e66206dc16bf533ba3b`. Source citations explain the implementation; probes establish behavior of the shipped bundle, **not source/bundle rebuild parity**.

## Minimal valid source

The exact source is the `src` constant in the executable below:

```declare
App [ width = 400, height = 200, gain: number = 1,
 background: View [ width = { parent.width }, height = { parent.height }, fill = #112233 ],
 label: Text [ text = { "Gain " + app.gain } ],
 gainControl: View [ y = 40, width = { parent.width / 2 }, height = 20, fill = #557799,
 onPointerDown(e: PointerEvent) { app.gain = e.x / this.width },
 onClick() { gain = gain + 0.1 } ] ]
```

This is a syntax/typechecking fixture, **not a finished gain widget**: the two handlers demonstrate independent accepted forms, not a recommended combination of pointer-down and click behavior. No coordinate-origin conversion, clamping, zero-width guard, drag capture, gain range, number formatting or native-slot semantics is established. Those belong to the target contract/implementation. The literal App size is a compile fixture, not evidence of host resize behavior.

### Names, state, expressions and handlers

- A named child is `gainControl: View [ ... ]`, yielding `Element.name = "gainControl"`, `tag = "View"`. Not `View gainControl [ ... ]`, nor `id = "gainControl"` (both rejected). Repeated compiles produce deeply equal trees. An external binding can identify this fixed child by the named path from the root, not child array index or source offset. This is stable **authored structural identity**, not a universal persistent runtime ID: renaming/reparenting or replication requires separate rules. [Grammar and element representation](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/runtime/src/parser.ts#L1-L47), [Element](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/runtime/src/parser.ts#L205-L230).
- `gain: number = 1` declares a typed slot under `root.decls`, not `attrs`. `gain = 1` alone would only set an existing slot. The checker rejects a string numeric default and a string assignment to gain. [AttrDecl](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/runtime/src/parser.ts#L170-L190).
- `parent.width` and `parent.gain` stay parent reads. `app.gain` and bare ancestor `gain` become `this.$root.gain` in this main tree. `root.width` is not a substitute for `app.width` and is rejected. In a named class body, bare own state becomes `this.amount`; its nested child's read becomes `classroot.amount`. Do not conflate lexical classroot with application root. [Resolver scope contract](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/compiler/src/compile.ts#L1-L41).
- Text uses `text = { "Gain " + app.gain }`. The checked code value retains rewritten TypeScript source and dependencies, but has no numeric `expr`. Numeric geometry retains both source/deps and an optional encoded expression (`L0 K2 /` for half parent width). These encodings are evidence, not the chosen executable target contract. [Literal code shape](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/runtime/src/parser.ts#L54-L70), [expression emitter](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/compiler/src/expr-emit.ts).
- `onPointerDown(e: PointerEvent) { ... }` and parameterless `onClick() { ... }` compile. A pointer parameter without its payload type is rejected. Explicit `app.gain = ...` and bare `gain = gain + 0.1` both resolve to root assignments. Bodies remain statement strings with `params`, `pos` and `bodyPos`; compiling does not execute them. A typo in an `on...` name can be a warning rather than a hard rejection, so successful compile is not proof an event will fire. [Method representation](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/runtime/src/parser.ts#L144-L168), [unknown-handler checks](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/compiler/src/compile.ts#L672-L684).

## Binding representation: two feasible alternatives, no policy selected

**Ordinary declarations:** this also compiles:

```declare
App [
 gain: number = 1,
 nativeSlot: number = 1,
 gainControl: View [ targetState: string = "gain", slot: number = 1 ]
]
```

These are ordinary typed reactive slots, not annotations or special upstream attributes. Their checked defaults are accessible in `decls`. A DeclareFX convention could read literal defaults and associate root `gain`, child `gainControl`, and native slot 1. It would need to specify which declaration owns the association (the example intentionally exposes both root and control placements), reserved names, literal-only/static requirements and conflict validation. Upstream merely checks their types; it does not validate slot ownership, ranges, integer slot indices, target-state existence, duplicate bindings or binding completeness. Strings such as `"gain"` are not automatically linked references. Adding a bare `nativeSlot = 1` without declaring it is rejected, as is an undeclared `Parameter` tag. No new tag, registry entry or upstream patch is necessary to carry ordinary metadata. [Declaration checking](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/runtime/src/check.ts#L900-L970), [declaration AST](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/runtime/src/parser.ts#L170-L190).

**External configuration:** the original minimal source can remain unchanged, with a conceptual target-owned record such as:

```json
{"rootState":"gain","controlPath":["gainControl"],"nativeSlot":1}
```

This JSON is a feasible **proposed representation**, not a discovered upstream API or implemented configuration. The target consumer would resolve the root numeric declaration and named child against the checked tree and reject missing/ambiguous/unsupported mappings. It avoids adding reactive model state solely for target metadata, but adds another input requiring reproducible identity, diagnostics and validation. Neither option chooses the human's parameter policy or changes the agreed ownership in [#3](https://github.com/gmcnicol/DeclareFX/issues/3#issuecomment-7162839879).

A `View [ width <-> app.gain ]` is **not** native binding: it is rejected because View has no commit hook. Library `Slider [ value <-> app.gain ]` does compile and becomes a one-way value constraint plus a synthesized `commit(v)` root assignment. That is upstream control-value handback, not a host parameter binding. [Two-way validation](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/compiler/src/compile.ts#L748-L784).

## Checked tree and required work before lowering builtins

1. **Consume `compile().program` in process.** It is non-enumerable: object spread and JSON serialization lose it. The tree contains separate root/classes, attrs/decls/methods/children, original literal forms, rewritten bodies and dependency metadata. Guard errors before using it. [Attachment](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/compiler/src/compile.ts#L246-L300), [final checked tree](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/compiler/src/compile.ts#L1623-L1641).
2. **No implicit library expansion is needed for bare App/View/Text in this probe.** With the pinned manifest supplied, `App [ View [], Text [] ]` has zero classes and just those children; it also compiles without library files. Their native inherited defaults (geometry, text appearance, etc.) are runtime schema behavior, not a flattened list in this tree. A target must define its accepted defaults explicitly, not assume missing attrs are fully materialized. [View definitions/defaults](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/runtime/src/view.ts#L2340-L2488), [Text](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/runtime/src/text.ts#L77-L145).
3. **User classes are not flattened.** The included/inline `Panel` probe keeps its declaration default `amount = 2`, width expression and named Text child in `program.classes[0].body`; the root's `p: Panel [ amount = 3 ]` stays tag Panel with no copied children. Before dispatching builtin tags a consumer supporting classes must resolve base chains, declared defaults, overrides, inherited children and lexical `classroot`/parent/root bindings while preserving provenance. This can be a derived effective tree or an equivalent class-aware walk; it need not mutate the checked program. Otherwise explicitly reject unsupported classes/bodies. Flattening by only copying attrs loses state, handlers, child structure and binding scopes. The upstream runtime, not `compile()`, normally performs that composition. [Class synthesis](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/runtime/src/instantiate.ts#L735-L864), [attribute merging](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/runtime/src/instantiate.ts#L1038-L1070), [construction/class sources and placement](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/runtime/src/instantiate.ts#L1187-L1455).
4. **Defaults are declarations/class attributes, not a verified `default View [...]` language feature.** That attempted top-level syntax fails. Included class defaults are already parsed and checked but still need the class composition above. No wholesale default/class erasure is safe.
5. **Explicit includes are resolved/merged, not instance-expanded.** The probe's `include [ "panel.declare" ]` disappears from `program.includes`; Panel remains a class body, with file positions. The browser bundle accepts an explicit in-memory `files` map and `manifest`; a registered default library can also influence it. Freeze these inputs for reproducibility. Missing library data rejects Slider rather than supplying its behavior. [Include resolution](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/runtime/src/include.ts), [browser host/default library](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/compiler/src/compile-browser.ts#L240-L280).
6. **High-level controls can introduce implicit bodies and nodes.** With the full pinned library map/manifest, Slider brings in **Control, ValueControl, Slider**, plus the automatically provided **FocusRing** class and a last App child of that tag. The shorthand also introduces a `commit` method with parameter type `any`. These classes carry ordinary library code, not tiny native gain semantics. The strict lowerer must validate or reject all reachable included/class/provided bodies, not silently discard them or whitelist Slider by tag alone. Supporting raw View handlers avoids these particular library additions; it does not supply interaction behavior for free. [Manifest](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/library/autoincludes.json#L1-L53), [provided singleton insertion](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/compiler/src/compile.ts#L1134-L1163), [Slider implementation](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/library/slider.declare).
7. **Do not substitute `compileProgram`/`programFromCompiled`.** A probe confirms that path changes numeric literals to `kind:"value"` and stamps `trusted`. The source shows it consumes/mutates the carried tree, trims shipping metadata, lowers literals/themes, routes attributes, computes permitted classes and strips positions by default. It does not solve native class/handler semantics. [Program-build tail](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/compiler/src/program-build.ts#L160-L218).

After composition/validation, bind allowed rewritten TypeScript reads/writes to target-owned state and parse expressions/handlers through the restricted AST path agreed in #8. Preserve code-value source for strings and handlers; numeric bytecode alone cannot represent this fixture. Missing or empty deps are not evidence of constancy.

## Original-source diagnostics: what was actually verified

Single-file code-value `pos` and handler `bodyPos` still point to the original opening brace even though `app.gain` has expanded to `this.$root.gain`. The text position is line 3, column 23, offset 165. Includes preserve original **file/line/column**: included Panel class is `panel.declare:1:1`; main root is line 2, column 1; the included invalid number default is `bad.declare:1:38`.

**Caveat:** checked-tree include offsets can still be merged-text offsets. The main root has offset 116 in the probe despite its original two-line source being much shorter. Use file/line/column, not that offset as an original-file index. Also, an inner offset into a rewritten body is not automatically an offset into the original body. Downstream AST diagnostics need deliberate translation/provenance; these brace/member positions alone do not prove arbitrary inner-expression diagnostic fidelity. Source confirms line-map application at the final tree seam. [Rebasing and tree line map](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/compiler/src/compile.ts#L1634-L1641), [position mappers](https://github.com/davidtemkin/declarelang/blob/cc62d9dfa0b39f84e20480ff28bed8107d986331/compiler/src/compile.ts#L1904-L2012). The earlier compile API comment about included errors having merged positions is stale relative to the final rebasing and the observed included error; the probe is the specific verified fact.

## Reproduction

Use a clean checkout at the exact SHA (no dependency install/build required for this committed bundle). Extract the following block to `/tmp/first-slice-probe.mjs`, then:

```sh
git -C /path/to/declarelang rev-parse HEAD
sha256sum /path/to/declarelang/bundles/declare-compiler.js
node /tmp/first-slice-probe.mjs /path/to/declarelang
```

The script only reads that checkout. All tests use the committed bundle; library files are pinned alongside it. Assertions check accepted **and** refused forms rather than merely logging compilation.

```js
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const upstream = process.argv[2];
const {compile, compileProgram} = await import(pathToFileURL(upstream + '/bundles/declare-compiler.js'));
const files = {};
function load(dir = '') {
  for (const e of readdirSync(upstream + '/library/' + dir, {withFileTypes:true})) {
    if (e.isDirectory()) load(dir + e.name + '/');
    else if (e.name.endsWith('.declare')) files['library/' + dir + e.name] =
      readFileSync(upstream + '/library/' + dir + e.name, 'utf8');
  }
}
load();
const opts = {files, manifest: JSON.parse(readFileSync(upstream + '/library/autoincludes.json')), libraryRoot:'library'};
async function good(src, options = opts) {
  const c = await compile(src, options);
  assert.equal(c.errors.length, 0, c.report);
  assert.ok(c.program);
  return c;
}
async function bad(src, match, options = opts) {
  const c = await compile(src, options);
  assert.ok(c.errors.length, src);
  assert.match(c.report, match);
  return c;
}
const src = `App [ width = 400, height = 200, gain: number = 1,
 background: View [ width = { parent.width }, height = { parent.height }, fill = #112233 ],
 label: Text [ text = { "Gain " + app.gain } ],
 gainControl: View [ y = 40, width = { parent.width / 2 }, height = 20, fill = #557799,
 onPointerDown(e: PointerEvent) { app.gain = e.x / this.width },
 onClick() { gain = gain + 0.1 } ] ]`;
const c = await good(src);
assert.deepEqual(c.program.classes, []);
assert.equal(c.program.root.tag, 'App');
assert.deepEqual(c.program.root.children.map(x=>[x.name,x.tag]),
  [['background','View'],['label','Text'],['gainControl','View']]);
assert.deepEqual((await good(src)).program, c.program);
assert.equal(Object.getOwnPropertyDescriptor(c, 'program').enumerable, false);
assert.equal(JSON.parse(JSON.stringify(c)).program, undefined);
assert.equal({...c}.program, undefined);
const root = c.program.root;
assert.equal(root.decls[0].name, 'gain');
assert.equal(root.decls[0].type, 'number');
assert.equal(root.decls[0].def.value, 1);
const [background,label,control] = root.children;
const width = control.attrs.find(a=>a.name==='width').value;
assert.deepEqual(width.deps, ['parent.width']);
assert.equal(width.expr, 'L0 K2 /');
const text = label.attrs[0].value;
assert.equal(text.src, ' "Gain " + this.$root.gain ');
assert.deepEqual(text.deps, ['this.$root.gain']);
assert.equal(text.expr, undefined);
assert.equal(control.methods[0].params[0].type, 'PointerEvent');
assert.equal(control.methods[0].body, ' this.$root.gain = e.x / this.width ');
assert.equal(control.methods[1].body, ' this.$root.gain = this.$root.gain + 0.1 ');
assert.equal(text.pos.line, 3);
assert.equal(text.pos.col, 23);
assert.equal(src[text.pos.offset], '{');
assert.equal(src[control.methods[0].bodyPos.offset], '{');
const read = await good('App [ gain: number = 1, v: View [ x = { parent.gain }, y = { app.gain }, width = { gain } ] ]');
assert.deepEqual(read.program.root.children[0].attrs.map(a=>a.value.src.trim()),
  ['parent.gain','this.$root.gain','this.$root.gain']);
console.log('PASS builtins, repeatable named identity, typed state, parent/app/bare reads, dynamic text, typed handler, assignment, original single-file positions, non-enumerable program');
const metadata = await good('App [ gain: number = 1, nativeSlot: number = 1, gainControl: View [ targetState: string = "gain", slot: number = 1 ] ]');
assert.equal(metadata.program.root.decls[1].def.value,1);
assert.equal(metadata.program.root.children[0].decls[0].def.value,'gain');
console.log('PASS ordinary typed metadata declarations; no automatic native binding implied');
const panel = 'class Panel extends View [ amount: number = 2, width = { amount * 10 }, inner: Text [ text = { "N " + amount } ] ]';
const cl = await good(panel + '\nApp [ p: Panel [ amount = 3 ] ]');
assert.equal(cl.program.classes[0].body.decls[0].def.value,2);
assert.equal(cl.program.classes[0].body.attrs[0].value.src.trim(),'this.amount * 10');
assert.equal(cl.program.classes[0].body.children[0].attrs[0].value.src.trim(),'"N " + classroot.amount');
assert.equal(cl.program.root.children[0].tag,'Panel');
assert.equal(cl.program.root.children[0].children.length,0);
files['panel.declare'] = panel;
const inc = await good('include [ "panel.declare" ]\nApp [ p: Panel [] ]');
assert.equal(inc.program.includes.length,0);
assert.equal(inc.program.classes[0].pos.file,'panel.declare');
assert.equal(inc.program.root.pos.line,2);
assert.equal(inc.program.classes[0].body.attrs[0].value.pos.col,56);
files['bad.declare']='class Bad extends View [ n: number = "bad" ]';
const ib = await bad('include [ "bad.declare" ]\nApp []', /expects a number/);
assert.equal(ib.errors[0].pos.file,'bad.declare');
assert.equal(ib.errors[0].pos.line,1);
console.log('PASS class defaults retained, classroot rewrite, use not flattened, includes merged, included-file positions (including error)');
const slider = await good('App [ gain: number = 1, s: Slider [ accessibilityLabel = "Gain", value <-> app.gain ] ]');
assert.deepEqual(slider.program.classes.map(x=>x.name),['Control','ValueControl','Slider','FocusRing']);
assert.equal(slider.program.root.children[1].tag,'FocusRing');
assert.equal(slider.program.root.children[0].methods[0].name,'commit');
assert.equal(slider.program.root.children[0].methods[0].body.trim(),'this.$root.gain = v');
const plainNoLibrary = await good('App [ View [], Text [] ]', {});
assert.deepEqual(plainNoLibrary.program.classes,[]);
await bad('App [ Slider [] ]', /unknown class/, {});
const built = await compileProgram(src, {...opts, stripPos:false});
assert.equal(built.errors.length,0,built.report);
assert.equal(built.program.trusted,true);
assert.ok(built.program.root.pos);
assert.equal(built.program.root.attrs[0].value.kind,'value');
assert.equal(c.program.root.attrs[0].value.kind,'number');
console.log('PASS plain builtins need no library classes; Slider auto-includes Control/ValueControl/Slider and provides FocusRing; compileProgram changes literals and trust');
for (const [s,re] of [
 ['App [ gain: number = "bad" ]', /expects a number/],
 ['App [ nativeSlot = 1 ]', /no attribute/],
 ['App [ Parameter [] ]', /unknown class/],
 ['App [ View [ id = "gainControl" ] ]', /no attribute/],
 ['App [ View gainControl [] ]', /members are separated/],
 ['default View [ fill = #112233 ]\nApp []', /expected/],
 ['App [ View [ onPointerDown(e) { app.width = e.x } ] ]', /payload type/],
 ['App [ Text [ text = { missing } ] ]', /cannot resolve/],
 ['App [ View [ width = { "bad" } ] ]', /computes a string/],
 ['App [ gain: number = 1, View [ onClick() { app.gain = "bad" } ] ]', /not assignable/],
 ['App [ View [ width = { root.width } ] ]', /cannot resolve/],
 ['App [ gain: number = 1, View [ width <-> app.gain ] ]', /no commit/],
]) await bad(s,re);
console.log('PASS 12 invalid syntax/type/name/binding probes rejected');
console.log(JSON.stringify({width,text,handler:control.methods[0],includedRoot:inc.program.root.pos,includedClass:inc.program.classes[0].pos,includeError:ib.errors[0].pos,sliderClasses:slider.program.classes.map(x=>x.name)},null,2));

```

Actual successful output:

```text
PASS builtins, repeatable named identity, typed state, parent/app/bare reads, dynamic text, typed handler, assignment, original single-file positions, non-enumerable program
PASS ordinary typed metadata declarations; no automatic native binding implied
PASS class defaults retained, classroot rewrite, use not flattened, includes merged, included-file positions (including error)
PASS plain builtins need no library classes; Slider auto-includes Control/ValueControl/Slider and provides FocusRing; compileProgram changes literals and trust
PASS 12 invalid syntax/type/name/binding probes rejected
{
  "width": {
    "kind": "code",
    "src": " parent.width / 2 ",
    "pos": {
      "line": 4,
      "col": 38,
      "offset": 228
    },
    "deps": [
      "parent.width"
    ],
    "expr": "L0 K2 /"
  },
  "text": {
    "kind": "code",
    "src": " \"Gain \" + this.$root.gain ",
    "pos": {
      "line": 3,
      "col": 23,
      "offset": 165
    },
    "deps": [
      "this.$root.gain"
    ]
  },
  "handler": {
    "name": "onPointerDown",
    "params": [
      {
        "name": "e",
        "type": "PointerEvent",
        "typePos": {
          "line": 5,
          "col": 19,
          "offset": 297
        }
      }
    ],
    "body": " this.$root.gain = e.x / this.width ",
    "pos": {
      "line": 5,
      "col": 2,
      "offset": 280
    },
    "bodyPos": {
      "line": 5,
      "col": 33,
      "offset": 311
    }
  },
  "includedRoot": {
    "line": 2,
    "col": 1,
    "offset": 116
  },
  "includedClass": {
    "line": 1,
    "col": 1,
    "offset": 0,
    "file": "panel.declare"
  },
  "includeError": {
    "line": 1,
    "col": 38,
    "offset": 37,
    "file": "bad.declare"
  },
  "sliderClasses": [
    "Control",
    "ValueControl",
    "Slider",
    "FocusRing"
  ]
}

```

## Limits / handoff to #6

Facts established: syntax, checked representations, limited rejection behavior, named structural identity, metadata carriage alternatives, explicit/automatic include behavior, retained defaults/class bodies, and observed position fidelity/limits. Policy still needed: accepted class/library subset, target-default values, metadata versus external binding convention, gain range/formatting and safety, interaction coordinates/events, host ownership mapping validation, reactive ordering/cycles and diagnostic translation.

Not performed: upstream rebuild/full suite, production code/configuration changes, EEL2 emission/execution, JSFX assembly, audio/performance testing, or REAPER UI/automation/resize/persistence validation. Compiler acceptance proves none of those.
