// @vitest-environment jsdom
import { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, describe, expect, it } from 'vitest';
import type { SubscriptionListItem } from '@/types';
import {
  CONFIRM_AFTER_CREATED_MS,
  CONFIRM_DELAY_MS,
  PENDING_MAX_AGE_MS,
  type PendingCheckout,
  checkoutPaymentKopeks,
  checkoutTopUpPath,
  clearPendingCheckout,
  findCheckoutTarget,
  getCheckoutShortfall,
  loadPendingCheckout,
  resolveCheckoutStatus,
  savePendingCheckout,
  shouldSuppressWsModal,
} from './checkout';

/**
 * «Ожидаемая покупка»: кабинет помнит, что человек платит за подписку, и
 * решает «оплата прошла» только по серверу — дата окончания подписки выросла
 * относительно запомненной до оплаты.
 */

const NOW = 1_800_000_000_000;

const pending = (overrides: Partial<PendingCheckout> = {}): PendingCheckout => ({
  kind: 'purchase',
  tariffId: 7,
  subscriptionId: null,
  periodDays: 30,
  trafficGb: null,
  label: 'Стандартный · 1 месяц',
  priceKopeks: 19900,
  baselineEndDate: '2026-09-01T00:00:00Z',
  createdAt: NOW,
  ...overrides,
});

const sub = (overrides: Partial<SubscriptionListItem> = {}): SubscriptionListItem =>
  ({
    id: 5,
    status: 'active',
    tariff_id: 7,
    tariff_name: 'Стандартный',
    traffic_limit_gb: 0,
    traffic_used_gb: 0,
    device_limit: 3,
    end_date: '2026-09-01T00:00:00Z',
    subscription_url: null,
    subscription_crypto_link: null,
    is_trial: false,
    autopay_enabled: false,
    connected_squads: [],
    ...overrides,
  }) as SubscriptionListItem;

afterEach(() => clearPendingCheckout());

describe('хранение', () => {
  it('сохраняет и читает', () => {
    savePendingCheckout(pending());
    expect(loadPendingCheckout(NOW)).toEqual(pending());
  });

  it('старше часа — забывается', () => {
    savePendingCheckout(pending());
    expect(loadPendingCheckout(NOW + PENDING_MAX_AGE_MS + 1)).toBeNull();
    expect(loadPendingCheckout(NOW)).toBeNull();
  });

  it('мусор в хранилище — null, а не исключение', () => {
    localStorage.setItem('pending_checkout', '{"kind":"x"}');
    expect(loadPendingCheckout(NOW)).toBeNull();
  });
});

describe('findCheckoutTarget', () => {
  it('продление — по id подписки', () => {
    const subs = [sub({ id: 1 }), sub({ id: 5, tariff_id: 9 })];
    expect(findCheckoutTarget({ tariffId: 7, subscriptionId: 5 }, subs)?.id).toBe(5);
  });

  it('покупка — по тарифу', () => {
    const subs = [sub({ id: 1, tariff_id: 3 }), sub({ id: 2, tariff_id: 7 })];
    expect(findCheckoutTarget({ tariffId: 7, subscriptionId: null }, subs)?.id).toBe(2);
  });

  it('смена тарифа у единственной подписки — она и есть цель', () => {
    expect(
      findCheckoutTarget({ tariffId: 7, subscriptionId: null }, [sub({ tariff_id: 3 })])?.id,
    ).toBe(5);
  });

  it('подписок нет — null', () => {
    expect(findCheckoutTarget({ tariffId: 7, subscriptionId: null }, [])).toBeNull();
  });
});

