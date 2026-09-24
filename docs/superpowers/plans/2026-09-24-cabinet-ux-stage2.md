# Редизайн кабинета, этап 2: оплата без «сначала пополните баланс» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Человек нажимает «Оплатить 199 ₽», платит у провайдера и видит «Оплата прошла → Подключить устройство», а не страницу баланса. Слово «пополнить» в сценарии покупки не встречается.

**Architecture:** Бэкенд уже умеет: на 402 `insufficient_funds` из `/purchase-tariff` и `/renew` он сохраняет корзину (`cart_saved: true`), а после зачисления денег при `AUTO_PURCHASE_AFTER_TOPUP_ENABLED=true` сам покупает её и шлёт WS `subscription.activated/renewed`. Кабинет запоминает «ожидаемую покупку» (`pending_checkout` в localStorage), ведёт на существующие экраны пополнения в режиме «оплата подписки» (вся логика провайдеров — Stars, опции СБП/карта, открытие во внешнем браузере — переиспользуется), а новая страница `/subscription/status` ждёт, пока подписка на сервере действительно продлится, и показывает успех. Если автопокупка не сработала — там же кнопка «Оформить за 199 ₽» (и та же карточка на главной).

**Tech Stack:** React 19, React Router, TanStack Query, Zustand, Tailwind, i18next, Vitest + Testing Library (jsdom), Biome.

**Spec:** `docs/superpowers/specs/2026-09-24-cabinet-ux-redesign-design.md`, раздел 6. Макеты «3. Оплата» и «4. После оплаты»: https://claude.ai/artifact/X8tnej9qiwm1mt3xTYewxK

## Global Constraints

- Бэкенд бота не меняется. Предусловие для «оплатил → подписка включилась сама»: в боте `AUTO_PURCHASE_AFTER_TOPUP_ENABLED=true` (админка → настройки → оплата → «Автопокупка после пополнения»). Без неё кабинет обязан работать: страница статуса предложит «Оформить за …».
- Решение «оплата прошла» принимается только по данным сервера (дата окончания подписки выросла относительно запомненной до оплаты), не по параметрам URL.
- Каждая новая строка — ключ i18n в неймспейсе `checkout.*` в `ru.json` и `en.json` (паритет проверяет `src/locales/locales.test.ts`), в `zh.json`/`fa.json` — английский текст. Ключи добавляются скриптом `node scripts/add-locale-keys.mjs <fragment.json>`.
- Новая логика — в новых файлах (`src/utils/checkout.ts`, `src/hooks/useCheckout.ts`, `src/pages/CheckoutStatus.tsx`); правки существующих экранов — точечные.
- Вне этого этапа (поведение не меняется): суточные тарифы, классический режим продаж (`ClassicPurchaseWizard`), кнопки SBP/Lava-автоплатежа (остаются отдельными кнопками), платный триал, докупка трафика/устройств.
- Тесты компонентов: `// @vitest-environment jsdom`, мок `react-i18next` возвращает ключ. Команды: `npm test -- <путь>`, `npm run type-check`, `npm run lint`, `npm run build`.
- Коммиты: `feat(checkout): …` по-русски.

## File Structure

| Файл | Статус | Ответственность |
|---|---|---|
| `src/utils/checkout.ts` (+ `checkout.test.ts`) | новый | `pending_checkout`: хранение, поиск целевой подписки, статус «ждём / подтвердить / готово», сумма платежа с учётом минимума, путь на оплату, подавление WS-модалок |
| `src/hooks/useCheckout.ts` (+ `useCheckout.test.tsx`) | новый | «Оплатить»: запомнить покупку → списать с баланса → успех / 402 → оплата у провайдера |
| `src/components/subscription/purchase/TariffPurchaseForm.tsx` | изменить | Кнопка «Оплатить …», строка «С баланса», без «Пополнить баланс» (только обычные тарифы) |
| `src/pages/RenewSubscription.tsx` | изменить | То же для продления |
| `src/pages/TopUpMethodSelect.tsx`, `src/pages/TopUpAmount.tsx` | изменить | Режим `purpose=subscription`: «Оплата подписки», сумма зафиксирована, после оплаты — на `/subscription/status` |
| `src/pages/TopUpResult.tsx` | изменить | Оплата прошла и есть `pending_checkout` → `/subscription/status` |
| `src/components/WebSocketNotifications.tsx` | изменить | Не показывать «Баланс пополнен» посреди оплаты подписки |
| `src/pages/CheckoutStatus.tsx` (+ `checkoutStatus.test.tsx`) | новый | Ожидание, подтверждение, успех с «Подключить устройство» |
| `src/App.tsx` | изменить | Маршрут `/subscription/status` |
| `src/utils/homeState.ts` (+ тест), `src/components/dashboard/home/CheckoutReadyHero.tsx`, `src/pages/Dashboard.tsx` | изменить / новый | Состояние главной `checkout_ready`: «Деньги зачислены — осталось оформить» |

---

### Task 1: Модель «ожидаемой покупки»

**Files:**
- Create: `src/utils/checkout.ts`
- Test: `src/utils/checkout.test.ts`

**Interfaces:**
- Produces:
  - `type CheckoutKind = 'purchase' | 'renew'`
  - `interface PendingCheckout { kind: CheckoutKind; tariffId: number | null; subscriptionId: number | null; periodDays: number; trafficGb: number | null; label: string; priceKopeks: number; baselineEndDate: string | null; createdAt: number }`
  - `savePendingCheckout(p: PendingCheckout): void`, `loadPendingCheckout(now?: number): PendingCheckout | null`, `clearPendingCheckout(): void`
  - `findCheckoutTarget(p: Pick<PendingCheckout, 'tariffId' | 'subscriptionId'>, subs: SubscriptionListItem[]): SubscriptionListItem | null`
  - `type CheckoutStatusKind = 'waiting' | 'confirm' | 'done'`
  - `resolveCheckoutStatus(input: { pending: PendingCheckout; subscriptions: SubscriptionListItem[]; balanceKopeks: number | undefined; now: number; openedAt: number }): { status: CheckoutStatusKind; subscription: SubscriptionListItem | null }`
  - `getCheckoutShortfall(error: unknown): number | null` — копейки, только если бэкенд сохранил корзину
  - `checkoutTopUpPath(missingKopeks: number): string`
  - `checkoutPaymentKopeks(requestedRubles: number, method: Pick<PaymentMethod, 'min_amount_kopeks'>): { kopeks: number; raisedToMin: boolean }`
  - `shouldSuppressWsModal(type: string, hasPendingCheckout: boolean, pathname: string): boolean`
  - константы `CHECKOUT_PURPOSE = 'subscription'`, `CHECKOUT_STATUS_PATH = '/subscription/status'`, `PENDING_MAX_AGE_MS`, `CONFIRM_DELAY_MS`, `CONFIRM_AFTER_CREATED_MS`

- [ ] **Step 1: Написать падающий тест**

`src/utils/checkout.test.ts`:

```ts
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
    expect(findCheckoutTarget({ tariffId: 7, subscriptionId: null }, [sub({ tariff_id: 3 })])?.id).toBe(5);
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
    return new AxiosError('Payment Required', 'ERR_BAD_REQUEST', { headers }, {}, {
      status: 402,
      statusText: 'Payment Required',
      headers,
      config: { headers },
      data: { detail },
    });
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
    expect(shouldSuppressWsModal('subscription.activated', false, '/subscription/status')).toBe(true);
    expect(shouldSuppressWsModal('subscription.renewed', true, '/subscription/status')).toBe(true);
    expect(shouldSuppressWsModal('subscription.activated', true, '/')).toBe(false);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test -- src/utils/checkout.test.ts`
Expected: FAIL — `Failed to resolve import "./checkout"`.

- [ ] **Step 3: Реализация**

`src/utils/checkout.ts`:

