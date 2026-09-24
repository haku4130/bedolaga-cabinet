import { describe, expect, it } from 'vitest';
import { TOP_LEVEL_PATHS, isNavScreen, moreSectionParent, navItems } from './navItems';

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

  it('«Устройства» — всегда страница подключения: подписку выбирают там', () => {
    expect(navItems()[1]).toEqual({ key: 'devices', path: '/connection' });
  });

  it('TOP_LEVEL_PATHS — ровно разделы меню', () => {
    expect([...TOP_LEVEL_PATHS].sort()).toEqual(
      navItems()
        .map((item) => item.path)
        .sort(),
    );
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

describe('moreSectionParent', () => {
  it('страницы, куда ведёт «Ещё», возвращают туда же', () => {
    for (const path of [
      '/balance',
      '/referral',
      '/wheel',
      '/gift',
      '/contests',
      '/polls',
      '/info',
      '/profile',
      '/news',
    ]) {
      expect(moreSectionParent(path), path).toBe('/more');
    }
    expect(moreSectionParent('/balance/')).toBe('/more');
  });

  it('их вложенные экраны и разделы меню — нет: у них своя навигация', () => {
    for (const path of ['/', '/more', '/connection', '/balance/top-up', '/info/faq']) {
      expect(moreSectionParent(path), path).toBeNull();
    }
  });
});
