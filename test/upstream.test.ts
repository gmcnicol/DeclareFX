import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

// Characterize the pinned external seam; these are not DeclareFX target tests.
const { compile } = await import(pathToFileURL(resolve('vendor/declare/declare-compiler.js')).href);
const source = `App [ width = 400, height = 160, gain: number = 1,
 background: View [ width = { parent.width }, height = { parent.height }, fill = #eeeeee ],
 label: Text [ x = 12, y = 12, width = 200, height = 20, text = "Gain" ],
 gainControl: View [ x = 12, y = 48, width = { parent.width / 2 }, height = 24, fill = #557799 ]
]`;

test('pinned checked-tree frontend accepts the literal-label example without library inputs', async () => {
  const result = await compile(source, { files: {}, manifest: {} });
  assert.deepEqual(result.errors, []);
  assert.ok(result.program);
  assert.equal(Object.getOwnPropertyDescriptor(result, 'program')?.enumerable, false);
  assert.deepEqual(result.program.classes, []);
  assert.deepEqual(result.program.root.children.map((child: { name: string }) => child.name), [
    'background', 'label', 'gainControl',
  ]);
  const second = await compile(source, { files: {}, manifest: {} });
  assert.deepEqual(second.program, result.program);
});

test('pinned frontend rejects a wrong numeric default with its original source position', async () => {
  const result = await compile('App [ width = 400, height = 160, gain: number = "bad" ]', {
    files: {}, manifest: {},
  });
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].rawMessage, /default expects a number/);
  assert.equal(result.errors[0].pos.line, 1);
  assert.equal(result.errors[0].pos.col, 49);
  assert.equal(result.program, undefined);
});
