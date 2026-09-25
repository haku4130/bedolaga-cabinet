import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { WarningIcon } from '@/components/icons';
import type { Subscription } from '@/types';
import { PrimaryLink, SecondaryLink } from './heroActions';
import { useHomeFormat } from './useHomeFormat';

interface ProblemHeroProps {
  state: 'expired' | 'expired_trial' | 'disabled' | 'traffic_exhausted';
  subscription: Subscription;
  minPlanPriceKopeks: number | null;
}

/** Подписка не работает: честно говорим об этом и даём одну кнопку, чтобы починить. */
export function ProblemHero({ state, subscription: sub, minPlanPriceKopeks }: ProblemHeroProps) {
  const { t } = useTranslation();
  const format = useHomeFormat();

  const planLabel = minPlanPriceKopeks
    ? t('home.cta.choosePlanFrom', { price: format.price(minPlanPriceKopeks) })
    : t('home.cta.choosePlan');

  let title: string;
  let subtitle: string | null = null;
  let description: string;
  let primary: ReactNode;
  let secondary: ReactNode = null;

  if (state === 'expired') {
    title = t('home.expired.title');
    subtitle = t('home.expired.since', { date: format.date(sub.end_date) });
    description = t('home.expired.desc');
    primary = (
      <PrimaryLink to={`/subscriptions/${sub.id}/renew`}>{t('home.cta.renew')}</PrimaryLink>
    );
    secondary = (
      <SecondaryLink to="/subscription/purchase">{t('home.cta.otherPlan')}</SecondaryLink>
    );
  } else if (state === 'disabled') {
    title = t('home.disabled.title');
    description = t('home.disabled.desc');
    primary = <PrimaryLink to="/support">{t('home.cta.contactSupport')}</PrimaryLink>;
  } else if (state === 'expired_trial') {
    title = t('home.expiredTrial.title');
    description = t('home.expiredTrial.desc');
    primary = <PrimaryLink to="/subscription/purchase">{planLabel}</PrimaryLink>;
  } else {
    title = t('home.trafficOut.title');
    description = t('home.trafficOut.desc');
    // Докупка трафика живёт на странице подписки (TrafficTopupSheet).
    primary = <PrimaryLink to={`/subscriptions/${sub.id}`}>{t('home.cta.buyTraffic')}</PrimaryLink>;
    secondary = (
      <SecondaryLink to="/subscription/purchase">{t('home.cta.changePlan')}</SecondaryLink>
    );
  }

  return (
    <section
      className="space-y-5 rounded-3xl border border-warning-500/35 bg-warning-500/[0.06] p-5"
      data-testid={`home-hero-${state}`}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-warning-500/15 text-warning-300">
          <WarningIcon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-dark-50">{title}</h2>
          {subtitle && <p className="text-sm text-dark-300">{subtitle}</p>}
        </div>
      </div>
      <p className="text-[15px] leading-relaxed text-dark-200">{description}</p>
      <div className="space-y-2.5">
        {primary}
        {secondary}
      </div>
    </section>
  );
}
