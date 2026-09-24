// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformProvider } from '@/platform/PlatformProvider';
import {
  CONFIRM_AFTER_CREATED_MS,
  clearPendingCheckout,
  loadPendingCheckout,
  savePendingCheckout,
} from '@/utils/checkout';

/**
 * После оплаты человек видит одно из трёх: ждём платёж; деньги пришли, но
 * автопокупка не сработала — «Оформить»; готово — «Подключить устройство».
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

const api = vi.hoisted(() => ({
  endDate: '2026-09-01T00:00:00Z',
  balance: 0,
  purchaseTariff: vi.fn(async (..._args: unknown[]) => ({ success: true })),
}));

vi.mock('@/api/subscription', () => ({
  subscriptionApi: {
    getSubscriptions: async () => ({
      multi_tariff_enabled: false,
      subscriptions: [{ id: 5, tariff_id: 7, status: 'active', end_date: api.endDate }],
    }),
    purchaseTariff: api.purchaseTariff,
    renewSubscription: vi.fn(),
  },
}));
vi.mock('@/api/balance', () => ({
  balanceApi: {
    getBalance: async () => ({ balance_kopeks: api.balance, balance_rubles: api.balance / 100 }),
  },
}));

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const seed = (createdAt = Date.now()) =>
  savePendingCheckout({
    kind: 'purchase',
    tariffId: 7,
    subscriptionId: null,
    periodDays: 30,
    trafficGb: null,
    label: 'Стандартный · 1 месяц',
    priceKopeks: 19900,
    baselineEndDate: '2026-09-01T00:00:00Z',
    createdAt,
  });

beforeEach(() => {
  api.endDate = '2026-09-01T00:00:00Z';
  api.balance = 0;
  api.purchaseTariff.mockClear();
});

afterEach(() => {
  cleanup();
  clearPendingCheckout();
});

async function renderStatus() {
  const CheckoutStatus = (await import('./CheckoutStatus')).default;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PlatformProvider>
        <MemoryRouter initialEntries={['/subscription/status']}>
          <CheckoutStatus />
        </MemoryRouter>
      </PlatformProvider>
    </QueryClientProvider>,
  );
}

describe('страница статуса оплаты', () => {
  it('подписка продлилась — успех, «Подключить устройство», покупка забыта', async () => {
    seed();
    api.endDate = '2026-10-01T00:00:00Z';
    await renderStatus();
    await waitFor(() => expect(screen.getByText('checkout.done.title')).toBeTruthy());
    expect(screen.getByText('checkout.done.connect').closest('a')?.getAttribute('href')).toBe(
      '/connection?sub=5',
    );
    expect(loadPendingCheckout()).toBeNull();
  });

  it('платёж ещё не дошёл — ждём', async () => {
    seed();
    await renderStatus();
    await waitFor(() => expect(screen.getByText('checkout.waiting.title')).toBeTruthy());
  });

  it('деньги пришли, автопокупки не было — «Оформить» покупает запомненное', async () => {
    seed(Date.now() - CONFIRM_AFTER_CREATED_MS);
    api.balance = 19900;
    await renderStatus();
    const cta = await screen.findByText('checkout.confirm.cta');
    fireEvent.click(cta);
    await waitFor(() =>
      expect(api.purchaseTariff).toHaveBeenCalledWith(7, 30, undefined, undefined),
    );
  });
});
