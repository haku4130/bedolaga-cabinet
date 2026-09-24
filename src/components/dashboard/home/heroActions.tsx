import type { ReactNode } from 'react';
import { Link } from 'react-router';

const PRIMARY =
  'btn-primary flex w-full items-center justify-center gap-2 py-3.5 text-base font-semibold';
const SECONDARY = 'btn-secondary flex w-full items-center justify-center py-3 text-sm font-medium';

/** Главное действие карточки. В карточке оно ровно одно. */
export function PrimaryLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={PRIMARY} data-testid="home-primary">
      {children}
    </Link>
  );
}

export function PrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={PRIMARY}
      data-testid="home-primary"
    >
      {children}
    </button>
  );
}

export function SecondaryLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={SECONDARY} data-testid="home-secondary">
      {children}
    </Link>
  );
}
