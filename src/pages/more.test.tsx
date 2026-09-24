// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/auth';
import type { User } from '@/types';

/**
 * «Ещё» — единственное место для всего второстепенного: баланс, рефералы,
 * подарки, колесо, конкурсы, опросы, новости, инструкции, язык, тема, выход.
 * Пункт выключенной фичи не показывается; админка — только админу (на телефоне
 * это теперь единственный вход в неё: бургер-меню убрано).
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ru', changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const flags = vi.hoisted(() => ({
  referralEnabled: true as boolean | undefined,
  wheelEnabled: false as boolean | undefined,
  hasContests: true as boolean | undefined,
  hasPolls: false as boolean | undefined,
  giftEnabled: true as boolean | undefined,
}));

vi.mock('@/hooks/useFeatureFlags', () => ({ useFeatureFlags: () => flags }));
vi.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ toggleTheme: () => {}, isDark: true }) }));
vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({ formatWithCurrency: (value: number) => `${value} ₽` }),
}));
vi.mock('@/api/balance', () => ({
  balanceApi: { getBalance: async () => ({ balance_kopeks: 0, balance_rubles: 0 }) },
}));
vi.mock('@/api/themeColors', () => ({
  themeColorsApi: { getEnabledThemes: async () => ({ dark: true, light: true }) },
}));
vi.mock('@/components/LanguageSwitcher', () => ({ default: () => null }));
vi.mock('@/components/PromoOffersSection', () => ({ default: () => null }));

afterEach(() => {
  cleanup();
  useAuthStore.setState({ isAdmin: false });
});

async function renderMore() {
  const More = (await import('./More')).default;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <More />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return screen.getAllByRole('link').map((link) => link.getAttribute('href'));
}

describe('раздел «Ещё»', () => {
  it('постоянные пункты есть всегда', async () => {
    const hrefs = await renderMore();
    for (const path of ['/profile', '/balance', '/news', '/info']) {
      expect(hrefs, path).toContain(path);
    }
  });

  it('бонусные пункты следуют флагам фич', async () => {
    const hrefs = await renderMore();
    expect(hrefs).toContain('/referral');
    expect(hrefs).toContain('/gift');
    expect(hrefs).toContain('/contests');
    expect(hrefs).not.toContain('/wheel');
    expect(hrefs).not.toContain('/polls');
  });

  it('админка видна только админу', async () => {
    useAuthStore.setState({ user: { id: 1, first_name: 'Test' } as User, isAdmin: true });
    expect(await renderMore()).toContain('/admin');
    cleanup();
    useAuthStore.setState({ isAdmin: false });
    expect(await renderMore()).not.toContain('/admin');
  });
});
