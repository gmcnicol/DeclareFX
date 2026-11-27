import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEffect } from '../src/effect.js';

const source = `App [ width = 400, height = 160, gain: number = 1,
 background: View [ width = { parent.width }, height = { parent.height }, fill = #eeeeee ],
 label: Text [ x = 12, y = 12, width = 200, height = 20, text = "Gain" ],
 gainControl: View [ x = 12, y = 48, width = { parent.width / 2 }, height = 24, fill = #557799 ]
]`;
const bindingsSource = '{"version":1,"rootState":"gain","controlPath":["gainControl"],"nativeSlot":1,"min":0,"max":2}';
const dsp = '@init\nordinary = 7;\n@block\nordinary += 1;\n@sample\nspl0 *= dfx_param_gain;\nspl1 *= dfx_param_gain;\n';
const input = { source, bindingsSource, dsp };

test('effect compiler refuses unsupported or duplicate DSP sections and non-section preambles with DSP provenance', async () => {
  for (const bad of ['@sample\nspl0=0;\n@gfx\ngfx_x=0;', '@sample\n0;\n@sample\n1;', '@block\n0;', 'slider1:1<0,2>Gain\n@sample\n0;', 'import other.eel\n@sample\n0;', '@sample extra\n0;', '@slider\n0;\n@sample\n0;', '@serialize\n0;\n@sample\n0;']) {
    const result = await buildEffect({ ...input, dsp: bad, dspFilename: 'author.dsp.eel' });
    assert.equal(result.ok, false, bad);
    assert.ok(result.diagnostics.some(d => d.code === 'DFX_DSP_SECTION' && d.location?.file === 'author.dsp.eel'), JSON.stringify(result));
    assert.equal('jsfx' in result, false);
  }
});

test('DSP rejects detectable reserved resources, alias writes/definitions and initialization-time parameter access without treating trusted EEL2 as a sandbox', async () => {
  const bodies = ['__DFX_scratch = 1;', '#__dfx_label = "x";', 'function __dfx_finite(x) (x);',
    'dfx_param_gain = 2;', '(DFX_PARAM_GAIN) *= 2;', '(1 ? dfx_param_gain : ordinary) = 0;',
    'function dfx_param_gain(x) (x);', 'function foo(dfx_param_gain) (1);',
    'function foo() local(dfx_param_gain) (1);', 'function foo() instance(__dfx_bad) (1);',
    'slider1 = 0;', '(slider1) += 1;', 'gfx_x=0;', 'gfx_setfont(0);', 'mouse_cap=0;',
    'slider_automate(1);', 'import other.eel'];
  for (const body of bodies) {
    const result = await buildEffect({ ...input, dsp: `@sample\n${body}` });
    assert.equal(result.ok, false, body);
    assert.ok(result.diagnostics.some(d => ['DFX_DSP_RESOURCE', 'DFX_DSP_SECTION'].includes(d.code)), JSON.stringify(result));
  }
  for (const body of ['slider1 = 1;', 'x = dfx_param_gain;']) {
    assert.equal((await buildEffect({ ...input, dsp: `@init\n${body}\n@sample\n0;` })).ok, false, body);
  }
  const allowed = await buildEffect({ ...input, dsp: '@init\nordinary = 1; // __dfx_ignore\n#label="__dfx_ignore";\n@block\nordinary = dfx_param_gain;\n@sample\nspl0 = dfx_param_gain * spl0;\n' });
  assert.equal(allowed.ok, true, JSON.stringify(allowed.diagnostics));
});

test('DSP scientific numeric tokens are rejected with locations while comments, quoted text and identifiers are preserved', async () => {
  for (const token of ['1e3', '2E+9', '-2.5e-5', '.25E2', '1.e3']) {
    const result = await buildEffect({ ...input, dsp: `@sample\nordinary = ${token};`, dspFilename: 'author.eel' });
    assert.equal(result.ok, false, token);
    assert.equal('jsfx' in result, false);
    const diagnostic = result.diagnostics.find(d => d.code === 'DFX_DSP_NUMBER');
    assert.equal(diagnostic?.category, 'numeric');
    assert.deepEqual(diagnostic?.location, { file: 'author.eel', line: 2, column: token.startsWith('-') ? 13 : 12 });
  }
  const author = '@sample\n// 1e-310\n/* 2E+9 */\n#label="3e8 \\" 4E2";\nletter=\'e\';\ne10 = 1; stage1e3 = 2; foo.bar1E3 = $x1e3;\nspl0 *= dfx_param_gain;\n';
  const allowed = await buildEffect({ ...input, dsp: author });
  assert.equal(allowed.ok, true, JSON.stringify(allowed.diagnostics));
  if (allowed.ok) assert.ok(allowed.jsfx.includes(author));
});

