import { formatRest, remainingSec, restProgress } from './rest';

describe('remainingSec', () => {
  it('rounds up partial seconds and clamps at 0', () => {
    expect(remainingSec(10_000, 0)).toBe(10);
    expect(remainingSec(10_000, 9_001)).toBe(1);
    expect(remainingSec(10_000, 10_000)).toBe(0);
    expect(remainingSec(10_000, 15_000)).toBe(0);
  });
});

describe('restProgress', () => {
  it('goes from 1 to 0 over the rest', () => {
    expect(restProgress(90_000, 90, 0)).toBe(1);
    expect(restProgress(90_000, 90, 45_000)).toBeCloseTo(0.5);
    expect(restProgress(90_000, 90, 90_000)).toBe(0);
  });
  it('clamps to 0..1 and handles a zero total', () => {
    expect(restProgress(90_000, 90, 100_000)).toBe(0);
    expect(restProgress(90_000, 60, 0)).toBe(1);
    expect(restProgress(90_000, 0, 0)).toBe(0);
  });
});

describe('formatRest', () => {
  it('formats m:ss', () => {
    expect(formatRest(83)).toBe('1:23');
    expect(formatRest(5)).toBe('0:05');
    expect(formatRest(600)).toBe('10:00');
  });
});
