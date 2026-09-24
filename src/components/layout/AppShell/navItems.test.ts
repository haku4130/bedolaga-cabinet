import { describe, expect, it } from 'vitest';
import { TOP_LEVEL_PATHS, isNavScreen, navItems } from './navItems';

/**
 * Одно меню на все платформы: нижний бар на телефоне и шапка на десктопе
 * рисуют один и тот же список. Раньше их было три (бар, бургер, шапка) с
 * разным набором пунктов, и часть разделов на десктопе была недостижима.
 */
describe('navItems', () => {
  it('четыре раздела в фиксированном порядке', () => {
    expect(navItems().map((item) => item.key)).toEqual(['dashboard', 'devices', 'support', 'more']);
    expect(navItems().map((item) => item.path)).toEqual(['/', '/connection', '/support', '/more']);
  });

  it('в мультитарифе «Устройства» ведут на список подписок: /connection не умеет выбирать подписку', () => {
    expect(navItems({ multiTariff: true })[1]).toEqual({ key: 'devices', path: '/subscriptions' });
  });

  it('TOP_LEVEL_PATHS содержит пути обоих вариантов меню', () => {
    for (const item of [...navItems(), ...navItems({ multiTariff: true })]) {
      expect(TOP_LEVEL_PATHS).toContain(item.path);
    }
  });
});

describe('isNavScreen', () => {
  const items = navItems();

  it('экраны разделов — да', () => {
    for (const path of ['/', '/connection', '/support', '/more']) {
      expect(isNavScreen(path, items), path).toBe(true);
    }
  });

  it('хвостовой слеш не мешает', () => {
    expect(isNavScreen('/more/', items)).toBe(true);
  });

  it('вложенные экраны и админка — нет', () => {
    for (const path of [
      '/balance',
      '/connection/qr',
      '/subscriptions/12',
      '/subscription/purchase',
      '/admin',
    ]) {
      expect(isNavScreen(path, items), path).toBe(false);
    }
  });
});