test('DSP permits init-defined helpers that read the block alias later, but diagnoses direct init reads and detectable mutating APIs', async () => {
  const author = '@init\nfunction apply(x) (x * dfx_param_gain);\nordinary = 1;\n@block\nordinary = apply(2);\n@sample\nspl0 = apply(spl0);\n';
  const good = await buildEffect({ ...input, dsp: author });
  assert.equal(good.ok, true, JSON.stringify(good.diagnostics));
  if (good.ok) assert.ok(good.jsfx.includes('function apply(x) (x * dfx_param_gain);\nordinary = 1;'));
  assert.equal((await buildEffect({ ...input, dsp: author.replace('ordinary = 1;', 'ordinary = apply(1);') })).ok, false);
  for (const body of ['assign(dfx_param_gain, 2);', 'file_var(0, dfx_param_gain);', 'file_var(0, slider1);', '#dfx_param_gain = "bad";',
    'atomic_set(dfx_param_gain, 1);', 'atomic_exch(ordinary, dfx_param_gain);', 'stack_pop(dfx_param_gain);',
    'mem_get_values(0, ordinary, dfx_param_gain);', 'match("%f", #label, dfx_param_gain);', 'slider_next_chg(0, dfx_param_gain);']) {
    const result = await buildEffect({ ...input, dsp: `@sample\n${body}` });
    assert.equal(result.ok, false, body);
    assert.ok(result.diagnostics.some(d => d.code === 'DFX_DSP_RESOURCE'));
  }
});

