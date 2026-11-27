import { constantValue, dependencies, ExpressionError, literal, lowerExpression } from './expression.js';
import type { CompileResult, Diagnostic, Expression, Location, Scalar, Slot, TargetNode, TargetProgram } from './target.js';
export type { CompileResult, Diagnostic, Expression, Location, Slot, TargetNode, TargetProgram } from './target.js';

// Only this adapter knows the pinned, non-public checked-tree shape.
const upstream = await import(new URL('../../vendor/declare/declare-compiler.js', import.meta.url).href);
interface Pos { line: number; col: number; offset: number; file?: string }
interface Value { kind: string; value?: number | string; name?: string; src?: string; raw?: string; pos: Pos }
interface Element {
  tag: string; name: string | null; pos: Pos;
  attrs: { name: string; value: Value; pos: Pos }[];
  decls: { name: string; type: string; def: Value | null; pos: Pos; readOnly: boolean }[];
  methods: { name: string; pos: Pos }[];
  children: Element[];
}
interface Program {
  root: Element;
  classes: unknown[]; shapes: unknown[]; themes: unknown[]; styles: unknown[]; fonts: unknown[];
  includes: unknown[]; includeSpans: unknown[]; uses: unknown[]; scripts: unknown[];
  scriptFiles: unknown[]; scriptFileSpans: unknown[];
}
interface UpstreamError { rawMessage: string; code?: string; pos?: Pos }

