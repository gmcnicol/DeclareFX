import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { buildEffect, compilerVersion } from '../src/effect.js';

const files = ['gain.declare', 'gain.bindings.json', 'gain.dsp.eel'] as const;

test('complete gain example matches reviewed UTF-8/LF golden bytes, deterministic provenance and standalone audio structure', async () => {
  const [source, bindingsSource, dsp] = await Promise.all(files.map(file => readFile(`examples/${file}`, 'utf8')));
  const input = { source, bindingsSource, dsp };
  const result = await buildEffect(input);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  if (!result.ok) return;
  const golden = await readFile('examples/gain.jsfx');
  assert.deepEqual(Buffer.from(result.jsfx), golden);
  assert.equal(Buffer.from(golden.toString('utf8')).equals(golden), true);
  assert.equal(golden.includes(13), false);
  assert.match(result.jsfx, /^\/\/ compiler: declarefx 0\.1\.0; subset: 1$/m);
  assert.match(result.jsfx, /^\/\/ upstream: cc62d9dfa0b39f84e20480ff28bed8107d986331$/m);
  assert.equal(JSON.parse(await readFile('package.json', 'utf8')).version, compilerVersion);
  assert.doesNotMatch(result.jsfx, /\bimport\b|require\(|https?:|declare-compiler|Date\(|timestamp|\/home\//);
  const audio = result.jsfx.split('@block\n')[1].split('@gfx')[0];
  assert.doesNotMatch(audio, /__dfx_ui_|gfx_|\[|\b(?:while|loop|malloc|freembuf)\s*\(/);
  assert.match(audio, /dfx_param_gain[\s\S]*@sample\nspl0 \*= dfx_param_gain;\nspl1 \*= dfx_param_gain;/);
  const relocated = await buildEffect({ ...input, filename: '/different/checkout/ui.declare', dspFilename: 'C:\\other\\gain.dsp.eel' });
  assert.equal(relocated.ok && relocated.jsfx, result.jsfx);
  for (const field of ['source', 'bindingsSource', 'dsp'] as const) {
    const changed = await buildEffect({ ...input, [field]: input[field] + '\n' });
    assert.equal(changed.ok, true, JSON.stringify(changed.diagnostics));
    if (changed.ok) assert.notEqual(changed.jsfx.match(/inputs-sha256: (\w+)/)?.[1], result.jsfx.match(/inputs-sha256: (\w+)/)?.[1], field);
  }
  const crlf = await buildEffect({ ...input, dsp: dsp.replace(/\n/g, '\r\n') });
  assert.equal(crlf.ok, true);
  if (crlf.ok) assert.equal(crlf.jsfx.includes('\r'), false);
});

test('real CLI copies in distinct checkout directories emit identical complete golden bytes without runtime imports', async t => {
  const root = await mkdtemp(join(tmpdir(), 'declarefx-checkouts-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const expected = await readFile('examples/gain.jsfx');
  for (const name of ['checkout-one', 'different path checkout-two']) {
    const cwd = join(root, name);
    await mkdir(cwd);
    for (const path of ['dist/src', 'vendor', 'examples', 'package.json']) await cp(resolve(path), join(cwd, path), { recursive: true });
    await cp(resolve('node_modules/typescript'), join(cwd, 'node_modules/typescript'), { recursive: true, dereference: true });
    const argv = ['dist/src/cli.js', 'build', 'examples/gain.declare', '--bindings', 'examples/gain.bindings.json', '--dsp', 'examples/gain.dsp.eel', '--out', 'built.jsfx'];
    const result = spawnSync(process.execPath, argv, { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(await readFile(join(cwd, 'built.jsfx')), expected);
  }
});
