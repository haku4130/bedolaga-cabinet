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
