import { describe, expect, it } from 'vitest';
import { hasPromoGroupDiscount } from './promoGroupDiscount';

const period = (price: number, original?: number) => ({
  price_kopeks: price,
  original_price_kopeks: original,
});

describe('hasPromoGroupDiscount', () => {
  it('группа без скидок — нет', () => {
    expect(hasPromoGroupDiscount([{ periods: [period(10900), period(19900, 19900)] }])).toBe(false);
    expect(hasPromoGroupDiscount([])).toBe(false);
  });

  it('скидка на период — да', () => {
    expect(hasPromoGroupDiscount([{ periods: [period(9900, 10900)] }])).toBe(true);
  });

  it('скидка на устройства или суточную цену — да', () => {
    expect(hasPromoGroupDiscount([{ periods: [], device_discount_percent: 10 }])).toBe(true);
    expect(hasPromoGroupDiscount([{ periods: [], daily_discount_percent: 5 }])).toBe(true);
  });
});
