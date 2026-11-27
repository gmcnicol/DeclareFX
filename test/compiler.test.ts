import assert from 'node:assert/strict';
import test from 'node:test';
import { compile } from '../src/compiler.js';

const bindings = { version: 1, rootState: 'gain', controlPath: ['gainControl'], nativeSlot: 1, min: 0, max: 2 };
const source = `App [ width = 400, height = 160, gain: number = 1,
 background: View [ width = { parent.width }, height = { parent.height }, fill = #eeeeee ],
 label: Text [ x = 12, y = 12, width = 200, height = 20, text = "Gain" ],
 gainControl: View [ x = 12, y = 48, width = { parent.width / 2 }, height = 24, fill = #557799 ]
]`;

const minimal = (body = '') => `App [ width = 400, height = 160, gain: number = 1, gainControl: View [ ${body} ] ]`;

test('compiler rejects unsupported composition and every authored body without loading or executing them', async () => {
  const fixtures = [
    `include ["does-not-exist.declare"] ${minimal()}`,
    `${minimal()} include []`,
    `script ["does-not-exist.ts"] ${minimal()}`,
    `script { globalThis.__declarefxExecuted = true; } ${minimal()}`,
    `${minimal()} script { throw new Error("must not run"); }`,
    `class Unused extends View [ evil() { throw new Error("must not run"); } ] ${minimal()}`,
    `theme Unused [ ] ${minimal()}`,
    `style Unused [ ] ${minimal()}`,
    `font Unused [ ] ${minimal()}`,
    `use [ View ] ${minimal()}`,
    `defaultFlags [ lint = false ] ${minimal()}`,
    minimal('onClick() { app.gain = 2 }'),
    minimal('onClik() { }'),
    minimal('opacity = 0.5'),
    minimal('nested: View [ local: number = 1 ]'),
    minimal('nested: Slider [ ]'),
    minimal('nested: App [ ]'),
    minimal('nested: Text [ child: View [ ] ]'),
    minimal('exists = true'),
    minimal('width = 50%'),
  ];
  for (const fixture of fixtures) {
    const result = await compile({ source: fixture, bindings });
    assert.equal(result.ok, false, fixture);
    assert.ok(result.diagnostics.some(d => d.category === 'unsupported'), JSON.stringify(result));
    assert.equal('program' in result, false);
  }
  assert.equal(Reflect.get(globalThis, '__declarefxExecuted'), undefined);
});

test('compiler validates the strict v1 binding and resolves named nested control identities', async () => {
  for (const value of [null, [], {}, { ...bindings, extra: 1 }, { ...bindings, default: 1 },
    { ...bindings, version: 2 }, { ...bindings, nativeSlot: 2 }, { ...bindings, min: -1 },
    { ...bindings, max: 3 }, { ...bindings, rootState: 'other' }, { ...bindings, controlPath: [] },
    { ...bindings, controlPath: [0] }, { ...bindings, controlPath: ['missing'] },
    { ...bindings, nativeSlot: '1' }, { ...bindings, max: Infinity },
  ]) {
    const result = await compile({ source: minimal(), bindings: value });
    assert.equal(result.ok, false, JSON.stringify(value));
    assert.ok(result.diagnostics.some(d => d.category === 'binding' && d.field));
  }
  for (const ui of [
    minimal().replace('gain: number = 1,', ''),
    minimal().replace('gain: number = 1', 'gain: boolean = true'),
    minimal().replace('gain: number = 1', 'readonly gain: number = 1'),
    minimal().replace('gain: number = 1', 'gain: number = 3'),
    minimal().replace('gainControl: View', 'gainControl: Text'),
    minimal().replace('gainControl: View', 'gainControl: View [ ], gainControl: View'),
  ]) {
    const result = await compile({ source: ui, bindings });
    assert.equal(result.ok, false, ui);
    assert.ok(result.diagnostics.some(d => d.category === 'binding'), JSON.stringify(result));
  }
  const nested = await compile({
    source: 'App [ width=10, height=20, gain:number=0.5, group:View [ knob:View [] ] ]',
    bindings: { ...bindings, controlPath: ['group', 'knob'] },
  });
  assert.equal(nested.ok, true, JSON.stringify(nested));
  if (nested.ok) {
    assert.equal(nested.program.binding.control, 2);
    assert.equal(nested.program.binding.default, 0.5);
    assert.deepEqual(nested.program.nodes[2].geometry, { x: 9, y: 10, width: 11, height: 12 });
    assert.equal(nested.program.nodes[2].fill, undefined);
  }
});

