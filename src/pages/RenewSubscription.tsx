import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate, useParams } from 'react-router';
import { subscriptionApi } from '../api/subscription';
import { useTheme } from '../hooks/useTheme';
import { getGlassColors } from '../utils/glassTheme';
import { getMonthlyPriceKopeks } from '../utils/pricing';
import { pickBestValue } from '../utils/bestValue';
import { useCurrency } from '../hooks/useCurrency';
import { useHaptic } from '../platform';
import { useCheckout } from '../hooks/useCheckout';
import { getErrorMessage } from '../utils/subscriptionHelpers';
import { WebBackButton } from '../components/WebBackButton';
import { BEST_VALUE_BORDER, BestValueBadge } from '../components/subscription/BestValueBadge';
import { PageSkeleton, Skeleton } from '../components/ui/skeleton';

export default function RenewSubscription() {
  const { subscriptionId } = useParams<{ subscriptionId: string }>();
  const subId = subscriptionId ? Number(subscriptionId) : undefined;

  const { t } = useTranslation();
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);
  const { formatAmount, currencySymbol } = useCurrency();
  const { impact } = useHaptic();

  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);

  // Load subscription detail for tariff name
  const { data: subscriptionResponse } = useQuery({
    queryKey: ['subscription', subId],
    queryFn: () => subscriptionApi.getSubscription(subId),
    enabled: !!subId,
    staleTime: 30_000,
  });
  const subscription = subscriptionResponse?.subscription ?? null;

  // Load renewal options
  const { data: options, isLoading } = useQuery({
    queryKey: ['renewal-options', subId],
    queryFn: () => subscriptionApi.getRenewalOptions(subId),
    enabled: !!subId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Отмеченный оператором вариант выбираем сразу, как только приехал список.
  // Без отметки выбор остаётся за человеком: сами выгоду не выдумываем.
  useEffect(() => {
    if (selectedPeriod !== null) return;
    const best = pickBestValue(options);
    if (best) setSelectedPeriod(best.period_days);
  }, [options, selectedPeriod]);

  // Load balance
  const { data: purchaseOptions } = useQuery({
    queryKey: ['purchase-options', subId],
    queryFn: () => subscriptionApi.getPurchaseOptions(subId),
    staleTime: 0,
  });
  const balanceKopeks = purchaseOptions?.balance_kopeks ?? 0;

  // «Оплатить»: с баланса или недостающее у провайдера — без «пополните баланс».
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

  if (!subId) {
    return <Navigate to="/subscriptions" replace />;
  }

  if (isLoading) {
    return (
      <PageSkeleton leading={1} titleWidth="w-56" className="space-y-5">
        <Skeleton variant="card" className="h-16" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Skeleton variant="card" count={4} className="h-20" />
        </div>
      </PageSkeleton>
    );
  }

  return (
    <div className="space-y-5">
      {/* Title */}
      <div className="flex items-center gap-3">
        <WebBackButton to={`/subscriptions/${subId}`} />
        <div>
          <h1 className="text-2xl font-bold" style={{ color: g.text }}>
            {t('subscription.extend', 'Продлить подписку')}
          </h1>
          {subscription?.tariff_name && (
            <p className="mt-1 text-sm" style={{ color: g.textSecondary }}>
              {subscription.tariff_name}
            </p>
          )}
        </div>
      </div>

      {/* Balance */}
      <div
        className="flex items-center justify-between rounded-2xl p-4"
        style={{ background: g.cardBg, border: `1px solid ${g.cardBorder}` }}
      >
        <span className="text-sm" style={{ color: g.textSecondary }}>
          {t('common.balance', 'Баланс')}
        </span>
        <span className="text-base font-semibold" style={{ color: g.text }}>
          {formatAmount(balanceKopeks / 100)} {currencySymbol}
        </span>
      </div>

      {/* Period options */}
      {!options || options.length === 0 ? (
        <div
          className="rounded-2xl p-6 text-center"
          style={{ background: g.cardBg, border: `1px solid ${g.cardBorder}` }}
        >
          <p style={{ color: g.textSecondary }}>
            {t('subscription.noRenewalOptions', 'Нет доступных вариантов продления')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {options.map((option) => {
            const isSelected = selectedPeriod === option.period_days;
            const perMonth = getMonthlyPriceKopeks(option.price_kopeks, option.period_days);
            // Выбранный вариант важнее подсказки: рамка выделения уступает
            // рамке выбора, чтобы не было двух «активных» карточек сразу.
            const isBestValue = Boolean(option.is_highlighted);

            return (
              <button
                key={option.period_days}
                onClick={() => {
                  impact('light');
                  setSelectedPeriod(option.period_days);
                  checkout.reset();
                }}
                className={`w-full rounded-2xl p-4 text-left transition-all duration-200 ${
                  isBestValue ? 'border-2' : 'border'
                }`}
                style={{
                  background: isSelected
                    ? isDark
                      ? 'rgba(var(--color-accent-400), 0.08)'
                      : 'rgba(var(--color-accent-400), 0.05)'
                    : g.cardBg,
                  borderColor: isBestValue
                    ? BEST_VALUE_BORDER
                    : isSelected
                      ? 'rgb(var(--color-accent-400))'
                      : g.cardBorder,
                  // Выбранный выгодный вариант несёт обе метки: жёлтый контур
                  // снаружи и контур выбора внутри — иначе подсказка пропадала
                  // ровно тогда, когда человек ей последовал.
                  boxShadow:
                    isSelected && isBestValue
                      ? 'inset 0 0 0 2px rgb(var(--color-accent-400))'
                      : undefined,
                }}
              >
                {isBestValue && <BestValueBadge className="mb-2" />}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-base font-semibold" style={{ color: g.text }}>
                      {option.period_days} {t('subscription.days', 'дней')}
                    </span>
                    {option.discount_percent > 0 && (
                      <span className="ml-2 rounded-full bg-success-400/15 px-2 py-0.5 text-[10px] font-semibold text-success-400">
                        -{option.discount_percent}%
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-base font-semibold" style={{ color: g.text }}>
                      {option.price_kopeks === 0
                        ? t('subscription.free', 'Бесплатно')
                        : `${formatAmount(option.price_kopeks / 100)} ${currencySymbol}`}
                    </div>
                    {perMonth !== null && (
                      <div className="text-[11px]" style={{ color: g.textSecondary }}>
                        {formatAmount(perMonth / 100)} {currencySymbol}/
                        {t('subscription.month', 'мес')}
                      </div>
                    )}
                    {option.original_price_kopeks && (
                      <div className="text-[11px] line-through" style={{ color: g.textSecondary }}>
                        {formatAmount(option.original_price_kopeks / 100)} {currencySymbol}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {checkout.error != null && (
        <div className="rounded-xl bg-error-400/10 p-3 text-center text-sm text-error-400">
          {getErrorMessage(checkout.error)}
        </div>
      )}

      {/* Renew button */}
      {selectedPeriod &&
        (() => {
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
    </div>
  );
}
