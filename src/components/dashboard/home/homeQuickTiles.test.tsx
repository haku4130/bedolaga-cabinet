// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Под главной карточкой — всегда две плитки: баланс и приглашение друга.
 * Текст плитки друга зависит от того, что у человека уже есть: статистика,
 * процент программы или общий призыв.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ru', changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({ formatWithCurrency: (value: number) => `${value} ₽` }),
}));

afterEach(cleanup);

async function renderTiles(props: Parameters<typeof import('./HomeQuickTiles').HomeQuickTiles>[0]) {
  const { HomeQuickTiles } = await import('./HomeQuickTiles');
  render(
    <MemoryRouter>
      <HomeQuickTiles {...props} />
    </MemoryRouter>,
  );
}

describe('HomeQuickTiles', () => {
  it('баланс ведёт на /balance', async () => {
    await renderTiles({ balanceRubles: 150, referral: null, referralEnabled: false });
    expect(screen.getByTestId('home-tile-balance').getAttribute('href')).toBe('/balance');
    expect(screen.getByText('150 ₽')).toBeTruthy();
  });

  it('без реферальной программы — одна плитка', async () => {
    await renderTiles({ balanceRubles: 0, referral: null, referralEnabled: false });
    expect(screen.queryByTestId('home-tile-invite')).toBeNull();
  });

  it('есть приглашённые — показываем статистику', async () => {
    await renderTiles({
      balanceRubles: 0,
      referral: { totalReferrals: 2, earningsRubles: 40, commissionPercent: 10 },
      referralEnabled: true,
    });
    expect(screen.getByTestId('home-tile-invite').getAttribute('href')).toBe('/referral');
    expect(screen.getByText('home.tiles.inviteStats')).toBeTruthy();
  });

  it('никого нет, но есть процент — показываем процент', async () => {
    await renderTiles({
      balanceRubles: 0,
      referral: { totalReferrals: 0, earningsRubles: 0, commissionPercent: 10 },
      referralEnabled: true,
    });
    expect(screen.getByText('home.tiles.inviteCommission')).toBeTruthy();
  });
});
