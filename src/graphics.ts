import type { Expression, TargetProgram } from './target.js';

// shortcut: finite subnormal preservation is unresolved in EEL2; resolve docs/numeric-blocker.md before full subset conformance.
const scalar = (value: number | boolean): string => typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
// EEL2 has byte escapes, not JSON's \\u/\\f. Separate literals stop hex consumption.
const label = (text: string): string => '"' + text.replace(/[\\"\u0001-\u001f\u007f]/g, char =>
  char === '\\' || char === '"' ? `\\${char}` : `" "\\x${char.charCodeAt(0).toString(16).padStart(2, '0')}" "`) + '"';
// Check the expression before assignment: EEL2 may filter assigned overflow to zero.
const finiteResult = (expression: string): string => `(abs(${expression}) <= 1.7976931348623157e308)`;
const s = (id: number): string => `__dfx_ui_s${id}`;
const v = (id: number): string => `__dfx_ui_v${id}`;
const d = (id: number): string => `__dfx_ui_d${id}`;

export function graphics(program: TargetProgram): { init: string; gfx: string } {
  let serial = 0;
  const expression = (e: Expression): { code: string; value: string; valid: string } => {
    const value = `__dfx_ui_t${serial++}`, valid = `${value}_ok`;
    if (e.kind === 'literal') return { code: `${value} = ${scalar(e.value)};\n${valid} = 1;\n`, value, valid };
    if (e.kind === 'read') return { code: `${value} = ${s(e.slot)};\n${valid} = ${v(e.slot)};\n`, value, valid };
    const left = expression(e.kind === 'conditional' ? e.condition : e.kind === 'unary' ? e.operand : e.left);
    let code = `${left.code}${valid} = ${left.valid};\n${valid} ? (\n`;
    if (e.kind === 'unary') {
      code += `${value} = ${e.op}(${left.value});\n`;
    } else if (e.kind === 'conditional' || e.op === '&&' || e.op === '||') {
      const then = e.kind === 'conditional' ? expression(e.then) : e.op === '&&' ? expression(e.right) : expression({ kind: 'literal', type: 'boolean', value: true });
      const otherwise = e.kind === 'conditional' ? expression(e.else) : e.op === '||' ? expression(e.right) : expression({ kind: 'literal', type: 'boolean', value: false });
      code += `${left.value} ? (\n${then.code}${value} = ${then.value};\n${valid} = ${then.valid};\n) : (\n${otherwise.code}${value} = ${otherwise.value};\n${valid} = ${otherwise.valid};\n);\n`;
    } else {
      const right = expression(e.right);
      const operation = `(${left.value} ${e.op} ${right.value})`;
      code += `${right.code}${valid} = ${right.valid}${e.op === '/' ? ` && (${right.value} !== 0)` : ''}${e.type === 'number' ? ` && ${finiteResult(operation)}` : ''};\n${valid} ? (${value} = ${operation};);\n`;
    }
    if (e.type === 'number') code += `${valid} = ${valid} && __dfx_finite(${value});\n`;
    code += ');\n';
    return { code, value, valid };
  };
  let init = 'gfx_ext_retina = 1;\n__dfx_ui_first = 1;\n__dfx_ui_drag = 0;\n__dfx_ui_touch = 0;\n__dfx_ui_down = 0;\n__dfx_ui_numeric_error = 0;\n';
  for (const slot of program.slots) init += `${s(slot.id)} = ${scalar(slot.initial)};\n${v(slot.id)} = 0;\n`;
  for (const node of program.nodes) {
    init += `__dfx_ui_x${node.id} = 0;\n__dfx_ui_y${node.id} = 0;\n`;
    if (node.text !== undefined) init += `#__dfx_label${node.id} = ${label(node.text)};\n`;
  }
  let refresh = 'function __dfx_ui_refresh() (\n__dfx_ui_observed = slider1;\n!__dfx_finite(__dfx_ui_observed) ? (__dfx_ui_numeric_error = 1;);\n';
  for (const id of program.order) {
    const slot = program.slots[id];
    refresh += `${d(id)} = 0;\n`;
    if (!slot.input) refresh += `(__dfx_ui_first${slot.dependencies.map(dep => ` || ${d(dep)}`).join('')}) ? (\n`;
    if (slot.input) {
      refresh += `__dfx_ui_next = ${slot.input === 'gain' ? '__dfx_finite(__dfx_ui_observed) ? min(2, max(0, __dfx_ui_observed)) : 1' : slot.input === 'viewportWidth' ? 'gfx_w' : 'gfx_h'};\n__dfx_ui_ok = __dfx_finite(__dfx_ui_next)${slot.nonNegative ? ' && (__dfx_ui_next >= 0)' : ''};\n`;
    } else {
      const e = expression(slot.expression!);
      refresh += `${e.code}__dfx_ui_next = ${e.value};\n__dfx_ui_ok = ${e.valid}${slot.nonNegative ? ' && (__dfx_ui_next >= 0)' : ''};\n`;
    }
    refresh += `${d(id)} = (${v(id)} !== __dfx_ui_ok) || (__dfx_ui_ok && (${s(id)} !== __dfx_ui_next));\n${v(id)} = __dfx_ui_ok;\n__dfx_ui_ok ? (${s(id)} = __dfx_ui_next;) : (__dfx_ui_numeric_error = 1;);\n`;
    if (!slot.input) refresh += ');\n';
  }
  refresh += '__dfx_ui_first = 0;\n);\n';
  let placement = '';
  let paint = 'gfx_dest = -1;\ngfx_mode = 0;\ngfx_a = 1;\ngfx_setfont(0);\n';
  for (const node of program.nodes) {
    const { x, y, width, height } = node.geometry;
    const nx = `__dfx_ui_x${node.id}`, ny = `__dfx_ui_y${node.id}`;
    placement += `__dfx_ui_place_ok${node.id} = ${v(x)} && ${v(y)}${node.parent === null ? '' : ` && __dfx_ui_place_ok${node.parent}`};\n`;
    for (const [axis, slot] of [['x', x], ['y', y]] as const) {
      const position = node.parent === null ? '0' : `__dfx_ui_${axis}${node.parent} + ${s(slot)}`;
      placement += `${finiteResult(position)} ? (\n__dfx_ui_next = ${position};\n__dfx_ui_${axis}${node.id} = __dfx_ui_next;\n) : (__dfx_ui_place_ok${node.id} = 0; __dfx_ui_numeric_error = 1;);\n`;
    }
    if (node.kind === 'App' || (node.fill === undefined && node.kind !== 'Text')) continue;
    const root = program.nodes[0].geometry;
    paint += `(${s(width)} > 0 && ${s(height)} > 0 && ${nx} < ${s(root.width)} && ${ny} < ${s(root.height)} && ${s(width)} > max(0, -${nx}) && ${s(height)} > max(0, -${ny})) ? (\n`;
    paint += `__dfx_ui_left = max(0, ${nx});\n__dfx_ui_top = max(0, ${ny});\n__dfx_ui_w = min(${s(width)} - max(0, -${nx}), ${s(root.width)} - __dfx_ui_left);\n__dfx_ui_h = min(${s(height)} - max(0, -${ny}), ${s(root.height)} - __dfx_ui_top);\n`;
    if (node.fill) {
      const channels = [1, 3, 5].map(offset => parseInt(node.fill!.slice(offset, offset + 2), 16));
      paint += `gfx_r = ${channels[0]} / 255;\ngfx_g = ${channels[1]} / 255;\ngfx_b = ${channels[2]} / 255;\ngfx_rect(__dfx_ui_left, __dfx_ui_top, __dfx_ui_w, __dfx_ui_h);\n`;
    } else {
      paint += `gfx_r = 0; gfx_g = 0; gfx_b = 0;\ngfx_x = ${nx}; gfx_y = ${ny};\ngfx_drawstr(#__dfx_label${node.id}, 0, __dfx_ui_left + __dfx_ui_w, __dfx_ui_top + __dfx_ui_h);\n`;
    }
    paint += ');\n';
  }
  const control = program.nodes[program.binding.control];
  const { x, y, width, height } = control.geometry;
  const root = program.nodes[0].geometry;
  placement += `__dfx_ui_control_ok = __dfx_ui_place_ok${control.id} && ${v(x)} && ${v(y)} && ${v(width)} && ${v(height)} && (${s(width)} > 0) && (${s(height)} > 0);\n`;
  const interaction = `__dfx_ui_refresh();
__dfx_ui_place();
__dfx_ui_window = gfx_getchar(65536);
__dfx_ui_live = !(gfx_ext_flags & 2) && ((__dfx_ui_window & 6) === 6) && ${v(root.width)} && ${v(root.height)} && (${s(root.width)} > 0) && (${s(root.height)} > 0);
__dfx_ui_down_now = mouse_cap & 1;
__dfx_ui_drag && (!__dfx_ui_live || !__dfx_ui_down_now || !__dfx_ui_control_ok) ? (__dfx_ui_cancel(););
__dfx_ui_hit = __dfx_ui_control_ok && mouse_x >= 0 && mouse_y >= 0 && mouse_x < ${s(root.width)} && mouse_y < ${s(root.height)} && mouse_x >= __dfx_ui_x${control.id} && mouse_y >= __dfx_ui_y${control.id} && (mouse_x - __dfx_ui_x${control.id}) < ${s(width)} && (mouse_y - __dfx_ui_y${control.id}) < ${s(height)};
__dfx_ui_live && __dfx_ui_down_now && !__dfx_ui_down && __dfx_ui_hit ? (
__dfx_ui_drag = 1;
__dfx_ui_prev_x = mouse_x;
);
__dfx_ui_drag ? (
__dfx_finite(mouse_x) && ${finiteResult('mouse_x - __dfx_ui_prev_x')} ? (
__dfx_ui_delta = mouse_x - __dfx_ui_prev_x;
__dfx_ui_delta !== 0 ? (
__dfx_ui_prev_x = mouse_x;
__dfx_ui_native = slider1;
__dfx_ui_native = __dfx_finite(__dfx_ui_native) ? min(2, max(0, __dfx_ui_native)) : 1;
${finiteResult('2 * __dfx_ui_delta')} && ${finiteResult(`(2 * __dfx_ui_delta) / ${s(width)}`)} && ${finiteResult(`__dfx_ui_native + 2 * __dfx_ui_delta / ${s(width)}`)} ? (
__dfx_ui_edit = __dfx_ui_native + 2 * __dfx_ui_delta / ${s(width)};
__dfx_ui_edit = min(2, max(0, __dfx_ui_edit));
__dfx_ui_edit !== __dfx_ui_native ? (
slider1 = __dfx_ui_edit;
slider_automate(1);
__dfx_ui_touch = 1;
);
) : (__dfx_ui_numeric_error = 1; __dfx_ui_cancel(););
);
) : (__dfx_ui_numeric_error = 1; __dfx_ui_cancel(););
);
__dfx_ui_down = __dfx_ui_down_now;
__dfx_ui_refresh();
__dfx_ui_place();
__dfx_ui_drag && !__dfx_ui_control_ok ? (__dfx_ui_cancel(););
!((gfx_ext_flags & 2)) && ${v(root.width)} && ${v(root.height)} ? (
${paint});
`;
  return { init, gfx: `@gfx ${program.initialSize.width} ${program.initialSize.height}\n${refresh}function __dfx_ui_cancel() (\n__dfx_ui_touch ? (slider_automate(1, 1); __dfx_ui_touch = 0;);\n__dfx_ui_drag = 0;\n);\nfunction __dfx_ui_place() (\n${placement});\n${interaction}` };
}
