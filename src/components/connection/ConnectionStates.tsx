import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChatIcon, ChevronRightIcon, SettingsIcon } from '@/components/icons';
import { useHomeFormat } from '@/components/dashboard/home/useHomeFormat';
import type { SubscriptionListItem } from '@/types';

const PRIMARY =
  'btn-primary flex w-full items-center justify-center gap-2 py-3.5 text-base font-semibold';
const SECONDARY =
  'btn-secondary flex w-full items-center justify-center gap-2 py-3 text-sm font-medium';

function StateCard({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 pt-6 text-center">
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-dark-50">{title}</h1>
        <p className="text-[15px] leading-relaxed text-dark-300">{text}</p>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

/** Подписки нет: объясняем и ведём туда, где её получить. */
export function ConnectionNoSubscription({ trialAvailable }: { trialAvailable: boolean }) {
  const { t } = useTranslation();
  return (
    <StateCard title={t('connect.noSub.title')} text={t('connect.noSub.desc')}>
      {trialAvailable ? (
        <>
          <Link to="/" className={PRIMARY}>
            {t('connect.noSub.tryFree')}
          </Link>
          <Link to="/subscription/purchase" className={SECONDARY}>
            {t('connect.noSub.choosePlan')}
          </Link>
        </>
      ) : (
        <Link to="/subscription/purchase" className={PRIMARY}>
          {t('connect.noSub.choosePlan')}
        </Link>
      )}
    </StateCard>
  );
}

/** Приложения для подключения ещё не настроены в панели. */
export function ConnectionNotReady({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation();
  return (
    <StateCard
      title={t('connect.notReady.title')}
      text={isAdmin ? t('connect.notReady.adminHint') : t('connect.notReady.desc')}
    >
      {isAdmin && (
        <Link to="/admin/apps" className={PRIMARY}>
          <SettingsIcon className="h-4 w-4" />
          {t('subscription.connection.goToApps')}
        </Link>
      )}
      <Link to="/support" className={SECONDARY}>
        <ChatIcon className="h-4 w-4" />
        {t('connect.notReady.help')}
      </Link>
    </StateCard>
  );
}

/** Мультитариф: сначала — какую подписку подключаем. */
export function ConnectionSubscriptionPicker({
  subscriptions,
}: {
  subscriptions: SubscriptionListItem[];
}) {
  const { t } = useTranslation();
  const format = useHomeFormat();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-bold text-dark-50">{t('connect.pick.title')}</h1>
      <div className="space-y-2">
        {subscriptions.map((sub) => (
          <Link
            key={sub.id}
            to={`/connection?sub=${sub.id}`}
            className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-dark-700/50 bg-dark-800/50 px-4 py-3 transition-colors hover:bg-dark-800"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold text-dark-50">
                {sub.tariff_name || t('subscription.defaultName', 'Подписка')}
              </span>
              {sub.end_date && (
                <span className="block text-sm text-dark-400">
                  {t('connect.pick.until', { date: format.date(sub.end_date) })}
                </span>
              )}
            </span>
            <ChevronRightIcon className="h-4 w-4 shrink-0 text-dark-500" />
          </Link>
        ))}
      </div>
    </div>
  );
}
