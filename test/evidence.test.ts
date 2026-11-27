import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const script = resolve('scripts/evidence.mjs');
const inputs = ['src', 'test', 'examples', 'vendor', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', 'LICENSE', 'THIRD_PARTY_NOTICES.md'];
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

test('evidence command preserves actual tools, input hashes, clean relocated builds and complete golden bytes', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'declarefx-evidence-test-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  for (const path of inputs) await cp(path, join(cwd, path), { recursive: true });
  const run = spawnSync(process.execPath, [script], { cwd, encoding: 'utf8', timeout: 180_000 });
  assert.equal(run.status, 0, run.stderr + run.stdout);
  const out = join(cwd, 'proof-evidence/reproducibility');
  const report = JSON.parse(await readFile(join(out, 'result.json'), 'utf8'));
  assert.equal(report.status, 'passed');
  assert.equal(report.environment.node, process.version);
  assert.equal(report.environment.platform, process.platform);
  assert.equal(report.environment.arch, process.arch);
  assert.equal(report.environment.pnpm, '12.23.0');
  assert.equal(report.environment.typescript, '5.9.3');
  assert.deepEqual(report.commands.map((command: { status: number }) => command.status), [0, 0, 0, 0, 0, 0]);
  assert.notEqual(report.commands[0].directory, report.commands[3].directory);
  const golden = await readFile('examples/gain.jsfx');
  for (const name of ['gain-1.jsfx', 'gain-2.jsfx']) assert.deepEqual(await readFile(join(out, name)), golden);
  assert.equal(report.goldenSha256, hash(golden));
  const inputHashes = JSON.parse(await readFile(join(out, 'inputs.json'), 'utf8'));
  assert.equal(inputHashes['pnpm-lock.yaml'], hash(await readFile('pnpm-lock.yaml')));
  assert.equal(inputHashes['vendor/declare/declare-compiler.js'], 'f5694d953e8e2df6abf51c113f465904b3fe5797665a4e66206dc16bf533ba3b');
  assert.deepEqual(await readFile(join(out, 'dist-1.json')), await readFile(join(out, 'dist-2.json')));
  assert.match(await readFile(join(out, '1-install.log'), 'utf8'), /--frozen-lockfile/);
  await writeFile(join(cwd, 'examples/gain.jsfx'), 'unreviewed golden');
  const failed = spawnSync(process.execPath, [script], { cwd, encoding: 'utf8', timeout: 180_000 });
  assert.notEqual(failed.status, 0);
  const failure = JSON.parse(await readFile(join(out, 'result.json'), 'utf8'));
  assert.equal(failure.status, 'failed');
  assert.match(failure.error, /committed golden/);
  assert.equal(failure.commands.length, 3);
  assert.deepEqual(await readFile(join(out, 'gain-1.jsfx')), golden);
});

test('matrix comparison requires three successful same-revision platform reports and identical complete output', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'declarefx-matrix-test-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  const golden = await readFile('examples/gain.jsfx');
  const metadata = JSON.parse(await readFile('package.json', 'utf8'));
  // External CI artifact fixtures; no compiler or internal collaborator is mocked.
  for (const platform of ['linux', 'darwin', 'win32']) {
    const directory = join(cwd, `proof-${platform}`, 'reproducibility');
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'result.json'), JSON.stringify({
      status: 'passed', revision, goldenSha256: hash(golden),
      environment: { platform, node: `v${metadata.engines.node}`, pnpm: metadata.engines.pnpm, typescript: metadata.dependencies.typescript },
    }));
    for (const name of ['inputs.json', 'dist-1.json', 'dist-2.json']) await writeFile(join(directory, name), '{"fixture":"identical"}\n');
    for (const name of ['gain-1.jsfx', 'gain-2.jsfx']) await writeFile(join(directory, name), golden);
  }
  const run = () => spawnSync(process.execPath, ['scripts/compare-evidence.mjs', cwd], { encoding: 'utf8' });
  const success = run();
  assert.equal(success.status, 0, success.stderr);
  await writeFile(join(cwd, 'proof-win32/reproducibility/gain-2.jsfx'), 'not the golden');
  assert.notEqual(run().status, 0, 'A mismatched platform must not count as matrix success');
  await writeFile(join(cwd, 'proof-win32/reproducibility/gain-2.jsfx'), golden);
  const resultPath = join(cwd, 'proof-darwin/reproducibility/result.json');
  const passedReport = JSON.parse(await readFile(resultPath, 'utf8'));
  await writeFile(resultPath, JSON.stringify({ ...passedReport, status: 'failed' }));
  assert.notEqual(run().status, 0, 'A failed report must not count as matrix success');
  await writeFile(resultPath, JSON.stringify({ ...passedReport, revision: 'wrong-revision' }));
  assert.notEqual(run().status, 0, 'Reports from different revisions must not be combined');
  await writeFile(resultPath, JSON.stringify(passedReport));
  await writeFile(join(cwd, 'proof-darwin/reproducibility/dist-2.json'), '{"fixture":"changed"}');
  assert.notEqual(run().status, 0, 'Non-reproducible dist bytes must fail the matrix');
  await rm(join(cwd, 'proof-darwin'), { recursive: true });
  assert.notEqual(run().status, 0, 'A missing platform must not count as matrix success');
});
