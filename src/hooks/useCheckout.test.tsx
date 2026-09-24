// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearPendingCheckout, loadPendingCheckout } from '@/utils/checkout';

/**
 * «Оплатить»: хватает денег — списываем и ведём на статус; не хватает —
 * ведём на оплату у провайдера, помня, ради чего платят.
 */

vi.mock('@/api/subscription', () => ({
  subscriptionApi: {
    getSubscriptions: async () => ({
      multi_tariff_enabled: false,
      subscriptions: [
        {
          id: 5,
          tariff_id: 7,
          status: 'active',
          end_date: '2026-09-01T00:00:00Z',
          device_limit: 3,
          traffic_limit_gb: 100,
        },
      ],
    }),
  },
}));

afterEach(() => {
  cleanup();
  clearPendingCheckout();
});

function error402(cartSaved: boolean) {
  const headers = new AxiosHeaders();
  return new AxiosError(
    'Payment Required',
    'ERR_BAD_REQUEST',
    { headers },
    {},
    {
      status: 402,
      statusText: 'Payment Required',
      headers,
      config: { headers },
      data: {
        detail: { code: 'insufficient_funds', missing_amount: 4950, cart_saved: cartSaved },
      },
    },
  );
}

let started: ReturnType<typeof import('./useCheckout').useCheckout> | null = null;

function Location() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname + location.search}</span>;
}

async function mount() {
  const { useCheckout } = await import('./useCheckout');
  function Probe() {
    started = useCheckout();
    return null;
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/subscription/purchase']}>
        <Probe />
        <Routes>
          <Route path="*" element={<Location />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const request = (pay: () => Promise<unknown>) => ({
  kind: 'purchase' as const,
  tariffId: 7,
  subscriptionId: null,
  periodDays: 30,
  trafficGb: null,
  label: 'Стандартный · 1 месяц',
  priceKopeks: 19900,
  pay,
});

describe('useCheckout', () => {
  it('денег хватает — статус оплаты, покупка запомнена с датой до оплаты', async () => {
    await mount();
    act(() => started?.start(request(async () => ({ success: true }))));
    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toBe('/subscription/status'),
    );
    expect(loadPendingCheckout()?.baselineEndDate).toBe('2026-09-01T00:00:00Z');
  });

  it('не хватает и корзина сохранена — оплата у провайдера на недостающее', async () => {
    await mount();
    act(() =>
      started?.start(
        request(async () => {
          throw error402(true);
        }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toBe(
        '/balance/top-up?amount=50&purpose=subscription',
      ),
    );
    expect(loadPendingCheckout()).not.toBeNull();
  });

  it('докупка устройств запоминает лимиты до оплаты', async () => {
    await mount();
    act(() =>
      started?.start({
        ...request(async () => ({ success: true })),
        kind: 'devices',
        subscriptionId: 5,
        devices: 1,
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toBe('/subscription/status'),
    );
    const saved = loadPendingCheckout();
    expect(saved?.devices).toBe(1);
    expect(saved?.baselineDeviceLimit).toBe(3);
    expect(saved?.baselineTrafficLimitGb).toBe(100);
  });

  it('корзина не сохранена — ошибка на месте, покупка забыта', async () => {
    await mount();
    act(() =>
      started?.start(
        request(async () => {
          throw error402(false);
        }),
      ),
    );
    await waitFor(() => expect(started?.error).toBeTruthy());
    expect(screen.getByTestId('location').textContent).toBe('/subscription/purchase');
    expect(loadPendingCheckout()).toBeNull();
  });
});