export async function compile(input: { source: string; bindings: unknown; filename?: string }): Promise<CompileResult> {
  const filename = input.filename ?? 'ui.declare';
  const location = (pos: Pos): Location => ({ file: pos.file ?? filename, line: pos.line, column: pos.col });
  const diagnostics: Diagnostic[] = [];
  const posAtOffset = (offset: number): Pos => {
    const prefix = input.source.slice(0, offset);
    return { offset, line: prefix.split('\n').length, col: offset - prefix.lastIndexOf('\n') };
  };
  const report = (e: UpstreamError, severity: 'error' | 'warning'): Diagnostic => ({
    severity, category: e.code === 'DECLARE7001' ? 'cycle' : e.code === 'DECLARE4001' || /not a member|cannot resolve|cannot find name/i.test(e.rawMessage) ? 'reference' : e.code === 'DECLARE6001' ? 'type' : 'upstream', code: e.code ?? 'DFX_UPSTREAM', message: e.rawMessage,
    ...(e.pos ? { location: location(e.pos) } : {}),
  });
  const fail = (category: Diagnostic['category'], message: string, pos: Pos): void => {
    diagnostics.push({ severity: 'error', category, code: `DFX_${category.toUpperCase()}`, message, location: location(pos) });
  };
  let original: Program;
  try { original = upstream.parseProgram(input.source); }
  catch (error) {
    const e = error as UpstreamError & { errors?: UpstreamError[] };
    return { ok: false, diagnostics: (e.errors ?? [e]).map(e => report(e, 'error')) };
  }
  const surface = (p: Program, raw: Program): void => {
    const top = new Set(['root', 'classes', 'shapes', 'themes', 'styles', 'fonts', 'includes', 'includeSpans', 'uses', 'scripts', 'scriptFiles', 'scriptFileSpans']);
    for (const [key, value] of Object.entries(p)) {
      if (key === 'root') continue;
      if (!top.has(key) || !Array.isArray(value) || value.length) {
        const first = Array.isArray(value) ? value[0] : value;
        const pos = first?.pos ?? (typeof first?.start === 'number' ? posAtOffset(first.start) : posAtOffset(0));
        fail('unsupported', `Top-level ${key} is outside subset v1.`, pos);
      }
    }
    const visit = (el: Element, raw: Element, root: boolean): void => {
      if (!(root ? el.tag === 'App' : el.tag === 'View' || el.tag === 'Text')) fail('unsupported', `Unsupported element ${el.tag}.`, raw.pos);
      for (const key of Object.keys(el)) {
        if (!['tag', 'name', 'attrs', 'decls', 'methods', 'children', 'pos'].includes(key)) fail('unsupported', `Unsupported element body ${key}.`, raw.pos);
      }
      if (el.methods.length) fail('unsupported', 'Authored and implicit methods are unsupported.', raw.methods[0]?.pos ?? raw.pos);
      if (!root && el.decls.length) fail('unsupported', 'Child state declarations are unsupported.', raw.decls[0]?.pos ?? raw.pos);
      if (el.tag === 'Text' && el.children.length) fail('unsupported', 'Text cannot contain children in subset v1.', raw.pos);
      for (const attr of el.attrs) {
        const allowed = root ? ['width', 'height'] : ['x', 'y', 'width', 'height', ...(el.tag === 'View' ? ['fill'] : ['text'])];
        if (!allowed.includes(attr.name) || Object.keys(attr).some(k => !['name', 'value', 'pos'].includes(k))) fail('unsupported', `Unsupported attribute or binding ${attr.name}.`, raw.attrs.find(a => a.name === attr.name)?.pos ?? raw.pos);
        if (['x', 'y', 'width', 'height'].includes(attr.name) && !['number', 'code'].includes(attr.value.kind)) fail('unsupported', 'Geometry requires numeric literals or scalar expressions.', raw.attrs.find(a => a.name === attr.name)?.pos ?? raw.pos);
      }
      el.children.forEach((child, index) => visit(child, raw.children[index] ?? raw, false));
    };
    visit(p.root, raw.root, true);
    const literals = (el: Element, root: boolean): void => {
      const reserved = (name: string, pos: Pos): void => {
        if (/^__dfx_/i.test(name) || /^dfx_param_gain$/i.test(name)) fail('resource', `Reserved target name ${name}.`, pos);
      };
      if (el.name) reserved(el.name, el.pos);
      for (const d of el.decls) {
        reserved(d.name, d.pos);
        if (!['number', 'boolean'].includes(d.type) || !d.def || (d.type === 'number' ? d.def.kind !== 'number' : d.def.kind !== 'ident' || !['true', 'false'].includes(d.def.name ?? ''))) fail('type', 'Root scalars require number/boolean literal defaults.', d.pos);
        if (d.def?.kind === 'number' && !Number.isFinite(d.def.value)) fail('numeric', 'Scalar literals must be finite.', d.def.pos);
      }
      if (root) for (const key of ['width', 'height']) {
        const a = el.attrs.find(a => a.name === key);
        if (!a || a.value.kind !== 'number' || !Number.isFinite(a.value.value) || (a.value.value as number) <= 0) fail('numeric', 'App dimensions require positive finite literal initial sizes.', a?.value.pos ?? el.pos);
      }
      for (const a of el.attrs) {
        if (a.value.kind === 'number' && (!Number.isFinite(a.value.value) || (['width', 'height'].includes(a.name) && (a.value.value as number) < 0))) fail('numeric', 'Geometry must be finite; sizes cannot be negative.', a.value.pos);
        if (a.name === 'fill' && (a.value.kind !== 'hexColor' || !/^#[0-9a-f]{6}$/i.test(a.value.raw ?? ''))) fail('unsupported', 'View fill must be a solid #RRGGBB literal.', a.value.pos);
        if (a.name === 'text') {
          if (a.value.kind !== 'string') fail('unsupported', 'Text requires an immutable literal label.', a.value.pos);
          else {
            const text = a.value.value as string;
            if (/[\u0000\r\n\u2028\u2029]/u.test(text) || Buffer.byteLength(text, 'utf8') > 1024 || Buffer.from(text, 'utf8').toString('utf8') !== text) fail('text', 'Labels must be valid single-line UTF-8 without NUL and at most 1024 bytes.', a.value.pos);
          }
        }
      }
      el.children.forEach(child => literals(child, false));
    };
    literals(raw.root, true);
  };
  // Pure parse rejection happens before the checked frontend can resolve any files/scripts.
  surface(original, original);
  if (diagnostics.length) return { ok: false, diagnostics };
  const bindingError = (field: string, message: string): void => {
    diagnostics.push({ severity: 'error', category: 'binding', code: 'DFX_BINDING', field, message });
  };
  const b = input.bindings as Record<string, unknown> | null;
  const fields = ['version', 'rootState', 'controlPath', 'nativeSlot', 'min', 'max'];
  if (!b || typeof b !== 'object' || Array.isArray(b)) bindingError('bindings', 'Expected one strict v1 binding object.');
  else {
    for (const key of Object.keys(b)) if (!fields.includes(key)) bindingError(key, 'Unknown binding field.');
    for (const [key, value] of Object.entries({ version: 1, rootState: 'gain', nativeSlot: 1, min: 0, max: 2 })) {
      if (!Object.hasOwn(b, key) || b[key] !== value) bindingError(key, `Subset v1 requires ${key} = ${JSON.stringify(value)}.`);
    }
    if (!Object.hasOwn(b, 'controlPath') || !Array.isArray(b.controlPath) || !b.controlPath.length || !b.controlPath.every(s => typeof s === 'string' && s.length > 0)) bindingError('controlPath', 'Expected a nonempty array of named child segments.');
  }
  if (diagnostics.length) return { ok: false, diagnostics };
  const rootGain = original.root.decls.filter(d => d.name === 'gain');
  if (rootGain.length !== 1 || rootGain[0].type !== 'number' || rootGain[0].readOnly || rootGain[0].def?.kind !== 'number' || !Number.isFinite(rootGain[0].def.value) || (rootGain[0].def.value as number) < 0 || (rootGain[0].def.value as number) > 2) {
    bindingError('rootState', 'Binding requires one mutable root gain:number with a finite literal default in 0–2.');
  }
  let bound = original.root;
  const controlPath = b!.controlPath as string[];
  for (const segment of controlPath) {
    const matches = bound.children.filter(c => c.name === segment);
    if (matches.length !== 1) { bindingError('controlPath', `Control segment ${segment} is missing or ambiguous.`); break; }
    bound = matches[0];
  }
  if (bound.tag !== 'View') bindingError('controlPath', 'The control must be a supported named View.');
  if (diagnostics.length) return { ok: false, diagnostics };
  const checked = await upstream.compile(input.source, { files: {}, manifest: {} });
  diagnostics.push(...checked.errors.map((e: UpstreamError) => report(e, 'error')),
    ...checked.warnings.map((e: UpstreamError) => report(e, 'warning')));
  if (checked.errors.length) return { ok: false, diagnostics };
  if (!checked.program) return { ok: false, diagnostics: [...diagnostics, {
    severity: 'error', category: 'compatibility', code: 'DFX_CHECKED_PROGRAM', message: 'Pinned frontend did not return its checked program.',
  }] };
  const program: Program = checked.program;
  surface(program, original);
  if (diagnostics.some(d => d.severity === 'error')) return { ok: false, diagnostics };
  const slots: Slot[] = [];
  const nodes: TargetNode[] = [];
  const addSlot = (pos: Pos, expression?: Expression, input?: Slot['input']): number => {
    const id = slots.length;
    slots.push({ id, type: expression?.type ?? 'number', expression, input, initial: expression?.kind === 'literal' ? expression.value : 0,
      dependencies: expression ? dependencies(expression) : [], invalid: input === 'gain' ? 'safeGain' : 'retain', nonNegative: input === 'viewportWidth' || input === 'viewportHeight', location: location(pos) });
    return id;
  };
  addSlot(original.root.pos, undefined, 'viewportWidth');
  addSlot(original.root.pos, undefined, 'viewportHeight');
  const gain = program.root.decls.find(d => d.name === 'gain')!;
  const stateSlot = addSlot(original.root.decls.find(d => d.name === 'gain')!.pos, undefined, 'gain');
  slots[stateSlot].initial = 1;
  const scalars = new Map([['gain', stateSlot]]);
  for (const d of program.root.decls) if (d.name !== 'gain') {
    const value = d.type === 'boolean' ? d.def!.name === 'true' : d.def!.value as number;
    scalars.set(d.name, addSlot(original.root.decls.find(raw => raw.name === d.name)!.pos, literal(value)));
  }
  const bodies: { node: TargetNode; key: 'x' | 'y' | 'width' | 'height'; value: Value; authored: Value; pos: Pos }[] = [];
  let control = -1;
  const walk = (el: Element, raw: Element, parent: number | null): void => {
    const id = nodes.length;
    if (raw === bound) control = id;
    const node: TargetNode = { id, kind: el.tag as TargetNode['kind'], name: el.name, parent, geometry: { x: -1, y: -1, width: -1, height: -1 } };
    nodes.push(node);
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      if (parent === null && (key === 'width' || key === 'height')) { node.geometry[key] = key === 'width' ? 0 : 1; continue; }
      const attr = el.attrs.find(a => a.name === key);
      const pos = raw.attrs.find(a => a.name === key)?.value.pos ?? raw.pos;
      node.geometry[key] = addSlot(pos, literal(attr?.value.kind === 'number' ? attr.value.value as number : 0));
      const slot = slots[node.geometry[key]];
      // Derived geometry starts at zero and retains its last valid value on invalid evaluation.
      slot.initial = 0;
      slot.nonNegative = key === 'width' || key === 'height';
      if (attr?.value.kind === 'code') bodies.push({ node, key, value: attr.value, authored: raw.attrs.find(a => a.name === key)!.value, pos });
    }
    const fill = el.attrs.find(a => a.name === 'fill');
    if (fill) node.fill = fill.value.raw;
    if (node.kind === 'Text') node.text = el.attrs.find(a => a.name === 'text')?.value.value as string ?? '';
    el.children.forEach((child, index) => walk(child, raw.children[index], id));
  };
  walk(program.root, original.root, null);
  for (const { node, key, value, authored, pos } of bodies) {
    try {
      const resolve = (path: string[]): Expression => {
        const refError = (): never => { throw new ExpressionError('reference', `Unsupported or unresolved scalar read ${path.join('.')}.`); };
        let slot: number | undefined;
        if (path.length === 3 && path[0] === 'this' && path[1] === '$root') {
          slot = path[2] === 'width' ? 0 : path[2] === 'height' ? 1 : scalars.get(path[2]);
        } else {
          let target = node;
          let cursor = 0;
          if (path[0] === 'this') cursor++;
          else if (path[0] === 'parent') {
            while (path[cursor] === 'parent') {
              if (target.parent === null) return refError();
              target = nodes[target.parent]; cursor++;
            }
          } else return refError();
          if (path.length !== cursor + 1 || !['x', 'y', 'width', 'height'].includes(path[cursor])) return refError();
          slot = target.geometry[path[cursor] as keyof TargetNode['geometry']];
        }
        if (slot === undefined) return refError();
        return { kind: 'read', type: slots[slot].type, slot };
      };
      // Check authored syntax too: upstream erases assertions and other TS syntax.
      lowerExpression(authored.src!, path => {
        if (path[0] === 'app' || path[0] === 'App') return resolve(['this', '$root', ...path.slice(1)]);
        if (path.length === 1) return resolve(['x', 'y', 'width', 'height'].includes(path[0]) ? ['this', path[0]] : ['this', '$root', path[0]]);
        return resolve(path);
      });
      const expression = lowerExpression(value.src!, resolve);
      if (expression.type !== 'number') throw new ExpressionError('type', 'Geometry expressions must produce a number.');
      const slot = slots[node.geometry[key]];
      slot.expression = expression; slot.dependencies = dependencies(expression);
    } catch (error) {
      if (!(error instanceof ExpressionError)) throw error;
      fail(error.category, error.message, pos);
    }
  }
  if (diagnostics.some(d => d.severity === 'error')) return { ok: false, diagnostics };
  const order: number[] = [];
  const visited = new Set<number>();
  const active = new Set<number>();
  const visit = (id: number): void => {
    if (active.has(id)) {
      diagnostics.push({ severity: 'error', category: 'cycle', code: 'DFX_CYCLE', message: 'Static geometry dependencies contain a cycle.', location: slots[id].location });
      return;
    }
    if (visited.has(id)) return;
    visited.add(id); active.add(id);
    slots[id].dependencies.forEach(visit);
    active.delete(id);
    order.push(id);
  };
  slots.forEach(s => visit(s.id));
  if (diagnostics.some(d => d.severity === 'error')) return { ok: false, diagnostics };
  const known = new Map<number, Scalar>();
  for (const id of order) {
    const slot = slots[id];
    if (!slot.expression) continue;
    try {
      const value = constantValue(slot.expression, known);
      if (slot.nonNegative && typeof value === 'number' && value < 0) throw new ExpressionError('numeric', 'Statically negative geometry size.');
      if (value !== undefined) known.set(id, value);
    } catch (error) {
      if (!(error instanceof ExpressionError)) throw error;
      diagnostics.push({ severity: 'error', category: error.category, code: 'DFX_NUMERIC', message: error.message, location: slot.location });
    }
  }
  if (diagnostics.some(d => d.severity === 'error')) return { ok: false, diagnostics };
  const width = program.root.attrs.find(a => a.name === 'width')!.value.value as number;
  const height = program.root.attrs.find(a => a.name === 'height')!.value.value as number;
  const target: TargetProgram = { subset: 1, initialSize: { width, height }, nodes, slots, order,
    binding: { rootState: 'gain', nativeSlot: 1, min: 0, max: 2, default: gain.def!.value as number,
      stateSlot, control, controlPath: [...controlPath] } };
  return { ok: true, program: target, diagnostics };
}
