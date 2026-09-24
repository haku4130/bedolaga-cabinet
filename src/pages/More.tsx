import type { ComponentType, ReactNode } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';

import { useAuthStore } from '@/store/auth';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useTheme } from '@/hooks/useTheme';
import { useCurrency } from '@/hooks/useCurrency';
import { balanceApi } from '@/api/balance';
import { themeColorsApi } from '@/api/themeColors';
import { API } from '@/config/constants';
import { displayName } from '@/utils/displayName';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import PromoOffersSection from '@/components/PromoOffersSection';
import {
  ChevronRightIcon,
  ClipboardIcon,
  CogIcon,
  GamepadIcon,
  GiftIcon,
  GlobeIcon,
  InfoIcon,
  LogoutIcon,
  MoonIcon,
  NewsIcon,
  SunIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
  WheelIcon,
} from '@/components/icons';

type Icon = ComponentType<{ className?: string }>;

const ROW =
  'flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left text-[15px] font-medium text-dark-100 transition-colors hover:bg-dark-800/60';

function RowIcon({ icon: IconComponent }: { icon: Icon }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-dark-800 text-accent-400">
      <IconComponent className="h-[18px] w-[18px]" />
    </span>
  );
}

function Row({
  to,
  icon,
  label,
  trailing,
}: {
  to: string;
  icon: Icon;
  label: string;
  trailing?: ReactNode;
}) {
  return (
    <Link to={to} className={ROW}>
      <RowIcon icon={icon} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-dark-500" />
    </Link>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-[13px] font-semibold text-dark-400">{title}</h2>
      <div className="divide-y divide-dark-800/70 overflow-hidden rounded-2xl border border-dark-800/70 bg-dark-900/60">
        {children}
      </div>
    </section>
  );
}

/**
 * Всё второстепенное — в одном месте: деньги, бонусы, новости, настройки.
 * Главная и нижний бар остаются под основной сценарий «купить → подключить».
 */
export default function More() {
  const { t } = useTranslation();
  const { user, isAdmin, logout } = useAuthStore(
    useShallow((state) => ({ user: state.user, isAdmin: state.isAdmin, logout: state.logout })),
  );
  const { referralEnabled, wheelEnabled, hasContests, hasPolls, giftEnabled } = useFeatureFlags();
  const { toggleTheme, isDark } = useTheme();
  const { formatWithCurrency } = useCurrency();

  const { data: balance } = useQuery({
    queryKey: ['balance'],
    queryFn: balanceApi.getBalance,
    staleTime: API.BALANCE_STALE_TIME_MS,
  });
  const { data: enabledThemes } = useQuery({
    queryKey: ['enabled-themes'],
    queryFn: themeColorsApi.getEnabledThemes,
    staleTime: 1000 * 60 * 5,
  });
  const canToggleTheme = enabledThemes?.dark && enabledThemes?.light;
  const hasBonuses = referralEnabled || giftEnabled || wheelEnabled || hasContests || hasPolls;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-2xl font-bold text-dark-50">{t('more.title')}</h1>

      <Link
        to="/profile"
        className="flex items-center gap-3 rounded-2xl border border-dark-800/70 bg-dark-900/60 p-4 transition-colors hover:bg-dark-800/60"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-dark-800 text-accent-400">
          <UserIcon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold text-dark-50">
            {displayName(user) || t('nav.profile')}
          </span>
          <span className="block truncate text-sm text-dark-400">{t('more.profileHint')}</span>
        </span>
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-dark-500" />
      </Link>

      <PromoOffersSection />

      <Group title={t('more.groups.money')}>
        <Row
          to="/balance"
          icon={WalletIcon}
          label={t('more.items.balance')}
          trailing={
            balance ? (
              <span className="text-sm text-dark-400">
                {formatWithCurrency(balance.balance_rubles, 0)}
              </span>
            ) : null
          }
        />
      </Group>

      {hasBonuses && (
        <Group title={t('more.groups.bonuses')}>
          {referralEnabled && (
            <Row to="/referral" icon={UsersIcon} label={t('more.items.invite')} />
          )}
          {giftEnabled && <Row to="/gift" icon={GiftIcon} label={t('more.items.gift')} />}
          {wheelEnabled && <Row to="/wheel" icon={WheelIcon} label={t('more.items.wheel')} />}
          {hasContests && (
            <Row to="/contests" icon={GamepadIcon} label={t('more.items.contests')} />
          )}
          {hasPolls && <Row to="/polls" icon={ClipboardIcon} label={t('more.items.polls')} />}
        </Group>
      )}

      <Group title={t('more.groups.info')}>
        <Row to="/news" icon={NewsIcon} label={t('more.items.news')} />
        <Row to="/info" icon={InfoIcon} label={t('more.items.info')} />
      </Group>

      <Group title={t('more.groups.settings')}>
        <div className={ROW}>
          <RowIcon icon={GlobeIcon} />
          <span className="min-w-0 flex-1 truncate">{t('more.items.language')}</span>
          <LanguageSwitcher />
        </div>
        {canToggleTheme && (
          <button type="button" onClick={toggleTheme} className={ROW}>
            <RowIcon icon={isDark ? MoonIcon : SunIcon} />
            <span className="min-w-0 flex-1 truncate">{t('more.items.theme')}</span>
            <span className="text-sm text-dark-400">
              {isDark ? t('theme.dark') : t('theme.light')}
            </span>
          </button>
        )}
      </Group>

      {isAdmin && (
        <Group title={t('admin.nav.title')}>
          <Row to="/admin" icon={CogIcon} label={t('admin.nav.title')} />
        </Group>
      )}

      <button
        type="button"
        onClick={logout}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-medium text-error-400 transition-colors hover:bg-error-500/10"
      >
        <LogoutIcon className="h-[18px] w-[18px]" />
        {t('nav.logout')}
      </button>
    </div>
  );
}