test('emits static viewport-driven dirty geometry, nested translations, bitmap literal text and root-clipped rectangles in source order', async () => {
  const result = await buildEffect(input);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  if (!result.ok) return;
  assert.match(result.jsfx, /@gfx 400 160/);
  assert.match(result.jsfx, /gfx_ext_retina = 1;/);
  assert.match(result.jsfx, /#__dfx_label2 = "Gain";/);
  assert.match(result.jsfx, /function __dfx_ui_refresh\(\)/);
  assert.match(result.jsfx, /__dfx_ui_first \|\| __dfx_ui_d0/);
  assert.match(result.jsfx, /__dfx_ui_next = gfx_w;/);
  assert.match(result.jsfx, /__dfx_ui_next = gfx_h;/);
  assert.match(result.jsfx, /gfx_setfont\(0\)/);
  assert.match(result.jsfx, /gfx_drawstr\(#__dfx_label2, 0,/);
  assert.ok(result.jsfx.indexOf('gfx_r = 238 / 255;') < result.jsfx.indexOf('gfx_drawstr('));
  assert.ok(result.jsfx.indexOf('gfx_drawstr(') < result.jsfx.indexOf('gfx_r = 85 / 255;'));
  assert.match(result.jsfx, /__dfx_ui_next = __dfx_ui_x0 \+ __dfx_ui_s13;\n__dfx_ui_x3 = __dfx_ui_next;/);
  assert.doesNotMatch(result.jsfx.split('@gfx')[1], /\b(?:while|loop)\s*\(|\[[^\]]*\]/);
});

test('emits relative latest-native dragging with no stationary edits and documented release/focus/idle touch completion', async () => {
  const result = await buildEffect(input);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  if (!result.ok) return;
  assert.match(result.jsfx, /options:gfx_idle/);
  assert.match(result.jsfx, /gfx_getchar\(65536\)/);
  assert.match(result.jsfx, /\(gfx_ext_flags & 2\)/);
  assert.match(result.jsfx, /\(__dfx_ui_window & 6\) === 6/);
  const frame = result.jsfx.split('@gfx')[1];
  assert.ok(frame.indexOf('__dfx_ui_refresh();') < frame.indexOf('__dfx_ui_hit ='));
  assert.match(frame, /__dfx_ui_delta !== 0/);
  assert.match(frame, /__dfx_ui_native = slider1;/);
  assert.match(frame, /__dfx_ui_edit = __dfx_ui_native \+ 2 \* __dfx_ui_delta \/ __dfx_ui_s15;/);
  assert.match(frame, /__dfx_ui_edit !== __dfx_ui_native/);
  assert.match(frame, /slider1 = __dfx_ui_edit;\nslider_automate\(1\);\n__dfx_ui_touch = 1;/);
  assert.match(frame, /__dfx_ui_touch \? \(slider_automate\(1, 1\);/);
  assert.match(frame, /!__dfx_ui_live \|\| !__dfx_ui_down_now \|\| !__dfx_ui_control_ok/);
  assert.ok(frame.indexOf('slider_automate(1);') < frame.lastIndexOf('__dfx_ui_refresh();'));
  assert.ok(frame.lastIndexOf('__dfx_ui_refresh();') < frame.indexOf('gfx_dest = -1;'));
});

test('literal labels use EEL2 escapes rather than JSON Unicode/form-feed escapes and cannot inject source', async () => {
  const text = '\u0001face\f café \\\\ end';
  const fixture = source.replace('text = "Gain"', `text = "${text}"`);
  const result = await buildEffect({ ...input, source: fixture });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  if (!result.ok) return;
  assert.match(result.jsfx, /#__dfx_label2 = "" "\\x01" "face" "\\x0c" " café \\\\ end";/);
  assert.doesNotMatch(result.jsfx, /\\u0001|\\f/);
});

test('runtime guards preserve lazy expression branches, exact comparisons, per-intermediate finiteness and separate retained geometry validity', async () => {
  const fixture = `App [ width = 400, height = 160, gain: number = 1, enabled: boolean = true,
    gainControl: View [ x = { -app.gain }, y = { +app.gain },
      width = { app.enabled && !(app.gain === 0) || app.gain !== 1 ? (parent.width * app.gain + 1) / (app.gain - 1) : 0 },
      height = { app.gain < 1 ? 10 : app.gain <= 1 ? 20 : app.gain > 1 && app.gain >= 2 ? 30 : 40 } ] ]`;
  const result = await buildEffect({ ...input, source: fixture });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  if (!result.ok) return;
  const gfx = result.jsfx.split('@gfx')[1];
  assert.match(gfx, /!__dfx_finite\(__dfx_ui_observed\) \? \(__dfx_ui_numeric_error = 1;/);
  assert.match(gfx, /_ok = __dfx_ui_t\d+_ok && \(__dfx_ui_t\d+ !== 0\)/);
  assert.match(gfx, /_ok = __dfx_ui_t\d+_ok && __dfx_finite\(__dfx_ui_t\d+\)/);
  assert.match(gfx, /__dfx_ui_t\d+ \? \(\n/);
  for (const op of ['===', '!==', '<', '<=', '>', '>=', '+', '-', '*', '/']) assert.ok(gfx.includes(` ${op} `), op);
  assert.doesNotMatch(gfx, /(?<![=!])==(?!=)|(?<!!)!=(?!=)/);
  assert.match(gfx, /__dfx_ui_ok \? \(__dfx_ui_s\d+ = __dfx_ui_next;\) : \(__dfx_ui_numeric_error = 1;/);
  assert.match(gfx, /__dfx_ui_control_ok = .*__dfx_ui_v\d+.*__dfx_ui_s\d+ > 0/);
});

test('independent arithmetic model records safe gain, block-rate stereo and latest-native relative-drag expectations, not EEL2 execution', () => {
  const safe = (gain: number) => Number.isFinite(gain) ? Math.max(0, Math.min(2, gain)) : 1;
  const edit = (native: number, delta: number, width: number) => delta === 0 || !Number.isFinite(width) || width <= 0 ? null : safe(safe(native) + 2 * delta / width);
  assert.deepEqual([NaN, Infinity, -Infinity, -2, 0, 1, 2, 3].map(safe), [1, 1, 1, 0, 0, 1, 2, 2]);
  for (const [gain, expected] of [[0, [0, -0]], [1, [0.125, -0.25]], [2, [0.25, -0.5]]] as const) {
    assert.deepEqual([0.125, -0.25].map(sample => sample * safe(gain)), expected);
  }
  assert.equal(edit(1.5, 0, 200), null); // Stationary pointer does not overwrite a host change.
  assert.equal(edit(1.5, 25, 200), 1.75); // Rebase on latest host gain, not press-time gain.
  assert.equal(edit(1.5, 200, 200), 2);
  assert.equal(edit(0.5, -200, 200), 0);
  assert.equal(edit(1, 1, 0), null);
  assert.equal(edit(1, 1, NaN), null);
});

test('nested named bound control translates through its parent and uses its own current width with root-only clipping', async () => {
  const fixture = `App [ width = 400, height = 160, gain: number = 1,
    panel: View [ x = 20, y = 30, width = { parent.width / 2 }, height = 60,
      gainControl: View [ x = -5, y = 4, width = { parent.width / 2 }, height = 20, fill = #123456 ] ] ]`;
  const result = await buildEffect({ ...input, source: fixture, bindingsSource: bindingsSource.replace('["gainControl"]', '["panel","gainControl"]') });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  if (!result.ok) return;
  const gfx = result.jsfx.split('@gfx')[1];
  assert.match(gfx, /__dfx_ui_next = __dfx_ui_x1 \+ __dfx_ui_s9;/);
  assert.match(gfx, /__dfx_ui_next = __dfx_ui_y1 \+ __dfx_ui_s10;/);
  assert.match(gfx, /mouse_x >= __dfx_ui_x2/);
  assert.match(gfx, /2 \* __dfx_ui_delta \/ __dfx_ui_s11/);
  assert.match(gfx, /mouse_x < __dfx_ui_s0 && mouse_y < __dfx_ui_s1/);
});

test('arithmetic overflow is checked before EEL2 assignment filtering can turn an invalid result into valid-looking zero', async () => {
  const result = await buildEffect({ ...input, source: source.replace('parent.width / 2', '(parent.width * 1e308) / app.gain') });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  if (!result.ok) return;
  const gfx = result.jsfx.split('@gfx')[1];
  assert.match(gfx, /_ok = .*abs\(\(__dfx_ui_t\d+ \* __dfx_ui_t\d+\)\) <= 179769313486231570{292}/);
  assert.match(gfx, /_ok = .*abs\(\(__dfx_ui_t\d+ \/ __dfx_ui_t\d+\)\) <= 179769313486231570{292}/);
  assert.match(gfx, /abs\(__dfx_ui_x0 \+ __dfx_ui_s13\) <= 179769313486231570{292}/);
  assert.match(gfx, /abs\(2 \* __dfx_ui_delta\) <= 179769313486231570{292}/);
  assert.ok(gfx.indexOf('abs(2 * __dfx_ui_delta)') < gfx.indexOf('__dfx_ui_edit = __dfx_ui_native'));
});

test('tiny literals and normal-literal tiny intermediates retain lazy branches, exact comparisons and zero-denominator guards structurally, not as host execution', async () => {
  const fixture = `App [ width = 400, height = 160, gain: number = 1,
    gainControl: View [ x = { parent.width * 1e-310 === 0 ? 1 : 2 },
      y = { 1e-150 * 1e-160 === 0 ? 1 : 2 },
      width = { 1e-310 > 0 ? 1 / 0 : 2 }, height = { 1 / (1e-200 * 1e-200) } ] ]`;
  const result = await buildEffect({ ...input, source: fixture });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  if (!result.ok) return;
  const gfx = result.jsfx.split('@gfx')[1];
  assert.ok(gfx.includes(' = 0.' + '0'.repeat(309) + '1;'));
  assert.match(gfx, /__dfx_ui_t\d+ = \(__dfx_ui_t\d+ === __dfx_ui_t\d+\);/);
  assert.match(gfx, /__dfx_ui_t\d+ \? \(\n[\s\S]*\) : \(/);
  assert.match(gfx, /_ok = __dfx_ui_t\d+_ok && \(__dfx_ui_t\d+ !== 0\) && \(abs\(\(__dfx_ui_t\d+ \/ __dfx_ui_t\d+\)\) <= 179769313486231570{292}\)/);
  assert.match(gfx, /_ok \? \(__dfx_ui_t\d+ = \(__dfx_ui_t\d+ \/ __dfx_ui_t\d+\);\);/);
  assert.match(gfx, /__dfx_ui_ok \? \(__dfx_ui_s\d+ = __dfx_ui_next;\) : \(__dfx_ui_numeric_error = 1;/);
  assert.doesNotMatch(gfx, /(?<![\w.])(?:\d+(?:\.\d*)?|\.\d+)[eE][+-]?\d+\b/);
});

test('all generated executable numbers use deterministic plain decimals, including defaults, slots, viewport and finite guards', async () => {
  const fixture = `App [ width = 1000000000000000000000, height = 0.0000001, gain: number = 0.0000001,
    huge: number = 1250000000000000000000, tiny: number = -0.${'0'.repeat(323)}5,
    gainControl: View [ x = -1250000000000000000000, y = { -1.25e-7 }, width = { app.huge + 1e-7 }, height = 2 ] ]`;
  const result = await buildEffect({ ...input, source: fixture });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  if (!result.ok) return;
  assert.match(result.jsfx, /slider1:0\.0000001<0,2,0>Gain/);
  assert.match(result.jsfx, /@gfx 1000000000000000000000 0\.0000001\n/);
  assert.match(result.jsfx, /__dfx_ui_s\d+ = 1250000000000000000000;/);
  assert.ok(result.jsfx.includes(' = -0.' + '0'.repeat(323) + '5;'));
  assert.match(result.jsfx, /__dfx_ui_t\d+ = -1250000000000000000000;/);
  assert.match(result.jsfx, /__dfx_ui_t\d+ = 0\.000000125;/);
  const maximum = '17976931348623157' + '0'.repeat(292);
  assert.ok(result.jsfx.includes(`abs(v) <= ${maximum}`));
  assert.ok(result.jsfx.includes(`) <= ${maximum}`));
  const executable = result.jsfx.replace(/\/\/[^\n]*|"(?:\\.|[^"\\])*"/g, ' ');
  assert.doesNotMatch(executable, /(?<![\w.])(?:\d+(?:\.\d*)?|\.\d+)[eE][+-]?\d+\b/);
  const repeated = await buildEffect({ ...input, source: fixture });
  assert.equal(repeated.ok && repeated.jsfx, result.jsfx);
});

test('binding JSON rejects duplicate/conflicting member declarations, including escaped spellings', async () => {
  for (const raw of [bindingsSource.replace('"nativeSlot":1', '"nativeSlot":2,"nativeSlot":1'), bindingsSource.replace('"max":2', '"max":2,"\\u006dax":2')]) {
    const result = await buildEffect({ ...input, bindingsSource: raw });
    assert.equal(result.ok, false, raw);
    assert.ok(result.diagnostics.some(d => d.category === 'binding' && d.code === 'DFX_JSON_DUPLICATE'));
  }
});

test('effect compiler emits native persistent gain and a bounded safe block snapshot before preserved author DSP', async () => {
  const result = await buildEffect(input);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  if (!result.ok) return;
  assert.match(result.jsfx, /slider1:1<0,2,0>Gain/);
  assert.match(result.jsfx, /@init\n[\s\S]*ordinary = 7;/);
  assert.match(result.jsfx, /@block\n__dfx_audio_gain = slider1;\ndfx_param_gain = __dfx_finite\(__dfx_audio_gain\) \? min\(2, max\(0, __dfx_audio_gain\)\) : 1;\nordinary \+= 1;/);
  assert.match(result.jsfx, /@sample\nspl0 \*= dfx_param_gain;\nspl1 \*= dfx_param_gain;\n/);
  const audio = result.jsfx.split('@block\n')[1].split('@gfx')[0];
  assert.doesNotMatch(audio, /gfx_|__dfx_ui_|\[|\b(?:loop|while|import)\b/);
  assert.doesNotMatch(result.jsfx, /@serialize|@slider/);
  assert.doesNotMatch(result.jsfx.split('@gfx')[0], /slider1\s*=/);
});
