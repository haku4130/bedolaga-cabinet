import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { subscriptionApi } from '@/api/subscription';
import { API } from '@/config/constants';
import SubscriptionListCard from '@/components/subscription/SubscriptionListCard';
import { DeviceLimitSheet } from '@/components/subscription/DeviceLimitSheet';
import type { SubscriptionListItem } from '@/types';

const VISIBLE = 3;

/** Мультитариф: у каждой подписки своя карточка с подключением устройств. */
export function MultiSubscriptionsHero({
  subscriptions,
}: {
  subscriptions: SubscriptionListItem[];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const visible = useMemo(() => subscriptions.slice(0, VISIBLE), [subscriptions]);

  // Ключ ['devices', id] общий со страницей подписки — переход туда не стоит сети.
  const deviceQueries = useQueries({
    queries: visible.map((sub) => ({
      queryKey: ['devices', sub.id],
      queryFn: () => subscriptionApi.getDevices(sub.id),
      staleTime: API.BALANCE_STALE_TIME_MS,
    })),
  });

  const [limitSubId, setLimitSubId] = useState<number | null>(null);
  const limitIndex = visible.findIndex((sub) => sub.id === limitSubId);
  const limitSub = limitIndex >= 0 ? visible[limitIndex] : null;

  return (
    <div className="space-y-3" data-testid="home-hero-multi">
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-medium text-dark-400">{t('home.multi.title')}</span>
        <Link to="/subscriptions" className="text-xs text-accent-400 hover:underline">
          {t('home.multi.manageAll')} →
        </Link>
      </div>
      {visible.map((sub, index) => (
        <SubscriptionListCard
          key={sub.id}
          subscription={sub}
          onClick={() => navigate(`/subscriptions/${sub.id}`)}
          connect={{
            connectedDevices: deviceQueries[index]?.data?.total,
            onConnect: () => navigate(`/connection?sub=${sub.id}`),
            onManage: () => setLimitSubId(sub.id),
          }}
        />
      ))}
      {subscriptions.length > VISIBLE && (
        <Link
          to="/subscriptions"
          className="flex w-full items-center justify-center rounded-2xl border border-dashed border-dark-700 p-3 text-xs text-dark-400 hover:text-dark-200"
        >
          {t('home.multi.showAll', { count: subscriptions.length })}
        </Link>
      )}
      <Link
        to="/subscription/purchase"
        className="btn-secondary flex w-full items-center justify-center py-3 text-sm font-medium"
      >
        + {t('home.multi.buyAnother')}
      </Link>

      {limitSub && (
        <DeviceLimitSheet
          isOpen
          onClose={() => setLimitSubId(null)}
          subscriptionId={limitSub.id}
          subscriptionName={limitSub.tariff_name || t('subscription.defaultName', 'Подписка')}
          deviceLimit={limitSub.device_limit}
          isTrial={limitSub.is_trial}
          devices={deviceQueries[limitIndex]?.data?.devices ?? []}
          onOpenSubscription={() => {
            setLimitSubId(null);
            navigate(`/subscriptions/${limitSub.id}`);
          }}
        />
      )}
    </div>
  );
}
