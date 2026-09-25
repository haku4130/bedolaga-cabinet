import type { PurchaseOptions, Subscription, TrialInfo } from '@/types';

/**
 * Состояние пользователя для главной. Для каждого — одна главная кнопка
 * (см. docs/superpowers/specs/2026-09-24-cabinet-ux-redesign-design.md, 5.1).
 */
export type HomeStateKind =
  | 'loading'
  | 'checkout_ready'
  | 'gift_pending'
  | 'multi'
  | 'new_trial'
  | 'new_paid_trial'
  | 'new'
  | 'expired_trial'
  | 'daily_inactive'
  | 'disabled'
  | 'expired'
  | 'traffic_exhausted'
  | 'expiring'
  | 'active_no_devices'
  | 'active';

/** Состояния, которые рисует HomeHero; остальные Dashboard рисует сам. */
export type HeroState = Exclude<
  HomeStateKind,
  'loading' | 'checkout_ready' | 'gift_pending' | 'multi' | 'daily_inactive'
>;

export type HomeSubscription = Pick<
  Subscription,
  | 'status'
  | 'is_trial'
  | 'is_expired'
  | 'is_limited'
  | 'is_daily'
  | 'is_daily_paused'
  | 'days_left'
  | 'autopay_enabled'
>;

export interface HomeStateInput {
  isLoading: boolean;
  hasPendingGifts: boolean;
  multiTariff: boolean;
  multiSubscriptionsCount: number;
  subscription: HomeSubscription | null;
  trial: Pick<TrialInfo, 'is_available' | 'requires_payment'> | undefined;
  /** undefined — ещё не загружено. */
  connectedDevices: number | undefined;
  /** Деньги за запомненную покупку пришли, а подписка не продлилась. */
  checkoutReady: boolean;
}

/** С какого остатка дней предлагаем продлить (если автопродление выключено). */
export const EXPIRING_DAYS = 3;

export function getHomeState(input: HomeStateInput): HomeStateKind {
  const sub = input.subscription;

  if (input.isLoading) return 'loading';
  if (input.checkoutReady) return 'checkout_ready';
  if (input.hasPendingGifts) return 'gift_pending';
  if (input.multiTariff && input.multiSubscriptionsCount > 0) return 'multi';

  if (!sub) {
    if (input.trial?.is_available) {
      return input.trial.requires_payment ? 'new_paid_trial' : 'new_trial';
    }
    return 'new';
  }

  const inactive = sub.is_expired || sub.status === 'expired' || sub.status === 'disabled';

  // Суточному тарифу нечего выбирать: его карточка продлевает/снимает с паузы
  // в один клик (SubscriptionCardExpired), и эту логику мы не дублируем.
  if (sub.is_daily && (inactive || sub.is_daily_paused || sub.is_limited)) return 'daily_inactive';
  // Отключённую (админом, за выход из канала, антиабуз) бот не продлевает —
  // «Продлить» тут тупик, нужен человек из поддержки.
  if (sub.status === 'disabled') return 'disabled';
  if (sub.is_trial && inactive) return 'expired_trial';
  if (inactive) return 'expired';
  if (sub.is_limited) return 'traffic_exhausted';
  if (!sub.is_daily && !sub.autopay_enabled && sub.days_left <= EXPIRING_DAYS) return 'expiring';
  if (input.connectedDevices === 0) return 'active_no_devices';
  return 'active';
}

export function isNewUserState(state: HomeStateKind): boolean {
  return state === 'new' || state === 'new_trial' || state === 'new_paid_trial';
}

/** Самая низкая цена покупки — для подписи «от 109 ₽». null, если цен нет. */
export function minPlanPriceKopeks(options: PurchaseOptions | undefined): number | null {
  if (!options) return null;
  const prices =
    options.sales_mode === 'tariffs'
      ? options.tariffs
          .filter((tariff) => tariff.is_available)
          .flatMap((tariff) => tariff.periods.map((period) => period.price_kopeks))
      : options.periods
          .filter((period) => period.is_available)
          .map((period) => period.price_kopeks);
  const positive = prices.filter((price) => price > 0);
  return positive.length > 0 ? Math.min(...positive) : null;
}
