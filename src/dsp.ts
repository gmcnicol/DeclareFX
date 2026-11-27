import type { Diagnostic } from './target.js';

// Mask comments and quoted literals without changing offsets or line numbers.
function mask(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'/g,
    value => value.replace(/[^\n]/g, ' '));
}

export function readDsp(source: string, filename: string): { sections: Record<string, string>; diagnostics: Diagnostic[] } {
  source = source.replace(/\r\n?/g, '\n');
  const code = mask(source);
  const diagnostics: Diagnostic[] = [];
  const error = (offset: number, message: string): void => {
    const prefix = source.slice(0, offset);
    diagnostics.push({ severity: 'error', category: 'unsupported', code: 'DFX_DSP_SECTION', message,
      location: { file: filename, line: prefix.split('\n').length, column: offset - prefix.lastIndexOf('\n') } });
  };
  const headers = [...code.matchAll(/^[ \t]*@[^\n]*/gm)];
  const sections: Record<string, string> = {};
  if (!headers.length || code.slice(0, headers[0].index).trim()) error(0, 'DSP accepts only optional @init/@block and required @sample, with no declarations or imports before sections.');
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const name = /^\s*@(init|block|sample)\s*$/.exec(header[0])?.[1];
    if (!name || Object.hasOwn(sections, name)) { error(header.index, 'Unsupported or duplicate DSP section.'); continue; }
    const start = header.index + header[0].length;
    sections[name] = source.slice(source[start] === '\n' ? start + 1 : start, headers[i + 1]?.index ?? source.length);
  }
  if (!Object.hasOwn(sections, 'sample')) error(0, 'DSP requires @sample.');
  for (const match of code.matchAll(/^\s*(?:import\b|slider\d+\s*:)/gim)) error(match.index, 'DSP imports and independent slider declarations are unsupported.');
  const resource = (offset: number, message: string): void => {
    error(offset, message);
    diagnostics[diagnostics.length - 1].category = 'resource';
    diagnostics[diagnostics.length - 1].code = 'DFX_DSP_RESOURCE';
  };
  const protectedValue = /\b(?:dfx_param_gain|slider\d+)\b/i;
  for (const match of code.matchAll(/[a-z_][\w.]*/gi)) {
    if (match[0].split('.').some(part => /^__dfx_/i.test(part)) || /^(?:gfx_|mouse_|slider_automate$|sliderchange$|slider_show$)/i.test(match[0])) {
      resource(match.index, `Compiler-owned DSP resource ${match[0]}.`);
    }
  }
  for (const match of code.matchAll(/\bfunction\s+[\w.]+\s*\([^)]*\)(?:\s*(?:local|instance|global)\s*\([^)]*\))*/gi)) {
    if (protectedValue.test(match[0])) resource(match.index, 'Native parameters and DSP aliases cannot be defined or shadowed.');
  }
  for (const match of code.matchAll(/(?<![=!<>])(?:[+*/%|&~^-]?=)(?!=)/g)) {
    let end = match.index;
    while (/\s/.test(code[end - 1] ?? '') && end > 0) end--;
    let start = end;
    if (code[end - 1] === ')') {
      let depth = 1;
      start = end - 1;
      while (start > 0 && depth) { start--; if (code[start] === ')') depth++; if (code[start] === '(') depth--; }
    } else {
      while (start > 0 && /[\w.#]/.test(code[start - 1])) start--;
    }
    if (protectedValue.test(code.slice(start, end))) resource(start, 'Native parameters and DSP aliases are read-only to author DSP.');
  }
  const mutators: Record<string, (index: number) => boolean> = {
    assign: i => i === 0, file_var: i => i === 1, slider_next_chg: i => i === 1,
    stack_pop: i => i === 0, atomic_set: i => i === 0, atomic_add: i => i === 0,
    atomic_setifequal: i => i === 0, atomic_exch: i => i < 2,
    mem_get_values: i => i > 0, match: i => i > 1, matchi: i => i > 1,
  };
  for (const call of code.matchAll(/\b([\w]+)\s*\(/g)) {
    const writes = mutators[call[1].toLowerCase()];
    if (!writes) continue;
    let depth = 1, start = call.index + call[0].length, argument = 0;
    for (let at = start; at < code.length && depth; at++) {
      if (code[at] === '(') depth++;
      if (code[at] === ')') depth--;
      if ((code[at] === ',' && depth === 1) || depth === 0) {
        const value = code.slice(start, at).replace(/[()\s]/g, '');
        if (writes(argument) && (/^(?:dfx_param_gain|slider\d+)$/i.test(value) || (value.includes('?') && protectedValue.test(value)))) resource(start, 'DSP API cannot write a native parameter or read-only alias.');
        start = at + 1; argument++;
      }
    }
  }
  for (const named of code.matchAll(/#dfx_param_gain\b/gi)) resource(named.index, 'The DSP alias is not an author-owned named string.');
  if (sections.init) {
    let executable = mask(sections.init);
    const functions = new Map<string, string>();
    for (const header of executable.matchAll(/\bfunction\s+([\w.]+)\s*\([^)]*\)(?:\s*(?:local|instance|global)\s*\([^)]*\))*\s*\(/gi)) {
      let end = header.index + header[0].length, depth = 1;
      while (end < executable.length && depth) { if (executable[end] === '(') depth++; if (executable[end] === ')') depth--; end++; }
      functions.set(header[1].toLowerCase(), executable.slice(header.index + header[0].length, end - 1));
      executable = executable.slice(0, header.index) + executable.slice(header.index, end).replace(/[^\n]/g, ' ') + executable.slice(end);
    }
    const readsAlias = (body: string, seen = new Set<string>()): boolean => {
      if (/\bdfx_param_gain\b/i.test(body)) return true;
      for (const call of body.matchAll(/\b([\w.]+)\s*\(/g)) {
        const name = call[1].toLowerCase();
        if (!seen.has(name) && functions.has(name)) { seen.add(name); if (readsAlias(functions.get(name)!, seen)) return true; }
      }
      return false;
    };
    if (readsAlias(executable)) resource(0, 'dfx_param_gain is only available from @block onward, not @init execution.');
  }
  return { sections, diagnostics };
}
