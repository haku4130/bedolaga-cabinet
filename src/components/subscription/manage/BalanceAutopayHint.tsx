import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useHomeFormat } from '@/components/dashboard/home/useHomeFormat';
import { autopayFunding } from '@/utils/autopayFunding';

interface BalanceAutopayHintProps {
  enabled: boolean;
  daysBefore: number;
  balanceKopeks: number | undefined;
  minRenewalKopeks: number | null;
  subscriptionId: number;
}

/**
 * Автопродление списывает с баланса. Если денег меньше самой дешёвой цены
 * продления — прямо говорим, что оно не пройдёт, и даём пополнить недостающее.
 */
export function BalanceAutopayHint({
  enabled,
  daysBefore,
  balanceKopeks,
  minRenewalKopeks,
  subscriptionId,
}: BalanceAutopayHintProps) {
  const { t } = useTranslation();
  const format = useHomeFormat();

  if (!enabled) {
    return (
      <p className="px-1 text-xs text-dark-400">
        {t('manage.autopay.offHint', { count: daysBefore })}
      </p>
    );
  }

  const funding = autopayFunding(balanceKopeks, minRenewalKopeks);
  const onHint = t('manage.autopay.onHint', { count: daysBefore });
  const balance = format.price(balanceKopeks ?? 0);

  if (funding.state === 'short') {
    const params = new URLSearchParams({
      amount: String(Math.ceil(funding.missingKopeks / 100)),
      returnTo: `/subscriptions/${subscriptionId}`,
    });
    return (
      <div className="space-y-2.5 rounded-[14px] border border-warning-500/30 bg-warning-500/10 p-3.5">
        <p className="text-sm text-warning-300">
          {onHint} {t('manage.autopay.short', { amount: balance })}
        </p>
        <Link
          to={`/balance/top-up?${params.toString()}`}
          className="btn-secondary inline-flex items-center justify-center px-4 py-2 text-sm font-medium"
        >
          {t('manage.autopay.topUp')}
        </Link>
      </div>
    );
  }

  return (
    <p className="px-1 text-xs text-dark-400">
      {onHint}
      {funding.state === 'ok' && ` ${t('manage.autopay.balance', { amount: balance })}`}
    </p>
  );
}
