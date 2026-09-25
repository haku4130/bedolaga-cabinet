import { describe, expect, it } from 'vitest';
import type { PurchaseOptions } from '@/types';
import {
  type HomeStateInput,
  type HomeSubscription,
  getHomeState,
  isNewUserState,
  minPlanPriceKopeks,
} from './homeState';

/**
 * Главная показывает ровно одно главное действие, и выбирается оно здесь.
 * Порядок проверок — это приоритет: загрузка → подарок → мультитариф →
 * нет подписки → проблемы подписки → «скоро кончится» → «нет устройств».
 */

const base: HomeStateInput = {
  isLoading: false,
  hasPendingGifts: false,
  multiTariff: false,
  multiSubscriptionsCount: 0,
  subscription: null,
  trial: undefined,
  connectedDevices: undefined,
  checkoutReady: false,
};

const sub = (overrides: Partial<HomeSubscription> = {}): HomeSubscription => ({
  status: 'active',
  is_trial: false,
  is_expired: false,
  is_limited: false,
  is_daily: false,
  is_daily_paused: false,
  days_left: 30,
  autopay_enabled: false,
  ...overrides,
});

const state = (overrides: Partial<HomeStateInput>) => getHomeState({ ...base, ...overrides });

describe('getHomeState — приоритеты', () => {
  it('загрузка важнее всего', () => {
    expect(state({ isLoading: true, hasPendingGifts: true })).toBe('loading');
  });

  it('деньги за подписку на балансе — первым делом оформить', () => {
    expect(state({ checkoutReady: true, hasPendingGifts: true, subscription: sub() })).toBe(
      'checkout_ready',
    );
  });

  it('загрузка всё равно важнее', () => {
    expect(state({ checkoutReady: true, isLoading: true })).toBe('loading');
  });

  it('непринятый подарок важнее подписки', () => {
    expect(state({ hasPendingGifts: true, subscription: sub() })).toBe('gift_pending');
  });

  it('мультитариф с подписками — список', () => {
    expect(state({ multiTariff: true, multiSubscriptionsCount: 2 })).toBe('multi');
  });

  it('мультитариф без подписок ведёт себя как новичок', () => {
    expect(
      state({ multiTariff: true, trial: { is_available: true, requires_payment: false } }),
    ).toBe('new_trial');
  });
});

describe('getHomeState — нет подписки', () => {
  it('бесплатный триал', () => {
    expect(state({ trial: { is_available: true, requires_payment: false } })).toBe('new_trial');
  });

  it('платный триал', () => {
    expect(state({ trial: { is_available: true, requires_payment: true } })).toBe('new_paid_trial');
  });

  it('триал недоступен или неизвестен', () => {
    expect(state({ trial: { is_available: false, requires_payment: false } })).toBe('new');
    expect(state({})).toBe('new');
  });
});

describe('getHomeState — подписка не работает', () => {
  it('истёкший триал', () => {
    expect(state({ subscription: sub({ is_trial: true, is_expired: true }) })).toBe(
      'expired_trial',
    );
  });

  it('истекла', () => {
    expect(state({ subscription: sub({ is_expired: true }) })).toBe('expired');
    expect(state({ subscription: sub({ status: 'expired' }) })).toBe('expired');
  });

  it('отключена — продлить её нельзя, отдельное состояние', () => {
    expect(state({ subscription: sub({ status: 'disabled' }) })).toBe('disabled');
    expect(state({ subscription: sub({ status: 'disabled', is_expired: true }) })).toBe('disabled');
    expect(state({ subscription: sub({ status: 'disabled', is_trial: true }) })).toBe('disabled');
  });

  it('суточный тариф на паузе или истёкший — своя карточка с мгновенным продлением', () => {
    expect(state({ subscription: sub({ is_daily: true, is_daily_paused: true }) })).toBe(
      'daily_inactive',
    );
    expect(state({ subscription: sub({ is_daily: true, is_expired: true }) })).toBe(
      'daily_inactive',
    );
  });

  it('трафик исчерпан', () => {
    expect(state({ subscription: sub({ is_limited: true }) })).toBe('traffic_exhausted');
  });
});

describe('getHomeState — подписка работает', () => {
  it('осталось ≤ 3 дней без автопродления', () => {
    expect(state({ subscription: sub({ days_left: 3 }) })).toBe('expiring');
  });

  it('с автопродлением не пугаем', () => {
    expect(state({ subscription: sub({ days_left: 1, autopay_enabled: true }) })).toBe('active');
  });

  it('суточный тариф не «истекает»', () => {
    expect(state({ subscription: sub({ is_daily: true, days_left: 0 }) })).toBe('active');
  });

  it('ни одного устройства', () => {
    expect(state({ subscription: sub(), connectedDevices: 0 })).toBe('active_no_devices');
  });

  it('число устройств ещё не загружено — не торопимся с «подключите устройство»', () => {
    expect(state({ subscription: sub(), connectedDevices: undefined })).toBe('active');
  });

  it('скорое окончание важнее отсутствия устройств', () => {
    expect(state({ subscription: sub({ days_left: 2 }), connectedDevices: 0 })).toBe('expiring');
  });
});

describe('isNewUserState', () => {
  it('только состояния без подписки', () => {
    expect(isNewUserState('new')).toBe(true);
    expect(isNewUserState('new_trial')).toBe(true);
    expect(isNewUserState('new_paid_trial')).toBe(true);
    expect(isNewUserState('expired_trial')).toBe(false);
    expect(isNewUserState('active')).toBe(false);
  });
});

describe('minPlanPriceKopeks', () => {
  it('нет данных — null', () => {
    expect(minPlanPriceKopeks(undefined)).toBeNull();
  });

  it('тарифы: минимум по доступным тарифам, нули не считаются', () => {
    const options = {
      sales_mode: 'tariffs',
      tariffs: [
        { is_available: true, periods: [{ price_kopeks: 19900 }, { price_kopeks: 10900 }] },
        { is_available: false, periods: [{ price_kopeks: 5000 }] },
        { is_available: true, periods: [{ price_kopeks: 0 }] },
      ],
    } as unknown as PurchaseOptions;
    expect(minPlanPriceKopeks(options)).toBe(10900);
  });

  it('классика: минимум по доступным периодам', () => {
    const options = {
      sales_mode: 'classic',
      periods: [
        { is_available: false, price_kopeks: 5000 },
        { is_available: true, price_kopeks: 29900 },
      ],
    } as unknown as PurchaseOptions;
    expect(minPlanPriceKopeks(options)).toBe(29900);
  });
});
