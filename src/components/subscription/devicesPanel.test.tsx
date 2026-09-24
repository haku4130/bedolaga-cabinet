// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlatformProvider } from '@/platform/PlatformProvider';

/**
 * «Мои устройства» живут и на странице подписки, и на вкладке «Устройства»:
 * один компонент, одни и те же действия.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ru', changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const api = vi.hoisted(() => ({
  deleteDevice: vi.fn(async (..._args: unknown[]) => ({})),
}));

vi.mock('@/api/subscription', () => ({
  subscriptionApi: {
    getDevices: async () => ({
      total: 2,
      device_limit: 3,
      devices: [
        { hwid: 'aaaa1111', platform: 'iOS', device_model: 'iPhone 15', created_at: null },
        {
          hwid: 'bbbb2222',
          platform: 'macOS',
          device_model: 'Mac',
          created_at: null,
          local_name: 'Рабочий',
        },
      ],
    }),
    deleteDevice: api.deleteDevice,
    deleteAllDevices: vi.fn(),
    renameDevice: vi.fn(),
  },
}));
vi.mock('@/platform/hooks/useNativeDialog', () => ({
  useDestructiveConfirm: () => async () => true,
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

afterEach(cleanup);

async function renderPanel() {
  const { DevicesPanel } = await import('./DevicesPanel');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PlatformProvider>
        <DevicesPanel subscriptionId={5} />
      </PlatformProvider>
    </QueryClientProvider>,
  );
}

describe('DevicesPanel', () => {
  it('показывает устройства: своё имя важнее модели', async () => {
    await renderPanel();
    expect(await screen.findByText('iPhone 15')).toBeTruthy();
    expect(screen.getByText('Рабочий')).toBeTruthy();
  });

  it('удаление устройства после подтверждения', async () => {
    await renderPanel();
    await screen.findByText('iPhone 15');
    fireEvent.click(screen.getAllByLabelText('subscription.deleteDevice')[0]);
    await waitFor(() => expect(api.deleteDevice).toHaveBeenCalledWith('aaaa1111', 5));
  });
});
