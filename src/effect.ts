import { createHash } from 'node:crypto';
import { compile } from './compiler.js';
import { readDsp } from './dsp.js';
import { graphics } from './graphics.js';
import { decimal } from './numeric.js';
import type { Diagnostic } from './target.js';

export const compilerVersion = '0.1.0';
export const outputMarker = '// DeclareFX generated output v1; edits are disposable.\n';
export interface EffectInput {
  source: string;
  bindingsSource: string;
  dsp: string;
  filename?: string;
  dspFilename?: string;
  bindingsFilename?: string;
}
export type EffectResult = { ok: true; jsfx: string; diagnostics: Diagnostic[] } | { ok: false; diagnostics: Diagnostic[] };

export async function buildEffect(input: EffectInput): Promise<EffectResult> {
  let bindings: unknown;
  try { bindings = JSON.parse(input.bindingsSource); }
  catch { return { ok: false, diagnostics: [{ severity: 'error', category: 'binding', code: 'DFX_JSON', message: 'Expected valid binding JSON.', location: { file: input.bindingsFilename ?? 'gain.bindings.json', line: 1, column: 1 } }] }; }
  const keys = new Set<string>();
  for (const token of input.bindingsSource.matchAll(/"(?:\\[\s\S]|[^"\\])*"/g)) {
    if (!input.bindingsSource.slice(token.index + token[0].length).trimStart().startsWith(':')) continue;
    const key = JSON.parse(token[0]) as string;
    if (keys.has(key)) return { ok: false, diagnostics: [{ severity: 'error', category: 'binding', code: 'DFX_JSON_DUPLICATE', field: key, message: 'Duplicate binding member.' }] };
    keys.add(key);
  }
  const result = await compile({ source: input.source, bindings, filename: input.filename });
  if (!result.ok) return result;
  const { sections, diagnostics } = readDsp(input.dsp, input.dspFilename ?? 'gain.dsp.eel');
  if (diagnostics.length) return { ok: false, diagnostics: [...result.diagnostics, ...diagnostics] };
  const identity = createHash('sha256').update(JSON.stringify([input.source, input.bindingsSource, input.dsp])).digest('hex');
  const ui = graphics(result.program);
  const jsfx = `${outputMarker}// compiler: declarefx ${compilerVersion}; subset: 1\n// upstream: cc62d9dfa0b39f84e20480ff28bed8107d986331\n// inputs-sha256: ${identity}\ndesc:DeclareFX Gain v1\noptions:gfx_idle\nslider1:${decimal(result.program.binding.default)}<0,2,0>Gain\n\n@init\nfunction __dfx_finite(v) (v === v && abs(v) <= ${decimal(Number.MAX_VALUE)});\n${ui.init}${sections.init ?? ''}\n@block\n__dfx_audio_gain = slider1;\ndfx_param_gain = __dfx_finite(__dfx_audio_gain) ? min(2, max(0, __dfx_audio_gain)) : 1;\n${sections.block ?? ''}\n@sample\n${sections.sample ?? ''}\n${ui.gfx}`;
  return { ok: true, jsfx, diagnostics: result.diagnostics };
}
