import { computeFee } from './fee';

const A = { name: 'A', price: 30 };
const B = { name: 'B', price: 40 };
const C = { name: 'C', price: 50 };

describe('computeFee', () => {
  it('same zone uses that zone price', () => {
    expect(computeFee(A, A, [])).toBe(30);
  });

  it('different zones use the higher price', () => {
    expect(computeFee(A, B, [])).toBe(40);
    expect(computeFee(B, A, [])).toBe(40);
  });

  it('extra pickup in the pickup zone adds half of the dropoff price', () => {
    expect(computeFee(A, B, [A])).toBe(60);
  });

  it('extra pickup in the dropoff zone adds half of the dropoff price', () => {
    expect(computeFee(A, B, [B])).toBe(60);
  });

  it('half-price addition is capped at 25 (dropoff 70 adds 25 not 35)', () => {
    const D = { name: 'D', price: 70 };
    expect(computeFee(A, D, [A])).toBe(95);
  });

  it('extra pickup in another zone adds its full price', () => {
    expect(computeFee(A, B, [C])).toBe(90);
  });

  it('second extra in the same other zone adds half, capped at 25 each', () => {
    const E = { name: 'E', price: 80 };
    expect(computeFee(A, B, [E, E])).toBe(145);
  });

  it('second and third extras below the cap add exactly half each', () => {
    const F = { name: 'F', price: 30 };
    expect(computeFee(A, B, [F, F])).toBe(85);
    expect(computeFee(A, B, [F, F, F])).toBe(100);
  });

  it('cap applies to each addition, not to the total', () => {
    const E = { name: 'E', price: 80 };
    expect(computeFee(A, B, [E, E, E])).toBe(170);
  });

  it('zone names are compared ignoring case and spaces', () => {
    expect(computeFee({ name: ' a ', price: 30 }, A, [])).toBe(30);
    expect(computeFee(A, B, [{ name: 'a', price: 30 }])).toBe(60);
  });
});
