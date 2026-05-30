import { ensureArray, ensureFiniteNumber } from './ensure-array.util';

describe('ensureArray', () => {
  it('returns empty array for null and undefined', () => {
    expect(ensureArray(null)).toEqual([]);
    expect(ensureArray(undefined)).toEqual([]);
  });

  it('returns the same array when input is array', () => {
    expect(ensureArray([1, 2])).toEqual([1, 2]);
  });
});

describe('ensureFiniteNumber', () => {
  it('returns fallback for nullish and NaN', () => {
    expect(ensureFiniteNumber(null, 3)).toBe(3);
    expect(ensureFiniteNumber(Number.NaN, 7)).toBe(7);
  });

  it('parses numeric strings', () => {
    expect(ensureFiniteNumber('12.5', 0)).toBe(12.5);
  });
});
