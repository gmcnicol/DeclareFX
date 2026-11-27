import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('vendored compiler is the exact artifact approved for subset v1', async () => {
  const bytes = await readFile('vendor/declare/declare-compiler.js');
  assert.equal(bytes.length, 5_175_114);
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    'f5694d953e8e2df6abf51c113f465904b3fe5797665a4e66206dc16bf533ba3b',
  );
});

test('compiler provenance and redistributed notices travel with the artifact', async () => {
  const provenance = JSON.parse(await readFile('vendor/declare/provenance.json', 'utf8'));
  assert.equal(provenance.repository, 'https://github.com/davidtemkin/declarelang');
  assert.equal(provenance.revision, 'cc62d9dfa0b39f84e20480ff28bed8107d986331');
  assert.equal(provenance.sourcePath, 'bundles/declare-compiler.js');
  assert.equal(provenance.sha256, 'f5694d953e8e2df6abf51c113f465904b3fe5797665a4e66206dc16bf533ba3b');
  assert.deepEqual(provenance.notices.map((notice: { path: string }) => notice.path), [
    'LICENSE.declare',
    'LICENSE.typescript.txt',
    'ThirdPartyNoticeText.typescript.txt',
    'LICENSE.esbuild',
  ]);
  for (const notice of provenance.notices) {
    const bytes = await readFile(`vendor/declare/${notice.path}`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), notice.sha256, notice.path);
  }
});