```ts
import { AxiosError } from 'axios';
import type { PaymentMethod, SubscriptionListItem } from '@/types';
import { safeLocal } from './safeStorage';

/**
 * «Ожидаемая покупка» подписки. Живёт, пока человек платит у провайдера:
 * по ней страница статуса понимает, что именно ждать, а главная — что деньги
 * пришли ради подписки, а не просто на баланс.
 */
export type CheckoutKind = 'purchase' | 'renew';

export interface PendingCheckout {
  kind: CheckoutKind;
  tariffId: number | null;
  /** Продление конкретной подписки; null — покупка из каталога. */
  subscriptionId: number | null;
  periodDays: number;
  /** Свой объём трафика (тарифы с custom_traffic_enabled); null — как в тарифе. */
  trafficGb: number | null;
  /** «Стандартный · 1 месяц» — для экранов оплаты и подтверждения. */
  label: string;
  priceKopeks: number;
  /** Дата окончания целевой подписки до оплаты; null — подписки не было. */
  baselineEndDate: string | null;
  createdAt: number;
}

export const CHECKOUT_PURPOSE = 'subscription';
export const CHECKOUT_STATUS_PATH = '/subscription/status';
/** Старше — забываем: оплата давно брошена или прошла мимо кабинета. */
export const PENDING_MAX_AGE_MS = 60 * 60 * 1000;
/** Сколько даём автопокупке бота, прежде чем предложить оформить вручную. */
export const CONFIRM_DELAY_MS = 30_000;
/** Вернулись к давней покупке — автопокупка уже не случится, предлагаем сразу. */
export const CONFIRM_AFTER_CREATED_MS = 2 * 60 * 1000;

const STORAGE_KEY = 'pending_checkout';

export function savePendingCheckout(pending: PendingCheckout): void {
  safeLocal.setJson(STORAGE_KEY, pending);
}

export function clearPendingCheckout(): void {
  safeLocal.removeItem(STORAGE_KEY);
}

export function loadPendingCheckout(now: number = Date.now()): PendingCheckout | null {
  const raw = safeLocal.getJson<Partial<PendingCheckout> | null>(STORAGE_KEY, null);
  if (
    !raw ||
    (raw.kind !== 'purchase' && raw.kind !== 'renew') ||
    typeof raw.periodDays !== 'number' ||
    typeof raw.priceKopeks !== 'number' ||
    typeof raw.createdAt !== 'number' ||
    typeof raw.label !== 'string'
  ) {
    return null;
  }
  if (now - raw.createdAt > PENDING_MAX_AGE_MS) {
    clearPendingCheckout();
    return null;
  }
  return {
    kind: raw.kind,
    tariffId: raw.tariffId ?? null,
    subscriptionId: raw.subscriptionId ?? null,
    periodDays: raw.periodDays,
    trafficGb: raw.trafficGb ?? null,
    label: raw.label,
    priceKopeks: raw.priceKopeks,
    baselineEndDate: raw.baselineEndDate ?? null,
    createdAt: raw.createdAt,
  };
}

/** Подписка, которую продлевает эта покупка. */
export function findCheckoutTarget(
  pending: Pick<PendingCheckout, 'tariffId' | 'subscriptionId'>,
  subscriptions: SubscriptionListItem[],
): SubscriptionListItem | null {
  if (pending.subscriptionId !== null) {
    return subscriptions.find((sub) => sub.id === pending.subscriptionId) ?? null;
  }
  const byTariff = subscriptions.find((sub) => sub.tariff_id === pending.tariffId);
  if (byTariff) return byTariff;
  // Одиночный режим: покупка другого тарифа меняет тариф у единственной подписки.
  return subscriptions.length === 1 ? subscriptions[0] : null;
}

export type CheckoutStatusKind = 'waiting' | 'confirm' | 'done';

const INACTIVE_STATUSES = new Set(['expired', 'disabled']);

export function resolveCheckoutStatus(input: {
  pending: PendingCheckout;
  subscriptions: SubscriptionListItem[];
  balanceKopeks: number | undefined;
  now: number;
  openedAt: number;
}): { status: CheckoutStatusKind; subscription: SubscriptionListItem | null } {
  const { pending } = input;
  const target = findCheckoutTarget(pending, input.subscriptions);

  const extended =
    target !== null &&
    target.end_date !== null &&
    !INACTIVE_STATUSES.has(target.status) &&
    (pending.baselineEndDate === null ||
      Date.parse(target.end_date) > Date.parse(pending.baselineEndDate));
  if (extended) return { status: 'done', subscription: target };

  const enoughMoney = input.balanceKopeks !== undefined && input.balanceKopeks >= pending.priceKopeks;
  const gaveAutoPurchaseTime =
    input.now - input.openedAt >= CONFIRM_DELAY_MS ||
    input.now - pending.createdAt >= CONFIRM_AFTER_CREATED_MS;
  if (enoughMoney && gaveAutoPurchaseTime) return { status: 'confirm', subscription: target };

  return { status: 'waiting', subscription: target };
}

/**
 * Сколько не хватает (копейки) — только если бэкенд сохранил корзину. Без
 * корзины автопокупка после оплаты не сработает, и уводить на оплату нельзя.
 */
export function getCheckoutShortfall(error: unknown): number | null {
  if (!(error instanceof AxiosError)) return null;
  const detail = error.response?.data?.detail;
  if (
    typeof detail === 'object' &&
    detail !== null &&
    detail.code === 'insufficient_funds' &&
    detail.cart_saved === true &&
    typeof detail.missing_amount === 'number' &&
    detail.missing_amount > 0
  ) {
    return detail.missing_amount;
  }
  return null;
}

export function checkoutTopUpPath(missingKopeks: number): string {
  const params = new URLSearchParams({
    amount: String(Math.ceil(missingKopeks / 100)),
    purpose: CHECKOUT_PURPOSE,
  });
  return `/balance/top-up?${params.toString()}`;
}

/** Сумма платежа: недостающее, но не меньше минимума способа оплаты. */
export function checkoutPaymentKopeks(
  requestedRubles: number,
  method: Pick<PaymentMethod, 'min_amount_kopeks'>,
): { kopeks: number; raisedToMin: boolean } {
  const requested = Math.round(requestedRubles * 100);
  if (requested < method.min_amount_kopeks) {
    return { kopeks: method.min_amount_kopeks, raisedToMin: true };
  }
  return { kopeks: requested, raisedToMin: false };
}

/**
 * «Баланс пополнен» посреди оплаты подписки — ровно та фраза, из-за которой
 * люди думали, что уже купили подписку. А поверх страницы статуса модалки
 * активации лишние: она сама показывает успех.
 */
export function shouldSuppressWsModal(
  type: string,
  hasPendingCheckout: boolean,
  pathname: string,
): boolean {
  if (type === 'balance.topup') return hasPendingCheckout;
  if (type === 'subscription.activated' || type === 'subscription.renewed') {
    return pathname === CHECKOUT_STATUS_PATH;
  }
  return false;
}
```

- [ ] **Step 4: Прогнать тесты**

Run: `npm test -- src/utils/checkout.test.ts && npm run type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/checkout.ts src/utils/checkout.test.ts
git commit -m "feat(checkout): модель ожидаемой покупки и статус оплаты по данным сервера"
```

---

### Task 2: Хук «Оплатить»

**Files:**
- Create: `src/hooks/useCheckout.ts`
- Test: `src/hooks/useCheckout.test.tsx`

**Interfaces:**
- Consumes: всё из `src/utils/checkout.ts` (задача 1); `subscriptionApi.getSubscriptions(): Promise<SubscriptionsListResponse>`.
- Produces:

```ts
interface CheckoutRequest {
  kind: CheckoutKind;
  tariffId: number | null;
  subscriptionId: number | null;
  periodDays: number;
  trafficGb: number | null;
  label: string;
  priceKopeks: number;
  /** Списание с баланса: purchaseTariff или renewSubscription. */
  pay: () => Promise<unknown>;
}
function useCheckout(): { start: (request: CheckoutRequest) => void; isPending: boolean; error: unknown; reset: () => void }
```