test('compiler enforces literal state, initial size, text and reserved-resource contracts', async () => {
  const invalid: [string, string][] = [
    [minimal().replace('width = 400', 'width = 0'), 'numeric'],
    [minimal().replace('height = 160', 'height = -1'), 'numeric'],
    [minimal().replace('width = 400', 'width = { 400 }'), 'numeric'],
    [minimal('width = -1'), 'numeric'],
    [minimal('height = -1'), 'numeric'],
    [minimal().replace('gain: number = 1', 'gain: number = 1, k: number'), 'type'],
    [minimal().replace('gain: number = 1', 'gain: number = 1, k: number = { 2 }'), 'type'],
    [minimal().replace('gain: number = 1', 'gain: number = 1, title: string = "x"'), 'type'],
    [minimal().replace('gain: number = 1', 'gain: number = 1, __DFX_temp: number = 2'), 'resource'],
    [minimal().replace('gainControl:', '__DfX_control:'), 'resource'],
    [minimal().replace('gain: number = 1', 'gain: number = 1, DFX_PARAM_GAIN: number = 2'), 'resource'],
    [minimal('fill = #123'), 'unsupported'],
    [minimal('fill = "#123456"'), 'unsupported'],
    [minimal('nested: Text [ text = { "dynamic" } ]'), 'unsupported'],
    [minimal('nested: Text [ text = "a\\nline" ]'), 'text'],
    [minimal('nested: Text [ text = "a\u0000b" ]'), 'text'],
    [minimal(`nested: Text [ text = "${'é'.repeat(513)}" ]`), 'text'],
    [minimal('nested: Text [ text = "\ud800" ]'), 'text'],
  ];
  for (const [ui, category] of invalid) {
    const result = await compile({ source: ui, bindings });
    assert.equal(result.ok, false, ui);
    assert.ok(result.diagnostics.some(d => d.category === category), JSON.stringify(result));
  }
  const result = await compile({ source: minimal(`x = -20, label: Text [ text = "${'é'.repeat(512)}" ], empty: Text []`), bindings });
  assert.equal(result.ok, true, JSON.stringify(result));
  if (result.ok) {
    assert.equal(result.program.nodes[3].text, '');
    assert.equal(result.program.slots[result.program.nodes[1].geometry.x].nonNegative, false);
    assert.equal(result.program.nodes[2].text, 'é'.repeat(512));
  }
});

test('compiler lowers every allowed scalar operator and binds immutable, native and geometry reads', async () => {
  const expressions = [
    '+app.gain', '-app.gain', '(app.gain + 2) * 3 - 1', 'app.gain / 2',
    'app.gain < 1 ? 10 : 20', 'app.gain <= 1 ? 10 : 20',
    'app.gain > 1 ? 10 : 20', 'app.gain >= 1 ? 10 : 20',
    'app.gain === 1 ? 10 : 20', 'app.gain !== 1 ? 10 : 20',
    'app.enabled && !false || true ? this.height : parent.width',
    'app.enabled === true ? app.k : app.width',
    'app.enabled !== false ? this.$root.gain : parent.height',
    'gain + k', 'App.width / 2',
  ];
  for (const expression of expressions) {
    const result = await compile({ source: minimal(`x = { ${expression} }, height = 20`).replace('gain: number = 1', 'gain: number = 1, enabled: boolean = true, k: number = 7'), bindings });
    assert.equal(result.ok, true, `${expression}: ${JSON.stringify(result)}`);
    if (!result.ok) continue;
    assert.ok(result.program.slots.every(s => s.dependencies.every(d => Number.isInteger(d) && d >= 0)));
    assert.ok(result.program.slots.some(s => s.type === 'boolean' && s.initial === true));
  }
  const result = await compile({ source: minimal('x = { this.height + app.gain }, height = { parent.width / 2 }'), bindings });
  assert.equal(result.ok, true, JSON.stringify(result));
  if (result.ok) {
    const p = result.program;
    const x = p.nodes[1].geometry.x;
    const height = p.nodes[1].geometry.height;
    assert.deepEqual(p.slots[x].dependencies, [height, p.binding.stateSlot]);
    assert.ok(p.order.indexOf(height) < p.order.indexOf(x));
  }
});

