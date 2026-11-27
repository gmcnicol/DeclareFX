import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { link, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const cli = resolve('dist/src/cli.js');
const source = 'App [ width = 400, height = 160, gain: number = 1, gainControl: View [ width = { parent.width / 2 }, height = 24 ] ]\n';
const bindings = '{"version":1,"rootState":"gain","controlPath":["gainControl"],"nativeSlot":1,"min":0,"max":2}\n';
const dsp = '@sample\nspl0 *= dfx_param_gain;\nspl1 *= dfx_param_gain;\n';
const args = ['build', 'ui.declare', '--bindings', 'gain.bindings.json', '--dsp', 'gain.dsp.eel', '--out', 'gain.jsfx'];
const run = (cwd: string, argv = args) => spawnSync(process.execPath, [cli, ...argv], { cwd, encoding: 'utf8' });
// Only the subprocess filesystem boundary is faulted; compilation and publication stay real.
async function runWithRenameFailures(cwd: string, failures: string[] | string, changedOutput?: string) {
  const preload = join(cwd, 'rename-fault.cjs');
  await writeFile(preload, `
const fs = require('node:fs/promises');
const { syncBuiltinESMExports } = require('node:module');
const rename = fs.rename;
const failures = ${JSON.stringify(failures)};
let changedOutput = ${JSON.stringify(changedOutput)};
fs.rename = async (...paths) => {
  const code = typeof failures === 'string' ? failures : failures.shift();
  if (code) {
    if (changedOutput !== undefined) { await fs.writeFile(paths[1], changedOutput); changedOutput = undefined; }
    throw Object.assign(new Error(code + ': injected publication rename failure'), { code });
  }
  return rename(...paths);
};
syncBuiltinESMExports();
`);
  return spawnSync(process.execPath, ['--require', preload, cli, ...args], { cwd, encoding: 'utf8', timeout: 15_000 });
}
async function fixture(t: { after(fn: () => Promise<void>): void }): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'declarefx-cli-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await Promise.all([writeFile(join(cwd, 'ui.declare'), source), writeFile(join(cwd, 'gain.bindings.json'), bindings), writeFile(join(cwd, 'gain.dsp.eel'), dsp)]);
  return cwd;
}

