import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { subscriptionApi } from '../../../api/subscription';
import { getErrorMessage } from '../../../utils/subscriptionHelpers';
import { useCheckout } from '../../../hooks/useCheckout';
import { ChevronRightIcon } from '../../icons';
import type { PurchaseOptions, Subscription } from '../../../types';

// ──────────────────────────────────────────────────────────────────
// Buy-traffic sheet. Self-owns the packages query + purchase mutation;
// parent passes the selectedTrafficPackage state (the parent already
// resets it on global "close all modals", which is why it stays up
// top), shared purchaseOptions, and ids/flags.
//
// Extracted from Subscription.tsx — ~170 lines off the god page.
// ──────────────────────────────────────────────────────────────────

export interface TrafficTopupSheetProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  subscription: Subscription;
  subscriptionId: number | undefined;
  selectedTrafficPackage: number | null;
  onSelectedTrafficPackageChange: (gb: number | null) => void;
  purchaseOptions: PurchaseOptions | undefined;
  isDark: boolean;
}

export function TrafficTopupSheet({
  open,
  onOpen,
  onClose,
  subscription,
  subscriptionId,
  selectedTrafficPackage,
  onSelectedTrafficPackageChange,
  purchaseOptions,
  isDark,
}: TrafficTopupSheetProps) {
  const { t } = useTranslation();
  // «Оплатить»: с баланса или недостающее у провайдера — без «пополните баланс».
  const checkout = useCheckout();

  const formatPrice = (kopeks: number) => {
    const rubles = kopeks / 100;
    return rubles % 1 === 0 ? `${rubles} ₽` : `${rubles.toFixed(2)} ₽`;
  };

  const { data: trafficPackages } = useQuery({
    queryKey: ['traffic-packages', subscriptionId],
    queryFn: () => subscriptionApi.getTrafficPackages(subscriptionId),
    enabled: open && !!subscription,
  });

  if (!open) {
    return (
      <button
        onClick={onOpen}
        className={`w-full rounded-xl border p-4 text-left transition-colors ${isDark ? 'border-dark-700/50 bg-dark-800/50 hover:border-dark-600' : 'border-champagne-300/60 bg-champagne-200/40 hover:border-champagne-400'}`}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-dark-100">
              {t('subscription.additionalOptions.buyTraffic')}
            </div>
            <div className="mt-1 text-sm text-dark-400">
              {t('subscription.additionalOptions.currentTrafficLimit', {
                limit: subscription.traffic_limit_gb,
                used: subscription.traffic_used_gb.toFixed(1),
              })}
            </div>
          </div>
          <ChevronRightIcon className="text-dark-400" />
        </div>
      </button>
    );
  }

  return (
    <div
      className={`rounded-xl border p-5 ${isDark ? 'border-dark-700/50 bg-dark-800/50' : 'border-champagne-300/60 bg-champagne-200/40'}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-medium text-dark-100">
          {t('subscription.additionalOptions.buyTrafficTitle')}
        </h3>
        <button
          onClick={() => {
            onClose();
            onSelectedTrafficPackageChange(null);
          }}
          className="text-sm text-dark-400 hover:text-dark-200"
          aria-label={t('common.close', 'Close')}
        >
          ✕
        </button>
      </div>

      <div
        className={`mb-4 rounded-lg p-2 text-xs ${isDark ? 'bg-dark-700/30 text-dark-500' : 'bg-champagne-300/40 text-champagne-600'}`}
      >
        ⚠️ {t('subscription.additionalOptions.trafficWarning')}
      </div>

      {!trafficPackages || trafficPackages.length === 0 ? (
        <div className="py-4 text-center text-sm text-dark-400">
          {t('subscription.additionalOptions.trafficUnavailable')}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {trafficPackages.map((pkg) => (
              <button
                key={pkg.gb}
                onClick={() => onSelectedTrafficPackageChange(pkg.gb)}
                className={`rounded-xl border p-4 text-center transition-all ${
                  selectedTrafficPackage === pkg.gb
                    ? 'border-accent-500 bg-accent-500/10'
                    : isDark
                      ? 'border-dark-700/50 bg-dark-800/50 hover:border-dark-600'
                      : 'border-champagne-300/60 bg-champagne-200/40 hover:border-champagne-400'
                }`}
              >
                <div className="text-lg font-semibold text-dark-100">
                  {pkg.is_unlimited
                    ? '♾️ ' + t('subscription.additionalOptions.unlimited')
                    : `${pkg.gb} ${t('common.units.gb')}`}
                </div>
                {pkg.discount_percent && pkg.discount_percent > 0 && (
                  <div className="mb-1">
                    <span className="inline-block rounded-full bg-success-500/20 px-2 py-0.5 text-xs font-medium text-success-400">
                      -{pkg.discount_percent}%
                    </span>
                  </div>
                )}
                <div className="font-medium text-accent-400">
                  {pkg.discount_percent && pkg.discount_percent > 0 && pkg.base_price_kopeks ? (
                    <>
                      <span className="mr-1 text-sm text-dark-500 line-through">
                        {formatPrice(pkg.base_price_kopeks)}
                      </span>
                      {formatPrice(pkg.price_kopeks)}
                    </>
                  ) : (
                    formatPrice(pkg.price_kopeks)
                  )}
                </div>
              </button>
            ))}
          </div>

          {selectedTrafficPackage !== null &&
            (() => {
              const selectedPkg = trafficPackages.find((p) => p.gb === selectedTrafficPackage);
              const total = selectedPkg?.price_kopeks ?? 0;
              const fromBalance = Math.min(purchaseOptions?.balance_kopeks ?? 0, total);
              const toPay = total - fromBalance;

              return (
                <>
                  {fromBalance > 0 && toPay > 0 && (
                    <div className="mb-3 space-y-1 text-sm">
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
                        kind: 'traffic',
                        tariffId: subscription.tariff_id ?? null,
                        subscriptionId: subscriptionId ?? subscription.id,
                        periodDays: 0,
                        trafficGb: selectedTrafficPackage,
                        devices: null,
                        label: `${subscription.tariff_name ?? t('subscription.defaultName', 'Подписка')} · ${
                          selectedPkg?.is_unlimited
                            ? t('checkout.addon.trafficUnlimitedLabel')
                            : t('checkout.addon.trafficLabel', { gb: selectedTrafficPackage })
                        }`,
                        priceKopeks: total,
                        pay: () =>
                          subscriptionApi.purchaseTraffic(selectedTrafficPackage, subscriptionId),
                      })
                    }
                    disabled={checkout.isPending || !selectedPkg}
                    className="btn-primary w-full py-3"
                  >
                    {checkout.isPending ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      </span>
                    ) : toPay > 0 ? (
                      t('checkout.pay', { amount: formatPrice(toPay) })
                    ) : (
                      t('checkout.payFromBalance', { amount: formatPrice(total) })
                    )}
                  </button>
                </>
              );
            })()}

          {checkout.error != null && (
            <div className="text-center text-sm text-error-400">
              {getErrorMessage(checkout.error)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