test('compiler rejects invalid ASTs, types, references and dependency cycles with original locations', async () => {
  const invalid: [string, string][] = [
    ['this.height % 2', 'unsupported'], ['this.height == 2 ? 1 : 0', 'unsupported'],
    ['this.height != 2 ? 1 : 0', 'unsupported'], ['this.height ** 2', 'unsupported'],
    ['this.height & 2', 'unsupported'], ['this.height << 2', 'unsupported'],
    ['Math.abs(this.height)', 'unsupported'], ['(() => 1)()', 'unsupported'],
    ['new Number(1).valueOf()', 'unsupported'], ['(this.height = 1)', 'unsupported'],
    ['this["height"]', 'unsupported'], ['[1, 2][0]', 'unsupported'],
    ['this.height as number', 'unsupported'], ['this?.height', 'reference'],
    ['true', 'type'], ['true + 1', 'type'], ['1 && 2', 'type'],
    ['true ? 1 : false', 'type'], ['app.gain === true ? 1 : 0', 'type'],
    ['missing', 'reference'], ['app.missing', 'reference'],
    ['this.parent.width', 'reference'], ['this.$root.x', 'reference'],
    ['this.width', 'cycle'],
  ];
  for (const [expression, category] of invalid) {
    const result = await compile({ source: minimal(`width = { ${expression} }`), bindings, filename: 'invalid.declare' });
    assert.equal(result.ok, false, expression);
    assert.ok(result.diagnostics.some(d => d.category === category && d.location?.file === 'invalid.declare'), `${expression}: ${JSON.stringify(result)}`);
  }
  const ui = minimal('x = { gain },\n width = { this.height }, height = { this.width }');
  const result = await compile({ source: ui, bindings, filename: 'original.declare' });
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some(d => d.category === 'cycle' && d.location?.line === 2));
  const unsupported = await compile({ source: minimal('x = { gain }, width = { this.height % 2 }'), bindings, filename: 'original.declare' });
  const brace = minimal('x = { gain }, width = { this.height % 2 }').indexOf('{ this.height');
  assert.deepEqual(unsupported.diagnostics.find(d => d.category === 'unsupported')?.location, { file: 'original.declare', line: 1, column: brace + 1 });
});

test('compiler rejects statically invalid arithmetic and preserves lazy finite-evaluation policy in the target', async () => {
  for (const expression of ['1 / 0', 'app.gain / 0', '0 / 0', '1e308 * 1e308', '1e309', 'NaN', 'Infinity', '-(1e308 * 1e308)', '-1']) {
    const result = await compile({ source: minimal(`width = { ${expression} }`), bindings });
    assert.equal(result.ok, false, expression);
    assert.ok(result.diagnostics.some(d => d.category === 'numeric'), `${expression}: ${JSON.stringify(result)}`);
  }
  for (const expression of [
    'false ? 1 / 0 : 2', 'true ? 2 : 1 / 0',
    '(false && (1 / 0 > 0)) ? 1 : 2', '(true || (1 / 0 > 0)) ? 2 : 1',
    'app.gain !== 0 ? parent.width / app.gain : 0',
  ]) {
    const result = await compile({ source: minimal(`width = { ${expression} }`), bindings });
    assert.equal(result.ok, true, `${expression}: ${JSON.stringify(result)}`);
    if (!result.ok) continue;
    const slot = result.program.slots[result.program.nodes[1].geometry.width];
    assert.equal(slot.invalid, 'retain');
    assert.equal(slot.initial, 0);
    assert.equal(slot.nonNegative, true);
    assert.equal(result.program.slots[result.program.binding.stateSlot].invalid, 'safeGain');
    assert.equal(result.program.slots[result.program.binding.stateSlot].initial, 1);
  }
  const constant = await compile({ source: minimal('width = { app.k / app.zero }').replace('gain: number = 1', 'gain: number = 1, k:number=2, zero:number=0'), bindings });
  assert.equal(constant.ok, false);
  assert.ok(constant.diagnostics.some(d => d.category === 'numeric'));
});

test('compiler keeps upstream warnings, rejects erased syntax and reports trailing directive provenance', async () => {
  const warned = await compile({ source: minimal('width = { Date.now() }'), bindings, filename: 'warning.declare' });
  assert.equal(warned.ok, false);
  assert.ok(warned.diagnostics.some(d => d.severity === 'warning' && d.code === 'DECLARE4007' && d.location?.file === 'warning.declare'));
  assert.ok(warned.diagnostics.some(d => d.category === 'unsupported'));
  for (const expression of ['this.height!', 'this.height satisfies number', '<number>this.height', '(1, 2)', 'this.height++']) {
    const result = await compile({ source: minimal(`width = { ${expression} }`), bindings });
    assert.equal(result.ok, false, expression);
  }
  for (const directive of ['include []', 'script ["missing.ts"]', 'script { throw new Error("not executed"); }']) {
    const result = await compile({ source: `${minimal()}\n${directive}`, bindings, filename: 'trailing.declare' });
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.some(d => d.category === 'unsupported' && d.location?.line === 2 && d.location.column === 1), JSON.stringify(result));
  }
  const malformed = await compile({ source: 'App [', bindings, filename: 'syntax.declare' });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.diagnostics[0].location?.file, 'syntax.declare');
});

