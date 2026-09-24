import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { Subscription } from '@/types';
import { PrimaryLink, SecondaryLink } from './heroActions';
import { useHomeFormat } from './useHomeFormat';

interface ActiveHeroProps {
  state: 'active' | 'active_no_devices' | 'expiring';
  subscription: Subscription;
  connectedDevices: number | undefined;
}

/** Сегменты устройств рисуем до 10 мест; дальше — только число. */
const MAX_DEVICE_SEGMENTS = 10;

export function ActiveHero({ state, subscription: sub, connectedDevices }: ActiveHeroProps) {
  const { t } = useTranslation();
  const format = useHomeFormat();

  const used = connectedDevices ?? 0;
  const limit = sub.device_limit;
  const canAddDevice = limit === 0 || used < limit;

  const connectTo = `/connection?sub=${sub.id}`;
  const manageTo = `/subscriptions/${sub.id}`;
  // Триал не продлевается — вместо «Продлить» ведём к выбору тарифа.
  const renewTo = sub.is_trial ? '/subscription/purchase' : `/subscriptions/${sub.id}/renew`;
  const renewLabel = sub.is_trial ? t('home.cta.choosePlan') : t('home.cta.renew');
  const manage = <SecondaryLink to={manageTo}>{t('home.cta.manage')}</SecondaryLink>;

  let primary: ReactNode;
  let secondary: ReactNode = manage;
  if (state === 'active_no_devices') {
    primary = <PrimaryLink to={connectTo}>{t('home.cta.connect')}</PrimaryLink>;
  } else if (state === 'expiring') {
    primary = <PrimaryLink to={renewTo}>{renewLabel}</PrimaryLink>;
  } else {
    primary = canAddDevice ? (
      <PrimaryLink to={connectTo}>
        <PlusIcon className="h-5 w-5" />
        {t('home.cta.connectMore')}
      </PrimaryLink>
    ) : (
      <PrimaryLink to={manageTo}>{t('home.cta.myDevices')}</PrimaryLink>
    );
    if (!sub.is_daily) {
      secondary = (
        <div className="grid grid-cols-2 gap-2.5">
          <SecondaryLink to={renewTo}>{renewLabel}</SecondaryLink>
          {manage}
        </div>
      );
    }
  }

  const planSummary = [sub.tariff_name, sub.traffic_limit_gb === 0 ? t('home.unlimited') : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className="bento-card space-y-5" data-testid={`home-hero-${state}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-success-500/15 px-3 py-1.5 text-[13px] font-semibold text-success-400">
          <span className="h-2 w-2 rounded-full bg-success-400" aria-hidden="true" />
          {sub.is_trial ? t('home.status.trial') : t('home.status.active')}
        </span>
        <span className="min-w-0 truncate text-[13px] font-medium text-dark-400">
          {planSummary}
        </span>
      </div>

      {sub.is_daily ? (
        <div className="space-y-1">
          <p className="text-2xl font-bold text-dark-50">{t('home.daily.title')}</p>
          <p className="text-sm text-dark-400">{t('home.daily.desc')}</p>
        </div>
      ) : (
        <div className="space-y-1">
          <p className="flex items-baseline gap-2">
            <span className="text-5xl font-extrabold leading-none tracking-tight text-dark-50">
              {sub.days_left}
            </span>
            <span className="text-lg font-semibold text-dark-300">
              {t('home.daysUnit', { count: sub.days_left })}
            </span>
          </p>
          <p className="text-sm text-dark-400">
            {t('home.until', { date: format.date(sub.end_date) })}
          </p>
        </div>
      )}

      {sub.traffic_limit_gb > 0 && (
        <div className="space-y-1.5" data-testid="home-traffic">
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-dark-100">{t('home.traffic')}</span>
            <span className="text-dark-300">
              {t('home.trafficUsage', {
                used: sub.traffic_used_gb.toFixed(1),
                limit: sub.traffic_limit_gb,
              })}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-dark-700">
            <div
              className="h-full rounded-full bg-accent-400"
              style={{ width: `${Math.min(100, Math.max(0, sub.traffic_used_percent))}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-2.5 rounded-xl bg-dark-900/60 p-3.5">
        <div className="flex justify-between text-sm">
          <span className="font-semibold text-dark-100">{t('home.devices')}</span>
          <span className="text-dark-300">
            {limit === 0
              ? t('home.devicesUnlimited', { used })
              : t('home.devicesCount', { used, max: limit })}
          </span>
        </div>
        {limit > 0 && limit <= MAX_DEVICE_SEGMENTS && (
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${limit}, minmax(0, 1fr))` }}
            aria-hidden="true"
          >
            {Array.from({ length: limit }, (_, index) => (
              <span
                key={index}
                className={cn('h-1.5 rounded-full', index < used ? 'bg-accent-400' : 'bg-dark-700')}
              />
            ))}
          </div>
        )}
      </div>

      {state === 'expiring' && (
        <p className="rounded-xl border border-warning-500/30 bg-warning-500/10 p-3 text-sm text-warning-300">
          {t('home.expiringNote', { count: sub.days_left })}
        </p>
      )}
      {state === 'active_no_devices' && (
        <p className="text-sm leading-relaxed text-dark-300">{t('home.connectFirst')}</p>
      )}

      <div className="space-y-2.5">
        {primary}
        {secondary}
      </div>
    </section>
  );
}
