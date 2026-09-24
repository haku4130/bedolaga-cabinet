import { describe, expect, it } from 'vitest';
import { autopayFunding, minRenewalPriceKopeks } from './autopayFunding';

/**
 * Автопродление списывает с баланса. Кабинет не знает точную цену автоплатежа,
 * поэтому сравнивает баланс с самой дешёвой ценой продления и уверенно говорит
 * только о нехватке.
 */
describe('autopayFunding', () => {
  it('цена или баланс неизвестны — не выдумываем', () => {
    expect(autopayFunding(0, null)).toEqual({ state: 'unknown' });
    expect(autopayFunding(undefined, 10900)).toEqual({ state: 'unknown' });
  });

  it('денег меньше самой дешёвой цены — нехватка с суммой', () => {
    expect(autopayFunding(5000, 10900)).toEqual({ state: 'short', missingKopeks: 5900 });
  });

  it('денег не меньше самой дешёвой цены — ок', () => {
    expect(autopayFunding(10900, 10900)).toEqual({ state: 'ok' });
  });
});

describe('minRenewalPriceKopeks', () => {
  it('минимум по положительным ценам', () => {
    expect(minRenewalPriceKopeks([{ price_kopeks: 19900 }, { price_kopeks: 10900 }])).toBe(10900);
  });

  it('нет вариантов или только бесплатные — null', () => {
    expect(minRenewalPriceKopeks(undefined)).toBeNull();
    expect(minRenewalPriceKopeks([])).toBeNull();
    expect(minRenewalPriceKopeks([{ price_kopeks: 0 }])).toBeNull();
  });
});
