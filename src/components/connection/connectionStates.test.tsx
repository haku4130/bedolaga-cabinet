// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SubscriptionListItem } from '@/types';

/**
 * Ни один экран подключения не заканчивается без следующего действия.
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

const href = (text: string) => screen.getByText(text).closest('a')?.getAttribute('href');

async function renderWith(node: React.ReactNode) {
  render(<MemoryRouter>{node}</MemoryRouter>);
}

describe('нет подписки', () => {
  it('с триалом — «Попробовать бесплатно» ведёт на главную, где он активируется', async () => {
    const { ConnectionNoSubscription } = await import('./ConnectionStates');
    await renderWith(<ConnectionNoSubscription trialAvailable />);
    expect(href('connect.noSub.tryFree')).toBe('/');
  });

  it('без триала — выбор тарифа', async () => {
    const { ConnectionNoSubscription } = await import('./ConnectionStates');
    await renderWith(<ConnectionNoSubscription trialAvailable={false} />);
    expect(href('connect.noSub.choosePlan')).toBe('/subscription/purchase');
  });
});

describe('подключение настраивается', () => {
  it('пользователю — поддержка', async () => {
    const { ConnectionNotReady } = await import('./ConnectionStates');
    await renderWith(<ConnectionNotReady isAdmin={false} />);
    expect(href('connect.notReady.help')).toBe('/support');
  });

  it('админу — ещё и ссылка на приложения', async () => {
    const { ConnectionNotReady } = await import('./ConnectionStates');
    await renderWith(<ConnectionNotReady isAdmin />);
    expect(href('subscription.connection.goToApps')).toBe('/admin/apps');
  });
});

describe('выбор подписки', () => {
  it('каждая подписка ведёт на своё подключение', async () => {
    const { ConnectionSubscriptionPicker } = await import('./ConnectionStates');
    const subs = [
      { id: 3, tariff_name: 'Стандартный', end_date: '2027-05-29T00:00:00Z' },
      { id: 4, tariff_name: 'Семейный', end_date: null },
    ] as SubscriptionListItem[];
    await renderWith(<ConnectionSubscriptionPicker subscriptions={subs} />);
    expect(href('Стандартный')).toBe('/connection?sub=3');
    expect(href('Семейный')).toBe('/connection?sub=4');
  });
});