Поведение `start`: свежий список подписок → запомнить `pending_checkout` с `baselineEndDate` цели → `pay()`. Успех — `navigate(CHECKOUT_STATUS_PATH, { replace: true })`. 402 с `cart_saved` — `navigate(checkoutTopUpPath(missing))`, покупка остаётся запомненной. Любая другая ошибка — забыть покупку, отдать ошибку в `error`.

- [ ] **Step 1: Написать падающий тест**

`src/hooks/useCheckout.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearPendingCheckout, loadPendingCheckout } from '@/utils/checkout';

/**
 * «Оплатить»: хватает денег — списываем и ведём на статус; не хватает —
 * ведём на оплату у провайдера, помня, ради чего платят.
 */

vi.mock('@/api/subscription', () => ({
  subscriptionApi: {
    getSubscriptions: async () => ({
      multi_tariff_enabled: false,
      subscriptions: [{ id: 5, tariff_id: 7, status: 'active', end_date: '2026-09-01T00:00:00Z' }],
    }),
  },
}));

afterEach(() => {
  cleanup();
  clearPendingCheckout();
});

function error402(cartSaved: boolean) {
  const headers = new AxiosHeaders();
  return new AxiosError('Payment Required', 'ERR_BAD_REQUEST', { headers }, {}, {
    status: 402,
    statusText: 'Payment Required',
    headers,
    config: { headers },
    data: {
      detail: { code: 'insufficient_funds', missing_amount: 4950, cart_saved: cartSaved },
    },
  });
}

let started: ReturnType<typeof import('./useCheckout').useCheckout> | null = null;

function Location() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname + location.search}</span>;
}

async function mount() {
  const { useCheckout } = await import('./useCheckout');
  function Probe() {
    started = useCheckout();
    return null;
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/subscription/purchase']}>
        <Probe />
        <Routes>
          <Route path="*" element={<Location />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const request = (pay: () => Promise<unknown>) => ({
  kind: 'purchase' as const,
  tariffId: 7,
  subscriptionId: null,
  periodDays: 30,
  trafficGb: null,
  label: 'Стандартный · 1 месяц',
  priceKopeks: 19900,
  pay,
});

describe('useCheckout', () => {
  it('денег хватает — статус оплаты, покупка запомнена с датой до оплаты', async () => {
    await mount();
    act(() => started?.start(request(async () => ({ success: true }))));
    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toBe('/subscription/status'),
    );
    expect(loadPendingCheckout()?.baselineEndDate).toBe('2026-09-01T00:00:00Z');
  });

  it('не хватает и корзина сохранена — оплата у провайдера на недостающее', async () => {
    await mount();
    act(() =>
      started?.start(
        request(async () => {
          throw error402(true);
        }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toBe(
        '/balance/top-up?amount=50&purpose=subscription',
      ),
    );
    expect(loadPendingCheckout()).not.toBeNull();
  });

  it('корзина не сохранена — ошибка на месте, покупка забыта', async () => {
    await mount();
    act(() =>
      started?.start(
        request(async () => {
          throw error402(false);
        }),
      ),
    );
    await waitFor(() => expect(started?.error).toBeTruthy());
    expect(screen.getByTestId('location').textContent).toBe('/subscription/purchase');
    expect(loadPendingCheckout()).toBeNull();
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test -- src/hooks/useCheckout.test.tsx`
Expected: FAIL — `Failed to resolve import "./useCheckout"`.

- [ ] **Step 3: Реализация**

`src/hooks/useCheckout.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { subscriptionApi } from '@/api/subscription';
import {
  CHECKOUT_STATUS_PATH,
  type CheckoutKind,
  checkoutTopUpPath,
  clearPendingCheckout,
  findCheckoutTarget,
  getCheckoutShortfall,
  savePendingCheckout,
} from '@/utils/checkout';

export interface CheckoutRequest {
  kind: CheckoutKind;
  tariffId: number | null;
  subscriptionId: number | null;
  periodDays: number;
  trafficGb: number | null;
  label: string;
  priceKopeks: number;
  /** Списание с баланса: purchaseTariff или renewSubscription. */
  pay: () => Promise<unknown>;
}

type CheckoutOutcome = { outcome: 'paid' } | { outcome: 'top_up'; missingKopeks: number };

/**
 * «Оплатить»: запомнить, ради чего платят, списать с баланса; если денег не
 * хватает и бэкенд сохранил корзину — оплатить недостающее у провайдера.
 */
export function useCheckout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation<CheckoutOutcome, unknown, CheckoutRequest>({
    mutationFn: async (request) => {
      const list = await queryClient.fetchQuery({
        queryKey: ['subscriptions-list'],
        queryFn: () => subscriptionApi.getSubscriptions(),
        staleTime: 0,
      });
      const target = findCheckoutTarget(request, list.subscriptions ?? []);
      savePendingCheckout({
        kind: request.kind,
        tariffId: request.tariffId,
        subscriptionId: request.subscriptionId,
        periodDays: request.periodDays,
        trafficGb: request.trafficGb,
        label: request.label,
        priceKopeks: request.priceKopeks,
        baselineEndDate: target?.end_date ?? null,
        createdAt: Date.now(),
      });

      try {
        await request.pay();
        return { outcome: 'paid' };
      } catch (error) {
        const missingKopeks = getCheckoutShortfall(error);
        if (missingKopeks !== null) return { outcome: 'top_up', missingKopeks };
        clearPendingCheckout();
        throw error;
      }
    },
    onSuccess: (result) => {
      if (result.outcome === 'paid') {
        queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) && query.queryKey[0] === 'subscription',
        });
        queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
        queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
        queryClient.invalidateQueries({ queryKey: ['balance'] });
        navigate(CHECKOUT_STATUS_PATH, { replace: true });
      } else {
        navigate(checkoutTopUpPath(result.missingKopeks));
      }
    },
  });

  return {
    start: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
```

- [ ] **Step 4: Прогнать тесты**

Run: `npm test -- src/hooks/useCheckout.test.tsx && npm run type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCheckout.ts src/hooks/useCheckout.test.tsx
git commit -m "feat(checkout): «Оплатить» — списание с баланса или оплата недостающего у провайдера"
```

---

### Task 3: Страница статуса оплаты

**Files:**
- Create: `src/pages/CheckoutStatus.tsx`
- Test: `src/pages/checkoutStatus.test.tsx`
- Modify: `src/App.tsx` (ленивый импорт и маршрут)
- Modify: `src/locales/*.json` (через скрипт)

**Interfaces:**
- Consumes: `loadPendingCheckout`, `clearPendingCheckout`, `resolveCheckoutStatus`, `getCheckoutShortfall`, `checkoutTopUpPath` (задача 1); `SetupSteps` (`src/components/dashboard/home/SetupSteps.tsx`); `useHomeFormat` (`src/components/dashboard/home/useHomeFormat.ts`).
- Produces: маршрут `/subscription/status`; ключи `checkout.*`.

- [ ] **Step 1: Ключи**

