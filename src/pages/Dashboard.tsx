import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { useAuthStore } from '../store/auth';
import { displayName } from '../utils/displayName';
import { subscriptionApi } from '../api/subscription';
import { referralApi } from '../api/referral';
import { balanceApi } from '../api/balance';
import { giftApi } from '../api/gift';
import { API } from '../config/constants';
import { getApiErrorMessage } from '../utils/api-error';
import { getHomeState, isNewUserState, minPlanPriceKopeks } from '../utils/homeState';
import {
  clearPendingCheckout,
  loadPendingCheckout,
  resolveCheckoutStatus,
} from '../utils/checkout';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useTrafficAutoRefresh } from '../hooks/useTrafficAutoRefresh';
import { useWelcomeSheet } from '../hooks/useWelcomeSheet';
import PendingGiftCard from '../components/dashboard/PendingGiftCard';
import SubscriptionCardExpired from '../components/dashboard/SubscriptionCardExpired';
import { HomeHero } from '../components/dashboard/home/HomeHero';
import { HomeQuickTiles } from '../components/dashboard/home/HomeQuickTiles';
import { MultiSubscriptionsHero } from '../components/dashboard/home/MultiSubscriptionsHero';
import { WelcomeSheet } from '../components/dashboard/WelcomeSheet';
import { CheckoutReadyHero } from '../components/dashboard/home/CheckoutReadyHero';
import { ChatIcon } from '@/components/icons';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';

function HeroSkeleton() {
  return (
    <SkeletonGroup className="bento-card">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-6 w-32 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="mb-3 h-12 w-28" />
      <Skeleton className="mb-5 h-4 w-40" />
      <Skeleton className="h-12 w-full rounded-xl" />
    </SkeletonGroup>
  );
}

/**
 * Главная: загрузить данные → выбрать состояние (utils/homeState) → показать
 * одну карточку с одним главным действием и две плитки под ней.
 */
export default function Dashboard() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const queryClient = useQueryClient();
  const { referralEnabled } = useFeatureFlags();
  const [trialError, setTrialError] = useState<string | null>(null);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const { data: balanceData } = useQuery({
    queryKey: ['balance'],
    queryFn: balanceApi.getBalance,
    staleTime: API.BALANCE_STALE_TIME_MS,
    refetchOnMount: 'always',
  });

  const { data: multiSubData } = useQuery({
    queryKey: ['subscriptions-list'],
    queryFn: () => subscriptionApi.getSubscriptions(),
    staleTime: 60_000,
  });
  const isMultiTariff = multiSubData?.multi_tariff_enabled ?? false;

  const { data: subscriptionResponse, isLoading: subLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => subscriptionApi.getSubscription(),
    retry: false,
    staleTime: API.BALANCE_STALE_TIME_MS,
    refetchOnMount: 'always',
    enabled: !isMultiTariff,
  });
  const subscription = subscriptionResponse?.subscription ?? null;

  // В мультитарифе /cabinet/subscription отключён; «нет подписок» — пустой список.
  const hasNoSubscription = isMultiTariff
    ? multiSubData !== undefined && (multiSubData.subscriptions?.length ?? 0) === 0
    : subscriptionResponse?.has_subscription === false && !subLoading;

  const { data: trialInfo, isLoading: trialLoading } = useQuery({
    queryKey: ['trial-info'],
    queryFn: () => subscriptionApi.getTrialInfo(),
    enabled: !subscription && !subLoading,
  });

  const { data: devicesData } = useQuery({
    queryKey: ['devices'],
    queryFn: () => subscriptionApi.getDevices(),
    enabled: !!subscription && !isMultiTariff,
    staleTime: API.BALANCE_STALE_TIME_MS,
  });

  const { data: referralInfo } = useQuery({
    queryKey: ['referral-info'],
    queryFn: referralApi.getReferralInfo,
    enabled: referralEnabled === true,
  });

  const { data: pendingGifts } = useQuery({
    queryKey: ['pending-gifts'],
    queryFn: giftApi.getPendingGifts,
    staleTime: 30_000,
    retry: false,
  });

  const needsPlanPrice = hasNoSubscription || (!!subscription?.is_trial && subscription.is_expired);
  const { data: purchaseOptions } = useQuery({
    queryKey: ['purchase-options'],
    queryFn: () => subscriptionApi.getPurchaseOptions(),
    enabled: needsPlanPrice,
    staleTime: 60_000,
  });

  useTrafficAutoRefresh(subscription);

  const activateTrialMutation = useMutation({
    mutationFn: () => subscriptionApi.activateTrial(),
    onSuccess: () => {
      setTrialError(null);
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['trial-info'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
      refreshUser();
    },
    onError: (error: unknown) => {
      setTrialError(getApiErrorMessage(error, t('common.error')));
    },
  });

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

  const state = getHomeState({
    isLoading:
      subLoading || (isMultiTariff && !multiSubData) || (hasNoSubscription && trialLoading),
    hasPendingGifts: (pendingGifts?.length ?? 0) > 0,
    multiTariff: isMultiTariff,
    multiSubscriptionsCount: multiSubData?.subscriptions?.length ?? 0,
    subscription,
    trial: trialInfo,
    connectedDevices: devicesData?.total,
    checkoutReady: checkoutStatus === 'confirm',
  });

  const firstName = user?.first_name || displayName(user);

  const renderHero = () => {
    switch (state) {
      case 'loading':
        return <HeroSkeleton />;
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
      case 'gift_pending':
        return <PendingGiftCard gifts={pendingGifts ?? []} />;
      case 'multi':
        return <MultiSubscriptionsHero subscriptions={multiSubData?.subscriptions ?? []} />;
      case 'daily_inactive':
        return subscription ? (
          <SubscriptionCardExpired
            subscription={subscription}
            balanceKopeks={balanceData?.balance_kopeks ?? 0}
            balanceRubles={balanceData?.balance_rubles ?? 0}
          />
        ) : null;
      default:
        return (
          <HomeHero
            state={state}
            subscription={subscription}
            trial={trialInfo}
            connectedDevices={devicesData?.total}
            balanceKopeks={balanceData?.balance_kopeks ?? 0}
            minPlanPriceKopeks={minPlanPriceKopeks(purchaseOptions)}
            onActivateTrial={() => activateTrialMutation.mutate()}
            isActivatingTrial={activateTrialMutation.isPending}
            trialError={trialError}
          />
        );
    }
  };

  const isNewUser = isNewUserState(state);
  const welcome = useWelcomeSheet(user?.id, isNewUser);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-dark-50 sm:text-3xl">
          {firstName ? t('home.greeting', { name: firstName }) : t('home.greetingNoName')}
        </h1>
        {isNewUser && <p className="mt-1 text-dark-400">{t('home.newSubtitle')}</p>}
      </div>

      {renderHero()}

      <HomeQuickTiles
        balanceRubles={balanceData?.balance_rubles}
        referralEnabled={referralEnabled === true}
        referral={
          referralInfo
            ? {
                totalReferrals: referralInfo.total_referrals,
                earningsRubles: referralInfo.available_balance_rubles,
                commissionPercent: referralInfo.commission_percent,
              }
            : null
        }
      />

      {isNewUser && (
        <Link
          to="/support"
          className="flex min-h-[44px] items-center gap-2.5 px-1 text-sm font-medium text-dark-400 hover:text-dark-200"
        >
          <ChatIcon className="h-[18px] w-[18px]" />
          {t('home.support')}
        </Link>
      )}

      <WelcomeSheet open={welcome.open} onClose={welcome.close} freeTrial={state === 'new_trial'} />
    </div>
  );
}
