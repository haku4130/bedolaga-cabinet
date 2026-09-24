import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { usePlatform } from '../platform';
import { BackIcon } from './icons';

type WebBackButtonProps = {
  replace?: boolean;
  className?: string;
} & ({ to: string; onClick?: never } | { to?: never; onClick: () => void });

const DEFAULT_CLASS =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-dark-700 bg-dark-800 transition-colors hover:border-dark-600';

/**
 * Back button visible only on web platform.
 * Hidden in Telegram Mini App — native back button handles navigation there.
 * Either links to a fixed `to`, or runs `onClick` (e.g. history-aware back).
 */
export function WebBackButton({ to, onClick, replace, className }: WebBackButtonProps) {
  const { t } = useTranslation();
  const { platform } = usePlatform();
  const label = t('common.back');

  if (platform === 'telegram') return null;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={className || DEFAULT_CLASS}
      >
        <BackIcon />
      </button>
    );
  }

  return (
    <Link to={to} replace={replace} aria-label={label} className={className || DEFAULT_CLASS}>
      <BackIcon />
    </Link>
  );
}