```bash
cat > /tmp/stage2-checkout.json <<'EOF'
{
  "ru": { "checkout": {
    "pay": "Оплатить {{amount}}",
    "payFromBalance": "Оплатить {{amount}} с баланса",
    "fromBalance": "С баланса",
    "toPay": "К оплате",
    "autoActivateHint": "Подписка включится сразу после оплаты. Пополнять баланс отдельно не нужно.",
    "paymentTitle": "Оплата подписки",
    "chooseMethod": "Как оплатить",
    "raisedToMin": "Минимальный платёж — {{min}}. Остаток {{rest}} останется на балансе.",
    "toHome": "На главную",
    "waiting": {
      "title": "Ждём подтверждение оплаты",
      "desc": "Как только платёж пройдёт, подписка включится автоматически. Обычно это меньше минуты.",
      "backToPayment": "Вернуться к оплате"
    },
    "confirm": {
      "title": "Деньги зачислены",
      "desc": "Осталось оформить подписку «{{label}}» — спишем {{price}} с баланса.",
      "cta": "Оформить за {{price}}"
    },
    "done": {
      "title": "Оплата прошла",
      "until": "Подписка активна до {{date}}",
      "lastStepTitle": "Остался последний шаг",
      "lastStepDesc": "Подключите устройство — это займёт около минуты. Без этого шага VPN работать не будет.",
      "connect": "Подключить устройство",
      "later": "Сделаю позже"
    },
    "ready": {
      "title": "Деньги зачислены — осталось оформить подписку",
      "desc": "{{label}} за {{price}}. Оплата уже на вашем балансе.",
      "cta": "Оформить подписку",
      "dismiss": "Не сейчас"
    }
  } },
  "en": { "checkout": {
    "pay": "Pay {{amount}}",
    "payFromBalance": "Pay {{amount}} from balance",
    "fromBalance": "From balance",
    "toPay": "To pay",
    "autoActivateHint": "Your subscription starts right after payment. No need to top up your balance separately.",
    "paymentTitle": "Subscription payment",
    "chooseMethod": "How to pay",
    "raisedToMin": "Minimum payment is {{min}}. The remaining {{rest}} stays on your balance.",
    "toHome": "Go home",
    "waiting": {
      "title": "Waiting for payment confirmation",
      "desc": "As soon as the payment goes through, your subscription starts automatically. Usually it takes less than a minute.",
      "backToPayment": "Back to payment"
    },
    "confirm": {
      "title": "Money received",
      "desc": "One step left: activate \"{{label}}\" — we'll charge {{price}} from your balance.",
      "cta": "Activate for {{price}}"
    },
    "done": {
      "title": "Payment successful",
      "until": "Subscription active until {{date}}",
      "lastStepTitle": "One step left",
      "lastStepDesc": "Connect a device — it takes about a minute. The VPN won't work without it.",
      "connect": "Connect a device",
      "later": "Later"
    },
    "ready": {
      "title": "Money received — activate your subscription",
      "desc": "{{label}} for {{price}}. The money is already on your balance.",
      "cta": "Activate subscription",
      "dismiss": "Not now"
    }
  } }
}
EOF
node -e "const f=require('/tmp/stage2-checkout.json');f.zh=f.en;f.fa=f.en;require('fs').writeFileSync('/tmp/stage2-checkout.json',JSON.stringify(f))"
node scripts/add-locale-keys.mjs /tmp/stage2-checkout.json
```

- [ ] **Step 2: Написать падающий тест**

`src/pages/checkoutStatus.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformProvider } from '@/platform/PlatformProvider';
import {
  CONFIRM_AFTER_CREATED_MS,
  clearPendingCheckout,
  loadPendingCheckout,
  savePendingCheckout,
} from '@/utils/checkout';

/**
 * После оплаты человек видит одно из трёх: ждём платёж; деньги пришли, но
 * автопокупка не сработала — «Оформить»; готово — «Подключить устройство».
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ru', changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({ formatWithCurrency: (value: number) => `${value} ₽` }),
}));

const api = vi.hoisted(() => ({
  endDate: '2026-09-01T00:00:00Z',
  balance: 0,
  purchaseTariff: vi.fn(async () => ({ success: true })),
}));

vi.mock('@/api/subscription', () => ({
  subscriptionApi: {
    getSubscriptions: async () => ({
      multi_tariff_enabled: false,
      subscriptions: [{ id: 5, tariff_id: 7, status: 'active', end_date: api.endDate }],
    }),
    purchaseTariff: api.purchaseTariff,
    renewSubscription: vi.fn(),
  },
}));
vi.mock('@/api/balance', () => ({
  balanceApi: {
    getBalance: async () => ({ balance_kopeks: api.balance, balance_rubles: api.balance / 100 }),
  },
}));

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const seed = (createdAt = Date.now()) =>
  savePendingCheckout({
    kind: 'purchase',
    tariffId: 7,
    subscriptionId: null,
    periodDays: 30,
    trafficGb: null,
    label: 'Стандартный · 1 месяц',
    priceKopeks: 19900,
    baselineEndDate: '2026-09-01T00:00:00Z',
    createdAt,
  });

beforeEach(() => {
  api.endDate = '2026-09-01T00:00:00Z';
  api.balance = 0;
  api.purchaseTariff.mockClear();
});

afterEach(() => {
  cleanup();
  clearPendingCheckout();
});

async function renderStatus() {
  const CheckoutStatus = (await import('./CheckoutStatus')).default;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PlatformProvider>
        <MemoryRouter initialEntries={['/subscription/status']}>
          <CheckoutStatus />
        </MemoryRouter>
      </PlatformProvider>
    </QueryClientProvider>,
  );
}

describe('страница статуса оплаты', () => {
  it('подписка продлилась — успех, «Подключить устройство», покупка забыта', async () => {
    seed();
    api.endDate = '2026-10-01T00:00:00Z';
    await renderStatus();
    await waitFor(() => expect(screen.getByText('checkout.done.title')).toBeTruthy());
    expect(screen.getByText('checkout.done.connect').closest('a')?.getAttribute('href')).toBe(
      '/connection?sub=5',
    );
    expect(loadPendingCheckout()).toBeNull();
  });

  it('платёж ещё не дошёл — ждём', async () => {
    seed();
    await renderStatus();
    await waitFor(() => expect(screen.getByText('checkout.waiting.title')).toBeTruthy());
  });

  it('деньги пришли, автопокупки не было — «Оформить» покупает запомненное', async () => {
    seed(Date.now() - CONFIRM_AFTER_CREATED_MS);
    api.balance = 19900;
    await renderStatus();
    const cta = await screen.findByText('checkout.confirm.cta');
    fireEvent.click(cta);
    await waitFor(() => expect(api.purchaseTariff).toHaveBeenCalledWith(7, 30, undefined, undefined));
  });
});
```

- [ ] **Step 3: Убедиться, что тест падает**

Run: `npm test -- src/pages/checkoutStatus.test.tsx`
Expected: FAIL — `Failed to resolve import "./CheckoutStatus"`.

- [ ] **Step 4: Реализация**

