import { describe, expect, it } from 'vitest';
import { fixedMoney, tidyPriceLabel } from './priceFormat';

describe('fixedMoney', () => {
  it('целую сумму пишет без копеек', () => {
    expect(fixedMoney(109)).toBe('109');
    expect(fixedMoney(0)).toBe('0');
    expect(fixedMoney(1999.001)).toBe('1999');
  });

  it('дробную — с двумя знаками', () => {
    expect(fixedMoney(193.33)).toBe('193.33');
    expect(fixedMoney(452.5)).toBe('452.50');
  });

  it('уважает заданную точность', () => {
    expect(fixedMoney(75, 0)).toBe('75');
    expect(fixedMoney(75.4, 0)).toBe('75');
  });
});

describe('tidyPriceLabel', () => {
  it('убирает нулевые копейки из готовой подписи', () => {
    expect(tidyPriceLabel('109.00 ₽')).toBe('109 ₽');
    expect(tidyPriceLabel('1 999,00 ₽')).toBe('1 999 ₽');
    expect(tidyPriceLabel('+50.00 ₽/мес')).toBe('+50 ₽/мес');
  });

  it('ненулевые копейки и прочий текст не трогает', () => {
    expect(tidyPriceLabel('193.33 ₽')).toBe('193.33 ₽');
    expect(tidyPriceLabel('100.005 ₽')).toBe('100.005 ₽');
    expect(tidyPriceLabel('Бесплатно')).toBe('Бесплатно');
  });
});
