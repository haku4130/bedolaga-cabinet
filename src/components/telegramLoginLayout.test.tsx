// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Обвязка — как в telegramLoginButtonConsent.test.tsx: стаб Telegram.Login и
// моки стора/брендинга, чтобы кнопка отрисовалась в режиме OIDC.

// `t` стабильна между рендерами, как у настоящего i18next: она в зависимостях эффектов.
const { loginWithTelegramOIDC, navigate, translation } = vi.hoisted(() => ({
  loginWithTelegramOIDC: vi.fn(),
  navigate: vi.fn(),
  translation: {
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'ru', changeLanguage: () => Promise.resolve() },
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => translation,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}));

vi.mock('../store/auth', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      loginWithTelegramOIDC,
      loginWithTelegramWidget: vi.fn(),
      loginWithDeepLink: vi.fn(),
    }),
}));

vi.mock('../api/branding', () => ({
  brandingApi: {
    getTelegramWidgetConfig: () =>
      Promise.resolve({
        bot_username: 'bot',
        oidc_enabled: true,
        oidc_client_id: '42',
        request_access: false,
        size: 'large',
        radius: 20,
        userpic: true,
      }),
  },
}));

vi.mock('../api/auth', () => ({ authApi: {} }));

type OIDCCallback = (data: { id_token?: string; error?: string }) => void;
const SCRIPT_ID = 'telegram-login-oidc-script';

function installTelegramLoginStub(): {
  init: ReturnType<typeof vi.fn>;
  callback: () => OIDCCallback;
} {
  let captured: OIDCCallback | undefined;
  const init = vi.fn((_config: unknown, callback: OIDCCallback) => {
    captured = callback;
  });
  (window as unknown as { Telegram: unknown }).Telegram = { Login: { init, open: vi.fn() } };
  // Скрипт «уже загружен»: компонент тогда сразу зовёт Telegram.Login.init,
  // а не ждёт onload внешнего скрипта, который jsdom никогда не выполнит.
  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  document.head.appendChild(script);
  return {
    init,
    callback: () => {
      if (!captured) throw new Error('Telegram.Login.init was not called');
      return captured;
    },
  };
}

async function renderButton() {
  const { default: TelegramLoginButton } = await import('./TelegramLoginButton');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TelegramLoginButton />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  loginWithTelegramOIDC.mockReset();
  navigate.mockReset();
});

afterEach(() => {
  cleanup();
  document.getElementById(SCRIPT_ID)?.remove();
  (window as unknown as { Telegram?: unknown }).Telegram = undefined;
});

/**
 * На вебе одна главная кнопка — «Войти через Telegram». Вход через бота —
 * запасной путь ссылкой, а не второй такой же крупной кнопкой рядом.
 */
describe('раскладка кнопки входа', () => {
  it('главная кнопка на всю ширину и подпись про автосоздание аккаунта', async () => {
    installTelegramLoginStub();
    await renderButton();
    const primary = await screen.findByRole('button', { name: /auth\.loginWithTelegram/ });
    expect(primary.className).toContain('w-full');
    expect(screen.getByText('login.autoCreate')).toBeTruthy();
  });

  it('вход через бота — ссылкой, крупной кнопки «Войти через бота» нет', async () => {
    installTelegramLoginStub();
    await renderButton();
    await screen.findByRole('button', { name: /auth\.loginWithTelegram/ });
    expect(screen.getByRole('button', { name: 'login.botFallback' })).toBeTruthy();
    expect(screen.queryByText('auth.loginWithBot')).toBeNull();
  });
});
