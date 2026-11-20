export interface ZonePrice {
  name: string;
  price: number;
}

const HALF_CAP = 25;
const norm = (s: string) => s.trim().toLowerCase();
const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeFee(
  pickup: ZonePrice,
  dropoff: ZonePrice,
  extras: ZonePrice[],
): number {
  const pk = norm(pickup.name);
  const dk = norm(dropoff.name);
  let fee = pk === dk ? dropoff.price : Math.max(pickup.price, dropoff.price);
  const seen = new Map<string, number>();
  for (const x of extras) {
    const key = norm(x.name);
    if (key === pk || key === dk) {
      fee += Math.min(dropoff.price / 2, HALF_CAP);
    } else {
      const n = seen.get(key) ?? 0;
      seen.set(key, n + 1);
      fee += n === 0 ? x.price : Math.min(x.price / 2, HALF_CAP);
    }
  }
  return round2(fee);
}
