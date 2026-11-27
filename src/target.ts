export interface Location { file: string; line: number; column: number }
export interface Diagnostic {
  severity: 'error' | 'warning';
  category: 'upstream' | 'unsupported' | 'type' | 'reference' | 'cycle' | 'binding' | 'numeric' | 'text' | 'resource' | 'compatibility';
  code: string;
  message: string;
  location?: Location;
  field?: string;
}
export type Scalar = number | boolean;
export type ScalarType = 'number' | 'boolean';
export type BinaryOperator = '+' | '-' | '*' | '/' | '<' | '<=' | '>' | '>=' | '===' | '!==' | '&&' | '||';
export type Expression =
  | { kind: 'literal'; type: ScalarType; value: Scalar }
  | { kind: 'read'; type: ScalarType; slot: number }
  | { kind: 'unary'; type: ScalarType; op: '+' | '-' | '!'; operand: Expression }
  | { kind: 'binary'; type: ScalarType; op: BinaryOperator; left: Expression; right: Expression }
  | { kind: 'conditional'; type: ScalarType; condition: Expression; then: Expression; else: Expression };
export interface Slot {
  id: number;
  type: ScalarType;
  input?: 'viewportWidth' | 'viewportHeight' | 'gain';
  expression?: Expression;
  initial: Scalar;
  dependencies: number[];
  invalid: 'retain' | 'safeGain';
  nonNegative: boolean;
  location: Location;
}
export interface TargetNode {
  id: number;
  kind: 'App' | 'View' | 'Text';
  name: string | null;
  parent: number | null;
  geometry: Record<'x' | 'y' | 'width' | 'height', number>;
  fill?: string;
  text?: string;
}
export interface TargetProgram {
  subset: 1;
  initialSize: { width: number; height: number };
  nodes: TargetNode[];
  slots: Slot[];
  order: number[];
  binding: { rootState: 'gain'; nativeSlot: 1; min: 0; max: 2; default: number; stateSlot: number; control: number; controlPath: string[] };
}
export type CompileResult =
  | { ok: true; program: TargetProgram; diagnostics: Diagnostic[] }
  | { ok: false; diagnostics: Diagnostic[] };
