// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Страница «Управление подпиской»: честное автопродление, короткий статус со
 * ссылкой на устройства и свёрнутые подробности.
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

const renderIn = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);

describe('BalanceAutopayHint', () => {
  const base = { daysBefore: 3, subscriptionId: 17, minRenewalKopeks: 10900 };

  it('выключено — пояснение, без кнопки', async () => {
    const { BalanceAutopayHint } = await import('./BalanceAutopayHint');
    renderIn(<BalanceAutopayHint {...base} enabled={false} balanceKopeks={0} />);
    expect(screen.getByText('manage.autopay.offHint')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('включено и денег не хватает — предупреждение и пополнение на недостающее', async () => {
    const { BalanceAutopayHint } = await import('./BalanceAutopayHint');
    renderIn(<BalanceAutopayHint {...base} enabled balanceKopeks={0} />);
    expect(screen.getByText(/manage\.autopay\.short/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'manage.autopay.topUp' }).getAttribute('href')).toBe(
      '/balance/top-up?amount=109&returnTo=%2Fsubscriptions%2F17',
    );
  });

  it('включено и денег не меньше минимума — баланс без кнопки', async () => {
    const { BalanceAutopayHint } = await import('./BalanceAutopayHint');
    renderIn(<BalanceAutopayHint {...base} enabled balanceKopeks={25000} />);
    expect(screen.getByText(/manage\.autopay\.balance/)).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('StatusFacts', () => {
  const sub = { id: 17, days_left: 247, end_date: '2027-05-29T00:00:00Z', is_daily: false };

  it('дни и ссылка на устройства этой подписки', async () => {
    const { StatusFacts } = await import('./StatusFacts');
    renderIn(<StatusFacts subscription={{ ...sub, device_limit: 3 }} connectedDevices={1} />);
    expect(screen.getByText('247')).toBeTruthy();
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/connection?sub=17');
    expect(link.textContent).toContain('home.devicesCount');
  });

  it('без лимита устройств — «k · без лимита»', async () => {
    const { StatusFacts } = await import('./StatusFacts');
    renderIn(<StatusFacts subscription={{ ...sub, device_limit: 0 }} connectedDevices={2} />);
    expect(screen.getByRole('link').textContent).toContain('home.devicesUnlimited');
  });
});

describe('CollapsibleSection', () => {
  it('свёрнута по умолчанию и раскрывается', async () => {
    const { CollapsibleSection } = await import('./CollapsibleSection');
    renderIn(
      <CollapsibleSection title="manage.sections.details">
        <p>содержимое</p>
      </CollapsibleSection>,
    );
    const toggle = screen.getByRole('button', { name: /manage\.sections\.details/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('содержимое')).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('содержимое')).toBeTruthy();
  });
});
