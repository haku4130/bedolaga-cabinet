import { AxiosError } from 'axios';
import type { PaymentMethod, SubscriptionListItem } from '@/types';
import { safeLocal } from './safeStorage';

/**
 * «Ожидаемая покупка» подписки. Живёт, пока человек платит у провайдера:
 * по ней страница статуса понимает, что именно ждать, а главная — что деньги
 * пришли ради подписки, а не просто на баланс.
 */
export type CheckoutKind = 'purchase' | 'renew' | 'devices' | 'traffic';

export interface PendingCheckout {
  kind: CheckoutKind;
  tariffId: number | null;
  /** Продление конкретной подписки; null — покупка из каталога. */
  subscriptionId: number | null;
  periodDays: number;
  /**
   * Трафик: у покупки — свой объём (custom_traffic_enabled), null — как в тарифе;
   * у докупки трафика — купленный пакет в ГБ.
   */
  trafficGb: number | null;
  /** Докупка устройств: сколько добавить. */
  devices: number | null;
  /** «Стандартный · 1 месяц» — для экранов оплаты и подтверждения. */
  label: string;
  priceKopeks: number;
  /** Дата окончания целевой подписки до оплаты; null — подписки не было. */
  baselineEndDate: string | null;
  /** Лимиты целевой подписки до оплаты — по ним видно, что докупка прошла. */
  baselineDeviceLimit: number | null;
  baselineTrafficLimitGb: number | null;
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
const CHECKOUT_KINDS = new Set<CheckoutKind>(['purchase', 'renew', 'devices', 'traffic']);

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
    !CHECKOUT_KINDS.has(raw.kind as CheckoutKind) ||
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
    kind: raw.kind as CheckoutKind,
    tariffId: raw.tariffId ?? null,
    subscriptionId: raw.subscriptionId ?? null,
    periodDays: raw.periodDays,
    trafficGb: raw.trafficGb ?? null,
    devices: raw.devices ?? null,
    label: raw.label,
    priceKopeks: raw.priceKopeks,
    baselineEndDate: raw.baselineEndDate ?? null,
    baselineDeviceLimit: raw.baselineDeviceLimit ?? null,
    baselineTrafficLimitGb: raw.baselineTrafficLimitGb ?? null,
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

/** Покупка прошла: сервер показывает то, за что платили. */
function isFulfilled(pending: PendingCheckout, target: SubscriptionListItem | null): boolean {
  if (target === null || INACTIVE_STATUSES.has(target.status)) return false;
  if (pending.kind === 'devices') {
    return (
      pending.baselineDeviceLimit !== null && target.device_limit > pending.baselineDeviceLimit
    );
  }
  if (pending.kind === 'traffic') {
    const before = pending.baselineTrafficLimitGb;
    if (before === null) return false;
    // Докупка увеличивает лимит; безлимитный пакет делает его 0.
    return target.traffic_limit_gb > before || (before > 0 && target.traffic_limit_gb === 0);
  }
  return (
    target.end_date !== null &&
    (pending.baselineEndDate === null ||
      Date.parse(target.end_date) > Date.parse(pending.baselineEndDate))
  );
}

export function resolveCheckoutStatus(input: {
  pending: PendingCheckout;
  subscriptions: SubscriptionListItem[];
  balanceKopeks: number | undefined;
  now: number;
  openedAt: number;
}): { status: CheckoutStatusKind; subscription: SubscriptionListItem | null } {
  const { pending } = input;
  const target = findCheckoutTarget(pending, input.subscriptions);

  if (isFulfilled(pending, target)) return { status: 'done', subscription: target };

  const enoughMoney =
    input.balanceKopeks !== undefined && input.balanceKopeks >= pending.priceKopeks;
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
  if (typeof detail !== 'object' || detail === null) return null;
  // Покупка и трафик отдают недостающее в missing_amount, устройства — в missing_kopeks.
  const missing = detail.missing_amount ?? detail.missing_kopeks;
  if (
    detail.code === 'insufficient_funds' &&
    detail.cart_saved === true &&
    typeof missing === 'number' &&
    missing > 0
  ) {
    return missing;
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
const STATUS_PAGE_MODALS = new Set([
  'subscription.activated',
  'subscription.renewed',
  'subscription.devices_purchased',
  'subscription.traffic_purchased',
]);

export function shouldSuppressWsModal(
  type: string,
  hasPendingCheckout: boolean,
  pathname: string,
): boolean {
  if (type === 'balance.topup') return hasPendingCheckout;
  if (STATUS_PAGE_MODALS.has(type)) return pathname === CHECKOUT_STATUS_PATH;
  return false;
}
