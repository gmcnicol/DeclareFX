export const finiteGain = (value: string): string => `__dfx_finite(${value}) ? min(2, max(0, ${value})) : 1`;

// Expand the shortest finite decimal spelling without changing its digits.
export function decimal(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError('Generated numeric literals must be finite.');
  const text = String(value);
  const [coefficient, exponent] = text.split('e');
  if (exponent === undefined) return text;
  const sign = coefficient.startsWith('-') ? '-' : '';
  const unsigned = coefficient.slice(sign.length);
  const point = (unsigned.indexOf('.') < 0 ? unsigned.length : unsigned.indexOf('.')) + Number(exponent);
  const digits = unsigned.replace('.', '');
  if (point <= 0) return `${sign}0.${'0'.repeat(-point)}${digits}`;
  if (point >= digits.length) return sign + digits + '0'.repeat(point - digits.length);
  return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
}