`src/pages/CheckoutStatus.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { subscriptionApi } from '@/api/subscription';
import { balanceApi } from '@/api/balance';
import { useHaptic } from '@/platform';
import { AnimatedCheckmark } from '@/components/ui/AnimatedCheckmark';
import { Spinner } from '@/components/ui/Spinner';
import { SetupSteps } from '@/components/dashboard/home/SetupSteps';
import { useHomeFormat } from '@/components/dashboard/home/useHomeFormat';
import { getErrorMessage } from '@/utils/subscriptionHelpers';
import {
  type PendingCheckout,
  checkoutTopUpPath,
  clearPendingCheckout,
  getCheckoutShortfall,
  loadPendingCheckout,
  resolveCheckoutStatus,
} from '@/utils/checkout';

const POLL_MS = 3_000;
const PRIMARY =
  'btn-primary flex w-full items-center justify-center gap-2 py-3.5 text-base font-semibold';
const QUIET =
  'flex min-h-[44px] w-full items-center justify-center text-[15px] font-medium text-dark-400 hover:text-dark-200';

function paymentPathFor(pending: PendingCheckout): string {
  return pending.kind === 'renew' && pending.subscriptionId !== null
    ? `/subscriptions/${pending.subscriptionId}/renew`
    : '/subscription/purchase';
}

/**
 * После «Оплатить»: ждём, пока подписка на сервере действительно продлится,
 * и ведём к подключению устройства. Если автопокупка не сработала, а деньги
 * на балансе — даём оформить в одно нажатие.
 */
export default function CheckoutStatus() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const haptic = useHaptic();
  const format = useHomeFormat();
  const [pending] = useState(() => loadPendingCheckout());
  const [openedAt] = useState(() => Date.now());
  const [done, setDone] = useState(false);
  const cleanedUp = useRef(false);

  const { data: list } = useQuery({
    queryKey: ['subscriptions-list'],
    queryFn: () => subscriptionApi.getSubscriptions(),
    refetchInterval: done ? false : POLL_MS,
    enabled: pending !== null,
  });
  const { data: balance } = useQuery({
    queryKey: ['balance'],
    queryFn: balanceApi.getBalance,
    refetchInterval: done ? false : POLL_MS,
    enabled: pending !== null,
  });

  const result = pending
    ? resolveCheckoutStatus({
        pending,
        subscriptions: list?.subscriptions ?? [],
        balanceKopeks: balance?.balance_kopeks,
        now: Date.now(),
        openedAt,
      })
    : null;

  useEffect(() => {
    if (result?.status !== 'done' || cleanedUp.current) return;
    cleanedUp.current = true;
    setDone(true);
    clearPendingCheckout();
    haptic.notification('success');
    queryClient.invalidateQueries({
      predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'subscription',
    });
    queryClient.invalidateQueries({ queryKey: ['balance'] });
  }, [result?.status, haptic, queryClient]);

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!pending) return;
      // Автопокупка могла успеть, пока человек смотрел на экран.
      const fresh = await queryClient.fetchQuery({
        queryKey: ['subscriptions-list'],
        queryFn: () => subscriptionApi.getSubscriptions(),
        staleTime: 0,
      });
      const recheck = resolveCheckoutStatus({
        pending,
        subscriptions: fresh.subscriptions ?? [],
        balanceKopeks: undefined,
        now: Date.now(),
        openedAt,
      });
      if (recheck.status === 'done') return;
      if (pending.kind === 'renew') {
        await subscriptionApi.renewSubscription(pending.periodDays, pending.subscriptionId ?? undefined);
      } else if (pending.tariffId !== null) {
        await subscriptionApi.purchaseTariff(
          pending.tariffId,
          pending.periodDays,
          pending.trafficGb ?? undefined,
          pending.subscriptionId ?? undefined,
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    },
    onError: (error) => {
      const missing = getCheckoutShortfall(error);
      if (missing !== null) navigate(checkoutTopUpPath(missing));
    },
  });

  if (!pending) return <Navigate to="/" replace />;

  if (result?.status === 'done' && result.subscription) {
    const sub = result.subscription;
    return (
      <div className="mx-auto flex max-w-md flex-col gap-6 pt-6 text-center">
        <AnimatedCheckmark className="mx-auto" />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-dark-50">{t('checkout.done.title')}</h1>
          {sub.end_date && (
            <p className="text-dark-300">{t('checkout.done.until', { date: format.date(sub.end_date) })}</p>
          )}
        </div>
        <SetupSteps current={3} />
        <div className="bento-card space-y-1.5 border border-accent-400/25 text-left">
          <p className="text-base font-bold text-dark-50">{t('checkout.done.lastStepTitle')}</p>
          <p className="text-[15px] leading-relaxed text-dark-300">{t('checkout.done.lastStepDesc')}</p>
        </div>
        <div className="space-y-1.5">
          <Link to={`/connection?sub=${sub.id}`} replace className={PRIMARY}>
            {t('checkout.done.connect')}
          </Link>
          <Link to="/" replace className={QUIET}>
            {t('checkout.done.later')}
          </Link>
        </div>
      </div>
    );
  }

  if (result?.status === 'confirm') {
    const price = format.price(pending.priceKopeks);
    return (
      <div className="mx-auto flex max-w-md flex-col gap-6 pt-6 text-center">
        <SetupSteps current={2} />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-dark-50">{t('checkout.confirm.title')}</h1>
          <p className="text-[15px] leading-relaxed text-dark-300">
            {t('checkout.confirm.desc', { label: pending.label, price })}
          </p>
        </div>
        <div className="space-y-1.5">
          <button
            type="button"
            className={PRIMARY}
            onClick={() => confirmMutation.mutate()}
            disabled={confirmMutation.isPending}
          >
            {confirmMutation.isPending ? t('common.loading') : t('checkout.confirm.cta', { price })}
          </button>
          <Link to="/" className={QUIET}>
            {t('checkout.toHome')}
          </Link>
        </div>
        {confirmMutation.isError && getCheckoutShortfall(confirmMutation.error) === null && (
          <p className="text-sm text-error-400">{getErrorMessage(confirmMutation.error)}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 pt-10 text-center">
      <Spinner className="h-14 w-14 border-[3px]" />
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-dark-50">{t('checkout.waiting.title')}</h1>
        <p className="text-[15px] leading-relaxed text-dark-300">{t('checkout.waiting.desc')}</p>
      </div>
      <div className="w-full space-y-1.5">
        <Link to={paymentPathFor(pending)} className="btn-secondary flex w-full items-center justify-center py-3 text-sm font-medium">
          {t('checkout.waiting.backToPayment')}
        </Link>
        <Link to="/" className={QUIET}>
          {t('checkout.toHome')}
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Маршрут**

В `src/App.tsx` рядом с `const More = lazyWithRetry(…)` добавить:

```tsx
const CheckoutStatus = lazyWithRetry(() => import('./pages/CheckoutStatus'));
```

И сразу после блока `<Route path="/subscription/purchase" … />` добавить:

```tsx
        <Route
          path="/subscription/status"
          element={
            <ProtectedRoute>
              <LazyPage>
                <CheckoutStatus />
              </LazyPage>
            </ProtectedRoute>
          }
        />
```

Проверить, что `/subscription/status` не перехватывается маршрутом `/subscription/:subscriptionId` (`LegacySubscriptionRedirect`): React Router выбирает статический сегмент раньше динамического, но убедиться прогоном страницы в dev (задача 8).

- [ ] **Step 6: Прогнать тесты**

Run: `npm test -- src/pages/checkoutStatus.test.tsx src/locales/locales.test.ts && npm run type-check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/CheckoutStatus.tsx src/pages/checkoutStatus.test.tsx src/App.tsx src/locales
git commit -m "feat(checkout): страница статуса оплаты — ждём, подтвердить, подключить устройство"
```

---

### Task 4: «Оплатить» в форме покупки и в продлении

**Files:**
- Modify: `src/components/subscription/purchase/TariffPurchaseForm.tsx`
- Modify: `src/pages/RenewSubscription.tsx`

**Interfaces:**
- Consumes: `useCheckout().start(request: CheckoutRequest)` (задача 2); ключи `checkout.pay`, `checkout.payFromBalance`, `checkout.fromBalance`, `checkout.toPay`, `checkout.autoActivateHint` (задача 3).

Суточные тарифы (ветка `tariff.is_daily || daily_price_kopeks > 0`) не трогаем — они списываются с баланса по дням.

- [ ] **Step 1: Форма покупки — выбор дней и трафика одной функцией**

В `TariffPurchaseForm.tsx` после объявления `useCustomTraffic` добавить и использовать в `purchaseMutation.mutationFn` вместо дублирующегося вычисления:

```tsx
  const isDailyTariff = Boolean(
    tariff.is_daily || (tariff.daily_price_kopeks && tariff.daily_price_kopeks > 0),
  );
  const selectedDays = () =>
    isDailyTariff ? 1 : useCustomDays ? customDays : selectedTariffPeriod?.days || 30;
  const selectedTrafficGb = () =>
    useCustomTraffic && tariff.custom_traffic_enabled ? customTrafficGb : undefined;
  const selectedPeriodLabel = () =>
    useCustomDays
      ? t('subscription.days', { count: customDays })
      : (selectedTariffPeriod?.label ?? '');
