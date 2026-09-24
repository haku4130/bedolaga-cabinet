import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChevronRightIcon } from '@/components/icons';
import { useHomeFormat } from '@/components/dashboard/home/useHomeFormat';
import type { Subscription } from '@/types';

interface StatusFactsProps {
  subscription: Pick<Subscription, 'id' | 'days_left' | 'end_date' | 'device_limit' | 'is_daily'>;
  connectedDevices: number | undefined;
}

/**
 * Главное о подписке одной строкой и вход в устройства: подключение и список
 * устройств живут на вкладке «Устройства», здесь — только ссылка туда.
 */
export function StatusFacts({ subscription: sub, connectedDevices }: StatusFactsProps) {
  const { t } = useTranslation();
  const format = useHomeFormat();
  const used = connectedDevices ?? 0;

  return (
    <div className="mb-6 space-y-3">
      {!sub.is_daily && (
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-dark-300">
          <span className="text-3xl font-extrabold leading-none tracking-tight text-dark-50">
            {sub.days_left}
          </span>
          <span>
            {t('home.daysUnit', { count: sub.days_left })} ·{' '}
            {t('home.until', { date: format.date(sub.end_date) })}
          </span>
        </p>
      )}
      <Link
        to={`/connection?sub=${sub.id}`}
        className="flex min-h-[48px] items-center justify-between gap-3 rounded-[14px] border border-dark-700/50 bg-dark-900/40 px-3.5 text-sm transition-colors hover:bg-dark-800/60"
      >
        <span className="font-semibold text-dark-100">{t('manage.devices')}</span>
        <span className="flex items-center gap-1.5 text-dark-300">
          {sub.device_limit === 0
            ? t('home.devicesUnlimited', { used })
            : t('home.devicesCount', { used, max: sub.device_limit })}
          <ChevronRightIcon className="h-4 w-4 text-dark-500" />
        </span>
      </Link>
    </div>
  );
}