test('compiler requires own binding fields rather than prototype-supplied identities', async () => {
  const result = await compile({ source: minimal(), bindings: Object.create(bindings) });
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some(d => d.category === 'binding' && d.field === 'version'));
});

test('compiler cannot accept parser-only success when the checked frontend rejects an unused duplicate member', async () => {
  const result = await compile({ source: minimal().replace('gainControl:', 'unused: View [ ], unused: View [ ], gainControl:'), bindings, filename: 'checked.declare' });
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some(d => /members share one namespace/.test(d.message) && d.location?.file === 'checked.declare'));
});

test('compiler preserves arithmetic precedence, short circuit and exact comparison operators in target expressions', async () => {
  const result = await compile({ source: minimal('x = { !false && app.gain !== 0 ? 1 + 2 * 3 : -4 }'), bindings });
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) return;
  assert.deepEqual(result.program.slots[result.program.nodes[1].geometry.x].expression, {
    kind: 'conditional', type: 'number',
    condition: { kind: 'binary', type: 'boolean', op: '&&',
      left: { kind: 'unary', type: 'boolean', op: '!', operand: { kind: 'literal', type: 'boolean', value: false } },
      right: { kind: 'binary', type: 'boolean', op: '!==', left: { kind: 'read', type: 'number', slot: 2 }, right: { kind: 'literal', type: 'number', value: 0 } },
    },
    then: { kind: 'binary', type: 'number', op: '+', left: { kind: 'literal', type: 'number', value: 1 },
      right: { kind: 'binary', type: 'number', op: '*', left: { kind: 'literal', type: 'number', value: 2 }, right: { kind: 'literal', type: 'number', value: 3 } },
    },
    else: { kind: 'unary', type: 'number', op: '-', operand: { kind: 'literal', type: 'number', value: 4 } },
  });
});

test('compiler applies nonnegative size safety to live viewport inputs as well as child sizes', async () => {
  const result = await compile({ source: minimal(), bindings });
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) return;
  const p = result.program;
  for (const key of ['width', 'height'] as const) {
    const slot = p.slots[p.nodes[0].geometry[key]];
    assert.equal(slot.input, key === 'width' ? 'viewportWidth' : 'viewportHeight');
    assert.equal(slot.nonNegative, true);
    assert.equal(slot.initial, 0);
    assert.equal(slot.invalid, 'retain');
  }
});

test('compiler rejects malformed JSON binding segments before attempting name resolution or coercion', async () => {
  const value = JSON.parse('{"version":1,"rootState":"gain","controlPath":[{"toString":"not callable"}],"nativeSlot":1,"min":0,"max":2}');
  const result = await compile({ source: minimal(), bindings: value });
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some(d => d.category === 'binding' && d.field === 'controlPath'));
});

test('compiler lowers the complete literal-label example to static target slots without upstream objects', async () => {
  const result = await compile({ source, bindings, filename: 'gain.declare' });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  if (!result.ok) return;
  const p = result.program;
  assert.deepEqual(p.initialSize, { width: 400, height: 160 });
  assert.deepEqual(p.nodes.map(n => [n.kind, n.name, n.parent]), [
    ['App', null, null], ['View', 'background', 0], ['Text', 'label', 0], ['View', 'gainControl', 0],
  ]);
  assert.equal(p.nodes[1].fill, '#eeeeee');
  assert.equal(p.nodes[2].text, 'Gain');
  assert.equal(p.binding.control, 3);
  assert.equal(p.binding.default, 1);
  const width = p.slots[p.nodes[3].geometry.width];
  assert.deepEqual(width.expression, {
    kind: 'binary', op: '/', type: 'number', left: { kind: 'read', slot: 0, type: 'number' },
    right: { kind: 'literal', value: 2, type: 'number' },
  });
  assert.deepEqual(width.dependencies, [0]);
  assert.equal(width.invalid, 'retain');
  assert.equal(width.initial, 0);
  assert.equal(width.nonNegative, true);
  assert.ok(p.order.indexOf(0) < p.order.indexOf(width.id));
  assert.equal('classes' in p, false);
  assert.deepEqual((await compile({ source, bindings, filename: 'gain.declare' })), result);
});