```

`purchaseMutation.mutationFn` становится:

```tsx
    mutationFn: () =>
      subscriptionApi.purchaseTariff(
        tariff.id,
        selectedDays(),
        selectedTrafficGb(),
        subscriptionId ?? undefined,
      ),
```

(комментарий про `subscriptionId` из старого `mutationFn` сохранить над вызовом).

- [ ] **Step 2: Форма покупки — кнопка «Оплатить»**

Добавить импорт `import { useCheckout } from '../../../hooks/useCheckout';` и после `purchaseMutation`:

```tsx
  const checkout = useCheckout();
```

В блоке «Summary & Purchase» (внутри IIFE, где считается `totalPrice`) заменить кнопку `purchaseMutation.mutate()` и всё до `{sbpPurchaseButton}` на:

```tsx
                    {(() => {
                      const balance = balanceKopeks ?? 0;
                      const fromBalance = Math.min(balance, totalPrice);
                      const toPay = totalPrice - fromBalance;
                      return (
                        <>
                          {fromBalance > 0 && toPay > 0 && (
                            <div className="mb-4 space-y-1 text-sm">
                              <div className="flex justify-between text-dark-300">
                                <span>{t('checkout.fromBalance')}</span>
                                <span>−{formatPrice(fromBalance)}</span>
                              </div>
                              <div className="flex justify-between font-medium text-dark-100">
                                <span>{t('checkout.toPay')}</span>
                                <span>{formatPrice(toPay)}</span>
                              </div>
                            </div>
                          )}
                          <button
                            onClick={() =>
                              checkout.start({
                                kind: 'purchase',
                                tariffId: tariff.id,
                                subscriptionId: subscriptionId ?? null,
                                periodDays: selectedDays(),
                                trafficGb: selectedTrafficGb() ?? null,
                                label: `${tariff.name} · ${selectedPeriodLabel()}`,
                                priceKopeks: totalPrice,
                                pay: () =>
                                  subscriptionApi.purchaseTariff(
                                    tariff.id,
                                    selectedDays(),
                                    selectedTrafficGb(),
                                    subscriptionId ?? undefined,
                                  ),
                              })
                            }
                            disabled={checkout.isPending}
                            className="btn-primary w-full py-3"
                          >
                            {checkout.isPending ? (
                              <span className="flex items-center justify-center gap-2">
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                {t('common.loading')}
                              </span>
                            ) : toPay > 0 ? (
                              t('checkout.pay', { amount: formatPrice(toPay) })
                            ) : (
                              t('checkout.payFromBalance', { amount: formatPrice(totalPrice) })
                            )}
                          </button>
                          <p className="mt-2 text-center text-xs text-dark-400">
                            {t('checkout.autoActivateHint')}
                          </p>
                        </>
                      );
                    })()}
```

Кнопкам SBP/Lava в `disabled` добавить `|| checkout.isPending`.

Заменить два блока ошибок под суммой (строки с `purchaseMutation.isError && !getInsufficientBalanceError(...)` и `purchaseMutation.isError && getInsufficientBalanceError(...)` внутри «Summary & Purchase», **не** в суточной ветке) на:

```tsx
              {checkout.error != null && (
                <div className="mt-3 text-center text-sm text-error-400">
                  {getErrorMessage(checkout.error)}
                </div>
              )}
```

`InsufficientBalancePrompt` и `getInsufficientBalanceError` остаются импортированными — их использует суточная ветка.

- [ ] **Step 3: Проверить форму**

Run: `npm test -- src/components/subscription && npm run type-check`
Expected: PASS (тесты «выгодного периода» опираются на подписи периодов и не затронуты).

- [ ] **Step 4: Продление**

В `src/pages/RenewSubscription.tsx`:

1. Импорты: удалить `InsufficientBalancePrompt`; добавить `import { useCheckout } from '../hooks/useCheckout';` и `import { getErrorMessage } from '../utils/subscriptionHelpers';`.
2. Удалить `renewMutation`, состояние `error`/`setError`, `insufficientMatch`/`missingAmount` и функцию `handleRenew`; вместо них:

```tsx
  const checkout = useCheckout();

  const handleRenew = (periodDays: number) => {
    const option = options?.find((item) => item.period_days === periodDays);
    if (!option || !subId) return;
    impact('medium');
    checkout.start({
      kind: 'renew',
      tariffId: subscription?.tariff_id ?? null,
      subscriptionId: subId,
      periodDays,
      trafficGb: null,
      label: `${subscription?.tariff_name ?? t('subscription.defaultName', 'Подписка')} · ${t('subscription.days', { count: periodDays })}`,
      priceKopeks: option.price_kopeks,
      pay: () => subscriptionApi.renewSubscription(periodDays, subId),
    });
  };
```

3. В карточке варианта удалить `const canAfford = …` и блок `{!canAfford && (…insufficientBalanceAmount…)}`; в `onClick` карточки убрать `setError(null)` и добавить `checkout.reset()`.
4. Заменить блоки «Insufficient balance prompt» и «Error» на:

```tsx
      {checkout.error != null && (
        <div className="rounded-xl bg-error-400/10 p-3 text-center text-sm text-error-400">
          {getErrorMessage(checkout.error)}
        </div>
      )}
```

5. Кнопку продления заменить на:

```tsx
      {selectedPeriod && (() => {
        const option = options?.find((item) => item.period_days === selectedPeriod);
        const total = option?.price_kopeks ?? 0;
        const toPay = Math.max(0, total - balanceKopeks);
        const amount = (kopeks: number) => `${formatAmount(kopeks / 100)} ${currencySymbol}`;
        return (
          <div className="space-y-2">
            <button
              onClick={() => handleRenew(selectedPeriod)}
              disabled={checkout.isPending}
              className="w-full rounded-2xl bg-accent-500 py-3.5 text-base font-semibold text-on-accent transition-colors hover:bg-accent-600 disabled:opacity-50"
            >
              {checkout.isPending
                ? t('common.processing', 'Обработка...')
                : toPay > 0
                  ? t('checkout.pay', { amount: amount(toPay) })
                  : t('checkout.payFromBalance', { amount: amount(total) })}
            </button>
            <p className="text-center text-xs" style={{ color: g.textSecondary }}>
              {t('checkout.autoActivateHint')}
            </p>
          </div>
        );
      })()}
```

- [ ] **Step 5: Проверка**

Run: `npm run type-check && npm run lint && npm test`
Expected: всё зелёное; `grep -n "InsufficientBalancePrompt" src/pages/RenewSubscription.tsx` пуст.

- [ ] **Step 6: Commit**

```bash
git add src/components/subscription/purchase/TariffPurchaseForm.tsx src/pages/RenewSubscription.tsx
git commit -m "feat(checkout): «Оплатить» вместо «Пополнить баланс» в покупке и продлении"
```

---

### Task 5: Экраны пополнения в режиме «оплата подписки»

**Files:**
- Modify: `src/pages/TopUpMethodSelect.tsx`
- Modify: `src/pages/TopUpAmount.tsx`
- Modify: `src/pages/TopUpResult.tsx`

**Interfaces:**
- Consumes: `CHECKOUT_PURPOSE`, `CHECKOUT_STATUS_PATH`, `loadPendingCheckout`, `checkoutPaymentKopeks` (задача 1); ключи `checkout.paymentTitle`, `checkout.chooseMethod`, `checkout.pay`, `checkout.raisedToMin` (задача 3).

Режим включается параметром `purpose=subscription` (его ставит `checkoutTopUpPath`). Без параметра экраны ведут себя как раньше.

- [ ] **Step 1: Выбор способа**

В `TopUpMethodSelect.tsx`:

1. Импорты: `import { useEffect } from 'react';` и `import { CHECKOUT_PURPOSE } from '../utils/checkout';`.
2. После `useQuery`:

```tsx
  const isCheckout = searchParams.get('purpose') === CHECKOUT_PURPOSE;
  const availableMethods = paymentMethods?.filter((method) => method.is_available) ?? [];
