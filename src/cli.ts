#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { link, lstat, open, readFile, realpath, rename, rm, stat } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { buildEffect, compilerVersion, outputMarker } from './effect.js';
import type { Diagnostic } from './target.js';

const usage = 'declarefx build ui.declare --bindings gain.bindings.json --dsp gain.dsp.eel --out gain.jsfx';
const fail = (code: string, message: string): never => { throw new Error(`[publication/${code}] ${message}`); };
const missing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';
const print = (d: Diagnostic): void => {
  const context = d.location ? `${d.location.file}:${d.location.line}:${d.location.column}: ` : d.field ? `bindings.${d.field}: ` : '';
  console.error(`${context}${d.severity} [${d.category}/${d.code}] ${d.message}`);
};

async function main(argv: string[]): Promise<void> {
  if (argv.length === 1 && argv[0] === '--help') { console.log(usage); return; }
  if (argv.length === 1 && argv[0] === '--version') { console.log(compilerVersion); return; }
  const options = new Map<string, string>();
  if (argv[0] !== 'build' || !argv[1] || argv[1].startsWith('--') || argv.length !== 8) throw new Error(`[cli/DFX_CLI] Expected ${usage}`);
  for (let i = 2; i < argv.length; i += 2) {
    if (!['--bindings', '--dsp', '--out'].includes(argv[i]) || options.has(argv[i]) || !argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`[cli/DFX_CLI] Unknown, duplicate or missing option. Expected ${usage}`);
    options.set(argv[i], argv[i + 1]);
  }
  const paths = [argv[1], options.get('--bindings')!, options.get('--dsp')!].map(path => resolve(path));
  const out = resolve(options.get('--out')!);
  const inputs = await Promise.all(paths.map(async path => ({ path: await realpath(path), info: await stat(path, { bigint: true }) })));
  if (inputs.some(input => !input.info.isFile())) fail('DFX_INPUT', 'Inputs must be regular files.');
  const inspect = async (): Promise<Buffer | undefined> => {
    let info;
    try { info = await lstat(out, { bigint: true }); }
    catch (error) { if (!missing(error)) throw error; }
    const actual = info ? await realpath(out) : join(await realpath(dirname(out)), basename(out));
    const target = info ? await stat(out, { bigint: true }) : undefined;
    if (inputs.some(input => input.path === actual || (target && input.info.dev === target.dev && input.info.ino === target.ino))) fail('DFX_ALIAS', 'Output must not alias a UI, binding or DSP input.');
    if (!info) return undefined;
    if (!info.isFile()) fail('DFX_OUTPUT', 'Output must be a regular file, not a symlink or directory.');
    const bytes = await readFile(out);
    if (!bytes.subarray(0, Buffer.byteLength(outputMarker)).equals(Buffer.from(outputMarker))) fail('DFX_UNMARKED', 'Refusing to replace output without the compiler-owned marker.');
    return bytes;
  };
  const previous = await inspect();
  const texts = await Promise.all(paths.map(async path => {
    const bytes = await readFile(path);
    // Keep BOM/raw line endings in the input identity; reject malformed UTF-8.
    try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
    catch { throw new Error(`[io/DFX_UTF8] ${path}: Input must be valid UTF-8.`); }
  }));
  const result = await buildEffect({ source: texts[0], bindingsSource: texts[1], dsp: texts[2], filename: paths[0], bindingsFilename: paths[1], dspFilename: paths[2] });
  result.diagnostics.forEach(print);
  if (!result.ok) { process.exitCode = 1; return; }
  const temporary = join(dirname(out), `.${basename(out)}.${randomUUID()}.tmp`);
  const file = await open(temporary, 'wx');
  try {
    try { await file.writeFile(result.jsfx, 'utf8'); await file.sync(); }
    finally { await file.close(); }
    for (let attempt = 0; ; attempt++) {
      const current = await inspect();
      if (previous === undefined ? current !== undefined : current === undefined || !previous.equals(current)) fail('DFX_CHANGED', 'Output changed during compilation; refusing replacement.');
      // New destinations use no-clobber link; existing owned outputs use atomic rename.
      if (previous === undefined) { await link(temporary, out); break; }
      try { await rename(temporary, out); break; }
      catch (error) {
        // Windows readers/scanners can transiently deny replacement; never unlink the destination.
        if (!['EPERM', 'EACCES', 'EBUSY'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
        if (attempt === 5) throw new Error(`Atomic replacement failed after 6 attempts: ${String(error)}`);
        await delay(20 * 2 ** attempt);
      }
    }
  } finally {
    await rm(temporary, { force: true }).catch(error => console.error(`warning [publication/DFX_CLEANUP] ${temporary}: ${String(error)}`));
  }
}

try { await main(process.argv.slice(2)); }
catch (error) { console.error(error instanceof Error ? error.message.startsWith('[') ? error.message : `[io/DFX_IO] ${error.message}` : `[io/DFX_IO] ${String(error)}`); process.exitCode = 1; }
