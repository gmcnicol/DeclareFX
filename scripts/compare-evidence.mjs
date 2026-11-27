import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2];
assert.ok(root, 'Usage: node scripts/compare-evidence.mjs <downloaded-artifacts-directory>');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const metadata = JSON.parse(readFileSync('package.json', 'utf8'));
const golden = readFileSync('examples/gain.jsfx');
const goldenSha256 = createHash('sha256').update(golden).digest('hex');
let previousInputs;
let previousDist;
for (const platform of ['linux', 'darwin', 'win32']) {
  const directory = join(root, `proof-${platform}`, 'reproducibility');
  const json = name => JSON.parse(readFileSync(join(directory, name), 'utf8'));
  const report = json('result.json');
  assert.equal(report.status, 'passed', platform);
  assert.equal(report.revision, revision, platform);
  assert.equal(report.environment.platform, platform);
  assert.equal(report.environment.node, `v${metadata.engines.node}`);
  assert.equal(report.environment.pnpm, metadata.engines.pnpm);
  assert.equal(report.environment.typescript, metadata.dependencies.typescript);
  assert.equal(report.goldenSha256, goldenSha256);
  const inputs = json('inputs.json');
  const dist = json('dist-1.json');
  assert.deepEqual(json('dist-2.json'), dist, `${platform}: repeated build differs`);
  if (previousInputs) assert.deepEqual(inputs, previousInputs, `${platform}: checkout inputs differ`);
  if (previousDist) assert.deepEqual(dist, previousDist, `${platform}: emitted dist differs`);
  for (const number of [1, 2]) assert.deepEqual(readFileSync(join(directory, `gain-${number}.jsfx`)), golden, `${platform}: golden differs`);
  previousInputs = inputs;
  previousDist = dist;
}
console.log(JSON.stringify({ status: 'passed', revision, platforms: ['linux', 'darwin', 'win32'], goldenSha256 }, null, 2));