```

3. В `handleMethodClick` после `returnTo` добавить `if (isCheckout) params.set('purpose', CHECKOUT_PURPOSE);`.
4. После `handleMethodClick`:

```tsx
  // Оплата подписки с единственным способом: выбирать нечего — сразу к оплате.
  useEffect(() => {
    if (!isCheckout || availableMethods.length !== 1) return;
    const params = new URLSearchParams(searchParams);
    navigate(`/balance/top-up/${availableMethods[0].id}?${params.toString()}`, { replace: true });
  }, [isCheckout, availableMethods, navigate, searchParams]);
```

5. Заголовок: `{isCheckout ? t('checkout.chooseMethod') : t('balance.selectPaymentMethod')}`.

- [ ] **Step 2: Сумма и оплата**

В `TopUpAmount.tsx`:

1. Импорт: `import { CHECKOUT_PURPOSE, CHECKOUT_STATUS_PATH, checkoutPaymentKopeks, loadPendingCheckout } from '../utils/checkout';`.
2. После `const returnTo = …`:

```tsx
  const isCheckout = searchParams.get('purpose') === CHECKOUT_PURPOSE;
  const [pendingCheckout] = useState(() => (isCheckout ? loadPendingCheckout() : null));
```

3. В эффекте «method id is unknown» (редирект на выбор способа) рядом с `if (rt) params.set('returnTo', rt);` добавить `if (isCheckout) params.set('purpose', CHECKOUT_PURPOSE);` и `isCheckout` в зависимости эффекта — иначе режим оплаты подписки теряется.

4. В `handleSuccess` первой строкой:

```tsx
    if (isCheckout) {
      navigate(CHECKOUT_STATUS_PATH, { replace: true });
      return;
    }
```

и добавить `isCheckout` в зависимости `useCallback`.

5. В `topUpMutation.onSuccess`, в ветке `method?.open_url_direct && !isTelegramDeepLink` после `openPaymentUrl(...)` и перед `return` добавить:

```tsx
          // В Telegram оплата ушла во внешний браузер — здесь ждём её на странице статуса.
          if (isCheckout && platform === 'telegram') {
            navigate(CHECKOUT_STATUS_PATH, { replace: true });
          }
```

6. `handleOpenPayment` в конце:

```tsx
    if (isCheckout) navigate(CHECKOUT_STATUS_PATH, { replace: true });
```

7. После вычисления `methodName` (там, где `method` уже есть):

```tsx
  const checkoutPayment = isCheckout
    ? checkoutPaymentKopeks(initialAmountRubles ?? 0, method)
    : null;

  const handleCheckoutSubmit = () => {
    if (!checkoutPayment) return;
    setError(null);
    setPaymentUrl(null);
    if (!checkRateLimit(RATE_LIMIT_KEYS.PAYMENT, 3, 30000)) {
      setError(
        t('balance.errors.rateLimit', { seconds: getRateLimitResetTime(RATE_LIMIT_KEYS.PAYMENT) }),
      );
      return;
    }
    if (hasOptions && !selectedOption) {
      setError(t('balance.errors.selectMethod'));
      return;
    }
    if (isStarsMethod) {
      starsPaymentMutation.mutate(checkoutPayment.kopeks);
    } else {
      topUpMutation.mutate(checkoutPayment.kopeks);
    }
  };
```

8. В разметке: заголовок метода (`<h3>{methodName}</h3>`) в режиме оплаты подписки заменить подписью `{isCheckout ? t('checkout.paymentTitle') : methodName}`, а строку с диапазоном сумм под ним — на `{isCheckout ? (pendingCheckout?.label ?? methodName) : `${formatAmount(minRubles, 0)} – …`}` (сохранить существующее выражение диапазона во второй ветке).

9. Блоки «Amount input + Submit button» и «Quick amount buttons» обернуть в `{!isCheckout && (…)}`, а перед ними добавить блок оплаты подписки:

```tsx
      {isCheckout && checkoutPayment && (
        <motion.div variants={staggerItem} className="space-y-3">
          <div className="flex items-center justify-between rounded-2xl border border-dark-700/50 bg-dark-800/70 px-4 py-4">
            <span className="text-sm text-dark-400">{t('checkout.toPay')}</span>
            <span className="text-xl font-bold text-dark-50">
              {formatAmount(checkoutPayment.kopeks / 100)} {currencySymbol}
            </span>
          </div>
          {checkoutPayment.raisedToMin && (
            <p className="text-sm text-dark-400">
              {t('checkout.raisedToMin', {
                min: `${formatAmount(minRubles, 0)} ${currencySymbol}`,
                rest: `${formatAmount(checkoutPayment.kopeks / 100 - (initialAmountRubles ?? 0))} ${currencySymbol}`,
              })}
            </p>
          )}
          <button
            type="button"
            onClick={handleCheckoutSubmit}
            disabled={isPending}
            className="btn-primary flex h-14 w-full items-center justify-center gap-2 text-base font-bold"
          >
            {isPending ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              t('checkout.pay', {
                amount: `${formatAmount(checkoutPayment.kopeks / 100)} ${currencySymbol}`,
              })
            )}
          </button>
        </motion.div>
      )}
```

Выбор опций способа (СБП/карта), блоки ошибки и ссылки на оплату остаются общими для обоих режимов.

- [ ] **Step 3: Результат оплаты**

В `TopUpResult.tsx`:

1. Импорт: `import { CHECKOUT_STATUS_PATH, loadPendingCheckout } from '../utils/checkout';`.
2. В `FailedState.handleTryAgain`:

```tsx
    navigate(loadPendingCheckout() ? '/subscription/purchase' : '/balance', { replace: true });
```

3. После эффекта очистки (`cleanedUpRef`) добавить:

```tsx
  // Платили за подписку — дальше её ждёт страница статуса, а не баланс.
  useEffect(() => {
    if (resolvedPaid && loadPendingCheckout()) {
      navigate(CHECKOUT_STATUS_PATH, { replace: true });
    }
  }, [resolvedPaid, navigate]);
```

- [ ] **Step 4: Проверка**

Run: `npm run type-check && npm run lint && npm test`
Expected: всё зелёное.

- [ ] **Step 5: Commit**

```bash
git add src/pages/TopUpMethodSelect.tsx src/pages/TopUpAmount.tsx src/pages/TopUpResult.tsx
git commit -m "feat(checkout): экраны оплаты в режиме «оплата подписки», возврат на статус"
```

---

### Task 6: Без «Баланс пополнен» посреди оплаты подписки

**Files:**
- Modify: `src/components/WebSocketNotifications.tsx`

**Interfaces:**
- Consumes: `shouldSuppressWsModal`, `loadPendingCheckout` (задача 1).

- [ ] **Step 1: Реализация**

1. Импорты: `useRef` в импорт из `react`, `useLocation` в импорт из `react-router`, и `import { loadPendingCheckout, shouldSuppressWsModal } from '../utils/checkout';`.
2. После `const navigate = useNavigate();`:

```tsx
  // Ref, а не зависимость handleMessage: смена экрана не должна переподписывать WS.
  const location = useLocation();
  const pathnameRef = useRef(location.pathname);
  pathnameRef.current = location.pathname;
```

3. В начале `handleMessage`, сразу после `const { type } = message;`:

```tsx
      const suppressModal = shouldSuppressWsModal(
        type,
        loadPendingCheckout() !== null,
        pathnameRef.current,
      );
