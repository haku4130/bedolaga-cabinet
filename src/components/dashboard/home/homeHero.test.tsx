// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Subscription, TrialInfo } from '@/types';
import type { HeroState } from '@/utils/homeState';

/**
 * В каждом состоянии — ровно одна главная кнопка, и ведёт она туда, где
 * человек сделает следующий шаг. Тест держит эту таблицу (spec 5.1).
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

const subscription = (overrides: Partial<Subscription> = {}): Subscription => ({
  id: 42,
  status: 'active',
  is_trial: false,
  start_date: '2026-08-07T00:00:00Z',
  end_date: '2027-05-29T00:00:00Z',
  days_left: 247,
  hours_left: 0,
  minutes_left: 0,
  time_left_display: '',
  traffic_limit_gb: 0,
  traffic_used_gb: 0,
  traffic_used_percent: 0,
  device_limit: 3,
  connected_squads: [],
  servers: [],
  autopay_enabled: false,
  autopay_days_before: 3,
  subscription_url: 'https://example.com/sub/abc',
  hide_subscription_link: false,
  is_active: true,
  is_expired: false,
  is_limited: false,
  tariff_id: 7,
  tariff_name: 'Стандартный',
  ...overrides,
});

const trial = (overrides: Partial<TrialInfo> = {}): TrialInfo => ({
  is_available: true,
  duration_days: 3,
  traffic_limit_gb: 0,
  device_limit: 3,
  requires_payment: false,
  price_kopeks: 0,
  price_rubles: 0,
  reason_unavailable: null,
  ...overrides,
});

async function renderHero(
  state: HeroState,
  overrides: Partial<Parameters<typeof import('./HomeHero').HomeHero>[0]> = {},
) {
  const { HomeHero } = await import('./HomeHero');
  const onActivateTrial = vi.fn();
  render(
    <MemoryRouter>
      <HomeHero
        state={state}
        subscription={null}
        trial={undefined}
        connectedDevices={undefined}
        balanceKopeks={0}
        minPlanPriceKopeks={10900}
        onActivateTrial={onActivateTrial}
        isActivatingTrial={false}
        trialError={null}
        {...overrides}
      />
    </MemoryRouter>,
  );
  const primaries = screen.getAllByTestId('home-primary');
  expect(primaries).toHaveLength(1);
  return { primary: primaries[0], onActivateTrial };
}

describe('новичок', () => {
  it('бесплатный триал — кнопка активирует триал, покупка вторична', async () => {
    const { primary, onActivateTrial } = await renderHero('new_trial', { trial: trial() });
    fireEvent.click(primary);
    expect(onActivateTrial).toHaveBeenCalledOnce();
    expect(screen.getByTestId('home-secondary').getAttribute('href')).toBe(
      '/subscription/purchase',
    );
  });

  it('платный триал без денег — ведёт на пополнение недостающего', async () => {
    const { primary } = await renderHero('new_paid_trial', {
      trial: trial({ requires_payment: true, price_kopeks: 5000, price_rubles: 50 }),
      balanceKopeks: 0,
    });
    expect(primary.getAttribute('href')).toBe('/balance/top-up?amount=50&returnTo=%2F');
  });

  it('платный триал с деньгами — активирует сразу', async () => {
    const { primary, onActivateTrial } = await renderHero('new_paid_trial', {
      trial: trial({ requires_payment: true, price_kopeks: 5000, price_rubles: 50 }),
      balanceKopeks: 5000,
    });
    fireEvent.click(primary);
    expect(onActivateTrial).toHaveBeenCalledOnce();
  });

  it('без триала — выбор тарифа', async () => {
    const { primary } = await renderHero('new');
    expect(primary.getAttribute('href')).toBe('/subscription/purchase');
  });
});

describe('подписка работает', () => {
  it('есть свободные места — подключить ещё устройство', async () => {
    const { primary } = await renderHero('active', {
      subscription: subscription(),
      connectedDevices: 1,
    });
    expect(primary.getAttribute('href')).toBe('/connection?sub=42');
  });

  it('все места заняты — мои устройства', async () => {
    const { primary } = await renderHero('active', {
      subscription: subscription(),
      connectedDevices: 3,
    });
    expect(primary.getAttribute('href')).toBe('/subscriptions/42');
  });

  it('ни одного устройства — подключить устройство', async () => {
    const { primary } = await renderHero('active_no_devices', {
      subscription: subscription(),
      connectedDevices: 0,
    });
    expect(primary.getAttribute('href')).toBe('/connection?sub=42');
  });

  it('скоро закончится — продлить', async () => {
    const { primary } = await renderHero('expiring', {
      subscription: subscription({ days_left: 2 }),
      connectedDevices: 1,
    });
    expect(primary.getAttribute('href')).toBe('/subscriptions/42/renew');
  });

  it('скоро закончится триал — выбрать тариф, триал не продлевается', async () => {
    const { primary } = await renderHero('expiring', {
      subscription: subscription({ days_left: 1, is_trial: true }),
      connectedDevices: 1,
    });
    expect(primary.getAttribute('href')).toBe('/subscription/purchase');
  });

  it('полоса трафика — только у лимитного тарифа', async () => {
    await renderHero('active', { subscription: subscription(), connectedDevices: 1 });
    expect(screen.queryByTestId('home-traffic')).toBeNull();
    cleanup();
    await renderHero('active', {
      subscription: subscription({
        traffic_limit_gb: 250,
        traffic_used_gb: 20,
        traffic_used_percent: 8,
      }),
      connectedDevices: 1,
    });
    expect(screen.getByTestId('home-traffic')).toBeTruthy();
  });
});

describe('подписка не работает', () => {
  it('истекла — продлить, другой тариф вторичен', async () => {
    const { primary } = await renderHero('expired', {
      subscription: subscription({ is_expired: true, days_left: 0 }),
    });
    expect(primary.getAttribute('href')).toBe('/subscriptions/42/renew');
    expect(screen.getByTestId('home-secondary').getAttribute('href')).toBe(
      '/subscription/purchase',
    );
  });

  it('истёк триал — выбрать тариф', async () => {
    const { primary } = await renderHero('expired_trial', {
      subscription: subscription({ is_trial: true, is_expired: true, days_left: 0 }),
    });
    expect(primary.getAttribute('href')).toBe('/subscription/purchase');
  });

  it('кончился трафик — докупить на странице подписки', async () => {
    const { primary } = await renderHero('traffic_exhausted', {
      subscription: subscription({ is_limited: true, traffic_limit_gb: 100 }),
    });
    expect(primary.getAttribute('href')).toBe('/subscriptions/42');
  });
});