test('CLI validation and I/O failures preserve previous output and report source/binding/DSP context', async t => {
  const cwd = await fixture(t);
  assert.equal(run(cwd).status, 0);
  const before = await readFile(join(cwd, 'gain.jsfx'));
  const failures: [string, string | Buffer, RegExp][] = [
    ['ui.declare', source.replace('parent.width / 2', 'parent.width % 2'), /ui\.declare:1:\d+: error \[unsupported\//],
    ['gain.bindings.json', '{bad', /gain\.bindings\.json:1:1: error \[binding\/DFX_JSON\]/],
    ['gain.bindings.json', bindings.replace('"version":1', '"version":2'), /bindings.version: error \[binding\//],
    ['gain.bindings.json', bindings.replace('"min":0', '"min":0,"other":true'), /bindings.other: error \[binding\//],
    ['gain.dsp.eel', '@gfx\n0;', /gain\.dsp\.eel:1:1: error \[unsupported\/DFX_DSP_SECTION\]/],
    ['gain.dsp.eel', '@sample\n__dfx_bad=1;', /gain\.dsp\.eel:2:1: error \[resource\/DFX_DSP_RESOURCE\]/],
    ['gain.dsp.eel', '@sample\nspl0 *= 1e-3;', /gain\.dsp\.eel:2:9: error \[numeric\/DFX_DSP_NUMBER\]/],
    ['ui.declare', Buffer.from([0xff]), /DFX_UTF8.*ui\.declare/],
  ];
  for (const [file, contents, expected] of failures) {
    await writeFile(join(cwd, file), contents);
    const result = run(cwd);
    assert.notEqual(result.status, 0, file);
    assert.match(result.stderr, expected);
    assert.deepEqual(await readFile(join(cwd, 'gain.jsfx')), before);
    await writeFile(join(cwd, file), file === 'ui.declare' ? source : file.endsWith('.json') ? bindings : dsp);
  }
  await rm(join(cwd, 'gain.dsp.eel'));
  assert.match(run(cwd).stderr, /gain\.dsp\.eel/);
  assert.deepEqual(await readFile(join(cwd, 'gain.jsfx')), before);
  assert.deepEqual((await readdir(cwd)).filter(file => file.endsWith('.tmp')), []);
});

test('CLI refuses direct, hard-linked and resolved-parent input/output aliases and unmarked destinations', async t => {
  const cwd = await fixture(t);
  for (const file of ['ui.declare', 'gain.bindings.json', 'gain.dsp.eel']) {
    const bytes = await readFile(join(cwd, file));
    const result = run(cwd, [...args.slice(0, -1), file]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /DFX_ALIAS/);
    assert.deepEqual(await readFile(join(cwd, file)), bytes);
  }
  await link(join(cwd, 'ui.declare'), join(cwd, 'gain.jsfx'));
  assert.match(run(cwd).stderr, /DFX_ALIAS/);
  await rm(join(cwd, 'gain.jsfx'));
  await symlink(cwd, join(cwd, 'alias'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.match(run(cwd, [...args.slice(0, -1), 'alias/ui.declare']).stderr, /DFX_ALIAS/);
  const unmarked = 'desc:Hand-written effect\n@sample\nspl0=0;\n';
  await writeFile(join(cwd, 'gain.jsfx'), unmarked);
  assert.match(run(cwd).stderr, /DFX_UNMARKED/);
  assert.equal(await readFile(join(cwd, 'gain.jsfx'), 'utf8'), unmarked);
  assert.deepEqual((await readdir(cwd)).filter(file => file.endsWith('.tmp')), []);
});

test('successful replacement is atomically visible to concurrent readers and leaves author files and no staging files behind', async t => {
  const cwd = await fixture(t);
  assert.equal(run(cwd).status, 0);
  const previous = await readFile(join(cwd, 'gain.jsfx'), 'utf8');
  const author = '@sample\n/*' + 'preserved author DSP '.repeat(50_000) + '*/\nspl0 *= dfx_param_gain;\nspl1 *= dfx_param_gain;\n';
  await writeFile(join(cwd, 'gain.dsp.eel'), author);
  const child = spawn(process.execPath, [cli, ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', bytes => { stderr += bytes; });
  let done = false;
  const exited = new Promise<number | null>((resolve, reject) => { child.once('error', error => { done = true; reject(error); }); child.once('close', code => { done = true; resolve(code); }); });
  const observed = new Set([previous]);
  while (!done) observed.add(await readFile(join(cwd, 'gain.jsfx'), 'utf8'));
  assert.equal(await exited, 0, stderr);
  const next = await readFile(join(cwd, 'gain.jsfx'), 'utf8');
  assert.notEqual(next, previous);
  assert.ok(next.includes(author.slice('@sample\n'.length)));
  for (const bytes of observed) assert.ok(bytes === previous || bytes === next, 'Reader saw partial publication');
  assert.equal(await readFile(join(cwd, 'ui.declare'), 'utf8'), source);
  assert.equal(await readFile(join(cwd, 'gain.bindings.json'), 'utf8'), bindings);
  assert.equal(await readFile(join(cwd, 'gain.dsp.eel'), 'utf8'), author);
  assert.deepEqual((await readdir(cwd)).filter(file => file.endsWith('.tmp')), []);
  const failure = run(cwd, [...args.slice(0, -1), 'missing-parent/output.jsfx']);
  assert.notEqual(failure.status, 0);
  assert.deepEqual(await readFile(join(cwd, 'gain.jsfx'), 'utf8'), next);
});

test('CLI publishes complete replacement after transient filesystem rename denials', async t => {
  const cwd = await fixture(t);
  assert.equal(run(cwd).status, 0);
  const previous = await readFile(join(cwd, 'gain.jsfx'));
  const nextSource = source.replace('width = 400', 'width = 480');
  await writeFile(join(cwd, 'ui.declare'), nextSource);
  assert.equal(run(cwd, [...args.slice(0, -1), 'expected.jsfx']).status, 0);
  const expected = await readFile(join(cwd, 'expected.jsfx'));
  assert.notDeepEqual(expected, previous);

  const result = await runWithRenameFailures(cwd, ['EPERM', 'EBUSY', 'EACCES', 'EPERM', 'EBUSY']);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(await readFile(join(cwd, 'gain.jsfx')), expected);
  assert.equal(await readFile(join(cwd, 'ui.declare'), 'utf8'), nextSource);
  assert.equal(await readFile(join(cwd, 'gain.bindings.json'), 'utf8'), bindings);
  assert.equal(await readFile(join(cwd, 'gain.dsp.eel'), 'utf8'), dsp);
  assert.deepEqual((await readdir(cwd)).filter(file => file.endsWith('.tmp')), []);
});

test('CLI bounds persistent rename denials and does not retry unrelated I/O failures', async t => {
  const cwd = await fixture(t);
  assert.equal(run(cwd).status, 0);
  const previous = await readFile(join(cwd, 'gain.jsfx'));
  const nextSource = source.replace('width = 400', 'width = 480');
  await writeFile(join(cwd, 'ui.declare'), nextSource);
  for (const code of ['EPERM', 'EBUSY', 'EACCES', 'EIO']) {
    // EIO occurs once, then rename would work: it must fail rather than retry.
    const result = await runWithRenameFailures(cwd, code === 'EIO' ? [code] : code);
    assert.equal(result.error, undefined, 'CLI must exit itself, not be killed by the test timeout');
    assert.equal(result.signal, null);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, new RegExp(`\\[io/DFX_IO\\].*${code}: injected publication rename failure`));
    if (code !== 'EIO') assert.match(result.stderr, /Atomic replacement failed after 6 attempts/);
    assert.deepEqual(await readFile(join(cwd, 'gain.jsfx')), previous);
    assert.deepEqual((await readdir(cwd)).filter(file => file.endsWith('.tmp')), []);
  }
  assert.equal(await readFile(join(cwd, 'ui.declare'), 'utf8'), nextSource);
  assert.equal(await readFile(join(cwd, 'gain.bindings.json'), 'utf8'), bindings);
  assert.equal(await readFile(join(cwd, 'gain.dsp.eel'), 'utf8'), dsp);
});

test('CLI rechecks output ownership and content after a transient rename denial', async t => {
  const cwd = await fixture(t);
  assert.equal(run(cwd).status, 0);
  const previous = await readFile(join(cwd, 'gain.jsfx'), 'utf8');
  for (const [changed, diagnostic] of [
    [previous + '// concurrent marked-output edit\n', /DFX_CHANGED/],
    ['desc:Hand-written effect\n@sample\nspl0=0;\n', /DFX_UNMARKED/],
  ] as const) {
    await writeFile(join(cwd, 'gain.jsfx'), previous);
    const result = await runWithRenameFailures(cwd, ['EPERM'], changed);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, diagnostic);
    assert.equal(await readFile(join(cwd, 'gain.jsfx'), 'utf8'), changed);
    assert.deepEqual((await readdir(cwd)).filter(file => file.endsWith('.tmp')), []);
  }
});

test('CLI emits decimal defaults and guarded native-underflow expressions without exponent numeric tokens', async t => {
  const cwd = await fixture(t);
  await writeFile(join(cwd, 'ui.declare'), source.replace('gain: number = 1', 'gain: number = 0.0000001')
    .replace('parent.width / 2', '1e-310 > 0 ? 1 / (1e-200 * 1e-200) : 2'));
  const result = run(cwd);
  assert.equal(result.status, 0, result.stderr);
  const output = await readFile(join(cwd, 'gain.jsfx'), 'utf8');
  assert.match(output, /slider1:0\.0000001<0,2,0>/);
  assert.match(output, /&& \(__dfx_ui_t\d+ !== 0\)/);
  assert.doesNotMatch(output.replace(/\/\/[^\n]*/g, ''), /(?<![\w.])(?:\d+(?:\.\d*)?|\.\d+)[eE][+-]?\d+\b/);
});

test('explicit CLI builds standalone output relative to invocation cwd and exposes only help/version/build', async t => {
  const cwd = await fixture(t);
  assert.equal(run(cwd, ['--help']).status, 0);
  assert.match(run(cwd, ['--help']).stdout, /declarefx build .*--bindings .*--dsp .*--out/);
  assert.equal(run(cwd, ['--version']).stdout, '0.1.0\n');
  for (const bad of [[], ['watch'], [...args, '--unknown'], [...args, '--out', 'other.jsfx'], ['--help', 'extra'], args.slice(0, -2)]) {
    const result = run(cwd, bad);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /DFX_CLI/);
  }
  const result = run(cwd);
  assert.equal(result.status, 0, result.stderr);
  const output = await readFile(join(cwd, 'gain.jsfx'), 'utf8');
  assert.match(output, /^\/\/ DeclareFX generated output v1; edits are disposable\.\n/);
  assert.match(output, /@gfx 400 160/);
  assert.match(output, /@sample\nspl0 \*= dfx_param_gain;/);
  assert.equal(run(cwd).status, 0);
  assert.equal(await readFile(join(cwd, 'gain.jsfx'), 'utf8'), output);
});
