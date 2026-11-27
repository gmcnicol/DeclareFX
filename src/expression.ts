import ts from 'typescript';
import type { BinaryOperator, Diagnostic, Expression, Scalar, ScalarType } from './target.js';

export class ExpressionError extends Error {
  constructor(readonly category: Diagnostic['category'], message: string) { super(message); }
}
export const literal = (value: Scalar): Expression => ({ kind: 'literal', type: typeof value as ScalarType, value });

export function lowerExpression(source: string, resolve: (path: string[]) => Expression): Expression {
  const sf = ts.createSourceFile('expression.ts', `(${source})`, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const reject = (category: Diagnostic['category'], message: string): never => { throw new ExpressionError(category, message); };
  const requireType = (e: Expression, type: ScalarType): void => {
    if (e.type !== type) reject('type', `Expected ${type}, found ${e.type}; no implicit coercion is supported.`);
  };
  const path = (n: ts.Expression): string[] => {
    if (n.kind === ts.SyntaxKind.ThisKeyword) return ['this'];
    if (ts.isIdentifier(n)) return [n.text];
    if (ts.isPropertyAccessExpression(n) && !n.questionDotToken) return [...path(n.expression), n.name.text];
    return reject('reference', 'Only statically bound scalar property reads are supported.');
  };
  const parse = (n: ts.Expression): Expression => {
    if (ts.isParenthesizedExpression(n)) return parse(n.expression);
    if (ts.isNumericLiteral(n)) {
      const value = Number(n.text);
      if (!Number.isFinite(value)) return reject('numeric', 'Numeric literals must be finite.');
      return literal(value);
    }
    if (ts.isIdentifier(n) && ['NaN', 'Infinity'].includes(n.text)) return reject('numeric', 'Non-finite numeric inputs are unsupported.');
    if (n.kind === ts.SyntaxKind.TrueKeyword) return literal(true);
    if (n.kind === ts.SyntaxKind.FalseKeyword) return literal(false);
    if (ts.isIdentifier(n) || ts.isPropertyAccessExpression(n) || n.kind === ts.SyntaxKind.ThisKeyword) return resolve(path(n));
    if (ts.isPrefixUnaryExpression(n)) {
      const op = n.operator === ts.SyntaxKind.PlusToken ? '+' : n.operator === ts.SyntaxKind.MinusToken ? '-' : n.operator === ts.SyntaxKind.ExclamationToken ? '!' : undefined;
      if (!op) return reject('unsupported', 'Unsupported unary operator.');
      const operand = parse(n.operand);
      const type = op === '!' ? 'boolean' : 'number';
      requireType(operand, type);
      return { kind: 'unary', op, type, operand };
    }
    if (ts.isBinaryExpression(n)) {
      const op = n.operatorToken.getText(sf) as BinaryOperator;
      if (!['+', '-', '*', '/', '<', '<=', '>', '>=', '===', '!==', '&&', '||'].includes(op)) return reject('unsupported', `Unsupported scalar operator ${op}.`);
      const left = parse(n.left), right = parse(n.right);
      const logical = op === '&&' || op === '||';
      const equality = op === '===' || op === '!==';
      if (equality) requireType(right, left.type);
      else { requireType(left, logical ? 'boolean' : 'number'); requireType(right, left.type); }
      const type = ['+', '-', '*', '/'].includes(op) ? 'number' : 'boolean';
      return { kind: 'binary', op, type, left, right };
    }
    if (ts.isConditionalExpression(n)) {
      const condition = parse(n.condition), then = parse(n.whenTrue), otherwise = parse(n.whenFalse);
      requireType(condition, 'boolean'); requireType(otherwise, then.type);
      return { kind: 'conditional', type: then.type, condition, then, else: otherwise };
    }
    return reject('unsupported', `Unsupported scalar syntax ${ts.SyntaxKind[n.kind]}.`);
  };
  const st = sf.statements[0];
  if (sf.statements.length !== 1 || !st || !ts.isExpressionStatement(st) || !ts.isParenthesizedExpression(st.expression) || st.end !== sf.end) return reject('unsupported', 'Expected exactly one scalar expression.');
  return parse(st.expression.expression);
}

// Compile-time proof only, not an EEL2 executor. Unknown inputs stay unknown.
export function constantValue(e: Expression, known: ReadonlyMap<number, Scalar>): Scalar | undefined {
  const finite = (value: Scalar): Scalar | undefined => {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new ExpressionError('numeric', 'Statically invalid or non-finite arithmetic.');
    // shortcut: proofs below unit-scale roundoff stay unknown; expand only with proof evidence, not a host cutoff.
    return typeof value === 'number' && value !== 0 && Math.abs(value) < Number.EPSILON ? undefined : value;
  };
  if (e.kind === 'literal') return finite(e.value);
  if (e.kind === 'read') return known.get(e.slot);
  if (e.kind === 'unary') {
    const value = constantValue(e.operand, known);
    return value === undefined ? undefined : finite(e.op === '!' ? !value : e.op === '-' ? -(value as number) : +(value as number));
  }
  if (e.kind === 'conditional') {
    const condition = constantValue(e.condition, known);
    if (condition !== undefined) return constantValue(condition ? e.then : e.else, known);
    return undefined;
  }
  const left = constantValue(e.left, known);
  if (e.op === '&&' && left === false) return false;
  if (e.op === '||' && left === true) return true;
  if ((e.op === '&&' || e.op === '||') && left === undefined) return undefined;
  const right = constantValue(e.right, known);
  if (e.op === '/' && right === 0) throw new ExpressionError('numeric', 'Statically provable division by zero.');
  if (left === undefined || right === undefined) return undefined;
  switch (e.op) {
    case '+': return finite((left as number) + (right as number));
    case '-': return finite((left as number) - (right as number));
    case '*': return finite((left as number) * (right as number));
    case '/': {
      const quotient = (left as number) / (right as number);
      return quotient === 0 && left !== 0 ? undefined : finite(quotient);
    }
    case '<': return left < right;
    case '<=': return left <= right;
    case '>': return left > right;
    case '>=': return left >= right;
    case '===': return left === right;
    case '!==': return left !== right;
    case '&&': return left && right;
    case '||': return left || right;
  }
}

export function dependencies(expression: Expression): number[] {
  const result: number[] = [];
  const visit = (e: Expression): void => {
    if (e.kind === 'read' && !result.includes(e.slot)) result.push(e.slot);
    if (e.kind === 'unary') visit(e.operand);
    if (e.kind === 'binary') { visit(e.left); visit(e.right); }
    if (e.kind === 'conditional') { visit(e.condition); visit(e.then); visit(e.else); }
  };
  visit(expression);
  return result;
}