```

4. В ветках `balance.topup`, `subscription.activated`, `subscription.renewed` обернуть вызов `showSuccessModal({...})` в `if (!suppressModal) { … }`. Инвалидации запросов и `refreshUser()` остаются безусловными.

- [ ] **Step 2: Проверка**

Run: `npm run type-check && npm test -- src/utils/checkout.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/WebSocketNotifications.tsx
git commit -m "feat(checkout): не показывать «Баланс пополнен» посреди оплаты подписки"
```

---

### Task 7: Главная — «Деньги зачислены, осталось оформить»

**Files:**
- Modify: `src/utils/homeState.ts`, `src/utils/homeState.test.ts`
- Create: `src/components/dashboard/home/CheckoutReadyHero.tsx`
- Modify: `src/pages/Dashboard.tsx`

**Interfaces:**
- Consumes: `loadPendingCheckout`, `clearPendingCheckout`, `resolveCheckoutStatus`, `CHECKOUT_STATUS_PATH` (задача 1); `SetupSteps`, `PrimaryLink`, `useHomeFormat` (этап 1).
- Produces: `HomeStateInput.checkoutReady: boolean`; `HomeStateKind` + `'checkout_ready'` (исключён из `HeroState`); `CheckoutReadyHero({ pending: PendingCheckout; onDismiss: () => void })`.

Сценарий: человек заплатил у провайдера, но автопокупка выключена или не успела, а человек ушёл со страницы статуса (например, вернулся в Mini App позже). Деньги на балансе, подписки нет — главная говорит об этом первой.

- [ ] **Step 1: Падающий тест состояния**

В `src/utils/homeState.test.ts`: в `base` добавить `checkoutReady: false,`; в `describe('getHomeState — приоритеты')` добавить:

```ts
  it('деньги за подписку на балансе — первым делом оформить', () => {
    expect(state({ checkoutReady: true, hasPendingGifts: true, subscription: sub() })).toBe(
      'checkout_ready',
    );
  });

  it('загрузка всё равно важнее', () => {
    expect(state({ checkoutReady: true, isLoading: true })).toBe('loading');
  });
```

Run: `npm test -- src/utils/homeState.test.ts`
Expected: FAIL (тип `checkoutReady` не существует / состояние не возвращается).

- [ ] **Step 2: Состояние**

В `src/utils/homeState.ts`:
- в `HomeStateKind` добавить `| 'checkout_ready'` после `'loading'`;
- в `HeroState` добавить `'checkout_ready'` в `Exclude<…>`;
- в `HomeStateInput` добавить `/** Деньги за запомненную покупку пришли, подписка не продлилась. */ checkoutReady: boolean;`;
- в `getHomeState` после `if (input.isLoading) return 'loading';` добавить `if (input.checkoutReady) return 'checkout_ready';`.

Run: `npm test -- src/utils/homeState.test.ts`
Expected: PASS.

- [ ] **Step 3: Карточка**

`src/components/dashboard/home/CheckoutReadyHero.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { CHECKOUT_STATUS_PATH, type PendingCheckout } from '@/utils/checkout';
import { SetupSteps } from './SetupSteps';
import { PrimaryLink } from './heroActions';
import { useHomeFormat } from './useHomeFormat';

interface CheckoutReadyHeroProps {
  pending: PendingCheckout;
  onDismiss: () => void;
}

/** Деньги за подписку пришли, а подписка — нет: говорим прямо и даём оформить. */
export function CheckoutReadyHero({ pending, onDismiss }: CheckoutReadyHeroProps) {
  const { t } = useTranslation();
  const format = useHomeFormat();

  return (
    <section
      className="bento-card space-y-5 border border-accent-400/25"
      data-testid="home-hero-checkout_ready"
    >
      <SetupSteps current={2} />
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-dark-50">{t('checkout.ready.title')}</h2>
        <p className="text-[15px] leading-relaxed text-dark-300">
          {t('checkout.ready.desc', { label: pending.label, price: format.price(pending.priceKopeks) })}
        </p>
      </div>
      <div className="space-y-1.5">
        <PrimaryLink to={CHECKOUT_STATUS_PATH}>{t('checkout.ready.cta')}</PrimaryLink>
        <button
          type="button"
          onClick={onDismiss}
          className="flex min-h-[44px] w-full items-center justify-center text-[15px] font-medium text-dark-400 hover:text-dark-200"
        >
          {t('checkout.ready.dismiss')}
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Главная**

В `src/pages/Dashboard.tsx`:

1. Импорты: `useMemo` в импорт из `react`; `import { clearPendingCheckout, loadPendingCheckout, resolveCheckoutStatus } from '../utils/checkout';`; `import { CheckoutReadyHero } from '../components/dashboard/home/CheckoutReadyHero';`.
2. Перед `const state = getHomeState({`:

```tsx
  // Запомненная покупка: подписка продлилась — забываем; деньги пришли, а
  // подписка нет — предлагаем оформить первым делом.
  const [pendingCheckout, setPendingCheckout] = useState(() => loadPendingCheckout());
  const checkoutStatus = useMemo(
    () =>
      pendingCheckout && multiSubData
        ? resolveCheckoutStatus({
            pending: pendingCheckout,
            subscriptions: multiSubData.subscriptions ?? [],
            balanceKopeks: balanceData?.balance_kopeks,
            now: Date.now(),
            openedAt: Date.now(),
          }).status
        : null,
    [pendingCheckout, multiSubData, balanceData?.balance_kopeks],
  );
  useEffect(() => {
    if (checkoutStatus === 'done') {
      clearPendingCheckout();
      setPendingCheckout(null);
    }
  }, [checkoutStatus]);
```

3. В аргументы `getHomeState` добавить `checkoutReady: checkoutStatus === 'confirm',`.
4. В `renderHero()` добавить ветку:

```tsx
      case 'checkout_ready':
        return pendingCheckout ? (
          <CheckoutReadyHero
            pending={pendingCheckout}
            onDismiss={() => {
              clearPendingCheckout();
              setPendingCheckout(null);
            }}
          />
        ) : null;
```

- [ ] **Step 5: Проверка**

Run: `npm run type-check && npm run lint && npm test`
Expected: всё зелёное.

- [ ] **Step 6: Commit**

```bash
git add src/utils/homeState.ts src/utils/homeState.test.ts src/components/dashboard/home/CheckoutReadyHero.tsx src/pages/Dashboard.tsx
git commit -m "feat(home): «Деньги зачислены — осталось оформить подписку» на главной"
```

---

### Task 8: Проверка целиком

- [ ] **Step 1: Полный прогон**

Run: `npm run type-check && npm run lint && npm run format:check && npm test && npm run build`
Expected: всё зелёное.

- [ ] **Step 2: Ручные сценарии (dev-прокси на рабочий бэкенд)**

```bash
DEV_API_TARGET=https://cabinet.zanity.net/api npm run dev
```

Без реального платежа проверяется:
1. `/subscription/purchase` → тариф → период: кнопка «Оплатить 199 ₽», под ней подпись про автоматическое включение; нет «Пополнить баланс».
2. Нажать «Оплатить» с нулевым балансом → открывается экран «Оплата подписки» (при одном способе оплаты — без выбора способа) с «К оплате 199 ₽» и названием тарифа; `localStorage.pending_checkout` заполнен.
3. `/subscription/status` при запомненной покупке без оплаты — «Ждём подтверждение оплаты», «Вернуться к оплате» ведёт на покупку.
4. Продление `/subscriptions/<id>/renew`: кнопка «Оплатить …», нет красных «Недостаточно средств».
5. Без запомненной покупки `/subscription/status` уводит на главную.

С реальным платежом (решение владельца, минимальная сумма способа): оплатить 1 месяц и проверить, что после возврата показывается «Оплата прошла → Подключить устройство», а модалки «Баланс пополнен» нет. Проверить при включённой и выключенной `AUTO_PURCHASE_AFTER_TOPUP_ENABLED`: при выключенной страница статуса через ~30 с предлагает «Оформить за 199 ₽».

- [ ] **Step 3: Настройка бота**

Включить в боте «Автопокупку после пополнения» (`AUTO_PURCHASE_AFTER_TOPUP_ENABLED=true`) перед деплоем этапа.
