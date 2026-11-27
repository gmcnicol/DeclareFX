import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { arch, platform, release, tmpdir, type, version } from 'node:os';
import { join, resolve } from 'node:path';

const inputs = ['src', 'test', 'examples', 'vendor', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', 'LICENSE', 'THIRD_PARTY_NOTICES.md'];
const output = resolve('proof-evidence/reproducibility');
const temporary = mkdtempSync(join(tmpdir(), 'declarefx-reproducibility-'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = (name, value) => writeFileSync(join(output, name), JSON.stringify(value, null, 2) + '\n');
// pnpm is a .cmd shim on Windows; only fixed, authored arguments reach cmd.exe.
const execute = (command, args, options = {}) => process.platform === 'win32' && command === 'pnpm'
  ? spawnSync('cmd.exe', ['/d', '/s', '/c', `pnpm ${args.join(' ')}`], { encoding: 'utf8', ...options })
  : spawnSync(command, args, { encoding: 'utf8', ...options });
const git = args => spawnSync('git', args, { encoding: 'utf8' }).stdout?.trim() ?? null;
const report = {
  status: 'failed',
  revision: git(['rev-parse', 'HEAD']),
  worktreeStatus: git(['status', '--porcelain']),
  runUrl: process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null,
  environment: {
    node: process.version, pnpm: execute('pnpm', ['--version']).stdout?.trim(),
    platform: platform(), arch: arch(), os: type(), release: release(), version: version(),
    imageOS: process.env.ImageOS ?? null, imageVersion: process.env.ImageVersion ?? null,
    runnerOS: process.env.RUNNER_OS ?? null, runnerArch: process.env.RUNNER_ARCH ?? null,
  },
  commands: [],
};

function manifest(directory, prefix = '') {
  const result = {};
  for (const item of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const name = prefix + item.name;
    if (item.isDirectory()) Object.assign(result, manifest(join(directory, item.name), name + '/'));
    else result[name] = hash(readFileSync(join(directory, item.name)));
  }
  return result;
}

function run(directory, label, command, args) {
  const result = execute(command, args, { cwd: directory, maxBuffer: 32 * 1024 * 1024 });
  const text = `$ ${command} ${args.join(' ')}\n${result.stdout ?? ''}${result.stderr ?? ''}${result.error ?? ''}\nexit: ${result.status}; signal: ${result.signal}\n`;
  writeFileSync(join(output, label + '.log'), text);
  console.log(text);
  report.commands.push({ directory, command: [command, ...args], log: label + '.log', status: result.status, signal: result.signal });
  assert.equal(result.status, 0, `${label} failed; see ${label}.log`);
}

mkdirSync(output, { recursive: true });
try {
  // Clear only this command's disposable evidence, never workflow gate logs.
  for (const file of readdirSync(output)) rmSync(join(output, file), { recursive: true, force: true });
  const metadata = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(process.version, `v${metadata.engines.node}`);
  assert.equal(report.environment.pnpm, metadata.engines.pnpm);
  const hashes = {};
  for (const input of inputs) {
    if (['src', 'test', 'examples', 'vendor'].includes(input)) Object.assign(hashes, manifest(input, input + '/'));
    else hashes[input] = hash(readFileSync(input));
  }
  json('inputs.json', hashes);
  const golden = readFileSync('examples/gain.jsfx');
  report.goldenSha256 = hash(golden);
  let previous;
  for (const number of [1, 2]) {
    const directory = join(temporary, number === 1 ? 'checkout-one' : 'different path checkout-two');
    mkdirSync(directory);
    for (const input of inputs) cpSync(input, join(directory, input), { recursive: true });
    run(directory, `${number}-install`, 'pnpm', ['install', '--frozen-lockfile']);
    assert.equal(hash(readFileSync(join(directory, 'pnpm-lock.yaml'))), hashes['pnpm-lock.yaml'], 'Frozen install changed the lockfile');
    report.environment.typescript = JSON.parse(readFileSync(join(directory, 'node_modules/typescript/package.json'), 'utf8')).version;
    assert.equal(report.environment.typescript, metadata.dependencies.typescript);
    run(directory, `${number}-build`, 'pnpm', ['build']);
    const emitted = manifest(join(directory, 'dist'));
    json(`dist-${number}.json`, emitted);
    if (previous) assert.deepEqual(emitted, previous, 'Clean relocated dist bytes differ');
    previous = emitted;
    run(directory, `${number}-cli`, process.execPath, ['dist/src/cli.js', 'build', 'examples/gain.declare', '--bindings', 'examples/gain.bindings.json', '--dsp', 'examples/gain.dsp.eel', '--out', 'built.jsfx']);
    const bytes = readFileSync(join(directory, 'built.jsfx'));
    writeFileSync(join(output, `gain-${number}.jsfx`), bytes);
    assert.deepEqual(bytes, golden, 'Clean CLI output differs from committed golden');
  }
  report.status = 'passed';
} catch (error) {
  report.error = String(error);
  console.error(error);
  process.exitCode = 1;
} finally {
  json('result.json', report);
  rmSync(temporary, { recursive: true, force: true });
}
