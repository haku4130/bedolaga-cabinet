import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChevronRightIcon } from '@/components/icons';
import { useCurrency } from '@/hooks/useCurrency';
import { cn } from '@/lib/utils';

interface ReferralSummary {
  totalReferrals: number;
  earningsRubles: number;
  commissionPercent: number;
}

interface HomeQuickTilesProps {
  /** undefined — баланс ещё грузится. */
  balanceRubles: number | undefined;
  referral: ReferralSummary | null;
  referralEnabled: boolean;
}

function Tile({
  to,
  label,
  testId,
  children,
}: {
  to: string;
  label: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} data-testid={testId} className="bento-card-hover flex min-w-0 flex-col gap-2.5">
      <span className="flex items-center justify-between text-[13px] font-semibold text-dark-400">
        {label}
        <ChevronRightIcon className="h-4 w-4" />
      </span>
      {children}
    </Link>
  );
}

/** Баланс и приглашение друга — компактно, под главной карточкой. */
export function HomeQuickTiles({ balanceRubles, referral, referralEnabled }: HomeQuickTilesProps) {
  const { t } = useTranslation();
  const { formatWithCurrency } = useCurrency();
  const money = (rubles: number) => formatWithCurrency(rubles, Number.isInteger(rubles) ? 0 : 2);

  let inviteText = t('home.tiles.inviteDefault');
  if (referral && referral.totalReferrals > 0) {
    inviteText = t('home.tiles.inviteStats', {
      count: referral.totalReferrals,
      amount: money(referral.earningsRubles),
    });
  } else if (referral && referral.commissionPercent > 0) {
    inviteText = t('home.tiles.inviteCommission', { percent: referral.commissionPercent });
  }

  return (
    <div className={cn('grid gap-3', referralEnabled ? 'grid-cols-2' : 'grid-cols-1')}>
      <Tile to="/balance" label={t('home.tiles.balance')} testId="home-tile-balance">
        <span className="text-xl font-bold text-dark-50">
          {balanceRubles === undefined ? '—' : money(balanceRubles)}
        </span>
      </Tile>
      {referralEnabled && (
        <Tile to="/referral" label={t('home.tiles.invite')} testId="home-tile-invite">
          <span className="text-sm font-medium leading-snug text-dark-300">{inviteText}</span>
        </Tile>
      )}
    </div>
  );
}