describe('resolveCheckoutStatus', () => {
  const base = { now: NOW, openedAt: NOW };

  it('дата окончания выросла — готово', () => {
    const result = resolveCheckoutStatus({
      ...base,
      pending: pending(),
      subscriptions: [sub({ end_date: '2026-10-01T00:00:00Z' })],
      balanceKopeks: 0,
    });
    expect(result.status).toBe('done');
    expect(result.subscription?.id).toBe(5);
  });

  it('первая подписка появилась — готово', () => {
    const result = resolveCheckoutStatus({
      ...base,
      pending: pending({ baselineEndDate: null }),
      subscriptions: [sub({ end_date: '2026-10-01T00:00:00Z' })],
      balanceKopeks: 0,
    });
    expect(result.status).toBe('done');
  });

  it('дата та же, денег не хватает — ждём', () => {
    const result = resolveCheckoutStatus({
      ...base,
      pending: pending(),
      subscriptions: [sub()],
      balanceKopeks: 5000,
    });
    expect(result.status).toBe('waiting');
  });

  it('деньги есть, но автопокупке ещё не дали времени — ждём', () => {
    const result = resolveCheckoutStatus({
      ...base,
      pending: pending(),
      subscriptions: [sub()],
      balanceKopeks: 19900,
    });
    expect(result.status).toBe('waiting');
  });

  it('деньги есть и прошло время на странице — предлагаем подтвердить', () => {
    const result = resolveCheckoutStatus({
      pending: pending(),
      subscriptions: [sub()],
      balanceKopeks: 19900,
      openedAt: NOW,
      now: NOW + CONFIRM_DELAY_MS,
    });
    expect(result.status).toBe('confirm');
  });

  it('покупка давняя (вернулись позже) — подтверждение сразу', () => {
    const result = resolveCheckoutStatus({
      pending: pending({ createdAt: NOW - CONFIRM_AFTER_CREATED_MS }),
      subscriptions: [sub()],
      balanceKopeks: 19900,
      openedAt: NOW,
      now: NOW,
    });
    expect(result.status).toBe('confirm');
  });

  it('отключённая подписка с новой датой — не успех', () => {
    const result = resolveCheckoutStatus({
      ...base,
      pending: pending(),
      subscriptions: [sub({ status: 'disabled', end_date: '2026-10-01T00:00:00Z' })],
      balanceKopeks: 0,
    });
    expect(result.status).toBe('waiting');
  });
});

describe('getCheckoutShortfall', () => {
  const error402 = (detail: unknown) => {
    const headers = new AxiosHeaders();
    return new AxiosError(
      'Payment Required',
      'ERR_BAD_REQUEST',
      { headers },
      {},
      {
        status: 402,
        statusText: 'Payment Required',
        headers,
        config: { headers },
        data: { detail },
      },
    );
  };

  it('корзина сохранена — недостающая сумма', () => {
    expect(
      getCheckoutShortfall(
        error402({ code: 'insufficient_funds', missing_amount: 4900, cart_saved: true }),
      ),
    ).toBe(4900);
  });

  it('корзина не сохранена — null: автопокупка не сработает, вести на оплату нельзя', () => {
    expect(
      getCheckoutShortfall(error402({ code: 'insufficient_funds', missing_amount: 4900 })),
    ).toBeNull();
  });

  it('другая ошибка — null', () => {
    expect(getCheckoutShortfall(new Error('boom'))).toBeNull();
  });
});

describe('оплата у провайдера', () => {
  it('путь на выбор способа с недостающей суммой в рублях', () => {
    expect(checkoutTopUpPath(4950)).toBe('/balance/top-up?amount=50&purpose=subscription');
  });

  it('сумма ниже минимума способа поднимается до минимума', () => {
    expect(checkoutPaymentKopeks(49, { min_amount_kopeks: 7500 })).toEqual({
      kopeks: 7500,
      raisedToMin: true,
    });
    expect(checkoutPaymentKopeks(199, { min_amount_kopeks: 7500 })).toEqual({
      kopeks: 19900,
      raisedToMin: false,
    });
  });
});

describe('shouldSuppressWsModal', () => {
  it('«Баланс пополнен» посреди оплаты подписки не показываем', () => {
    expect(shouldSuppressWsModal('balance.topup', true, '/')).toBe(true);
    expect(shouldSuppressWsModal('balance.topup', false, '/')).toBe(false);
  });

  it('модалку активации не показываем поверх страницы статуса — она сама всё покажет', () => {
    expect(shouldSuppressWsModal('subscription.activated', false, '/subscription/status')).toBe(
      true,
    );
    expect(shouldSuppressWsModal('subscription.renewed', true, '/subscription/status')).toBe(true);
    expect(shouldSuppressWsModal('subscription.activated', true, '/')).toBe(false);
  });
});
