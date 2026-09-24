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
        await subscriptionApi.renewSubscription(
          pending.periodDays,
          pending.subscriptionId ?? undefined,
        );
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
            <p className="text-dark-300">
              {t('checkout.done.until', { date: format.date(sub.end_date) })}
            </p>
          )}
        </div>
        <SetupSteps current={3} />
        <div className="bento-card space-y-1.5 border border-accent-400/25 text-left">
          <p className="text-base font-bold text-dark-50">{t('checkout.done.lastStepTitle')}</p>
          <p className="text-[15px] leading-relaxed text-dark-300">
            {t('checkout.done.lastStepDesc')}
          </p>
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
        <Link
          to={paymentPathFor(pending)}
          className="btn-secondary flex w-full items-center justify-center py-3 text-sm font-medium"
        >
          {t('checkout.waiting.backToPayment')}
        </Link>
        <Link to="/" className={QUIET}>
          {t('checkout.toHome')}
        </Link>
      </div>
    </div>
  );
}
