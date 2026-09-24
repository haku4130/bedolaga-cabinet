# Редизайн кабинета, этап 1: навигация, главная, приветствие — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Единое меню из четырёх разделов (Главная · Устройства · Поддержка · Ещё), главная с одним главным действием на каждое состояние пользователя и приветственная шторка вместо тура.

**Architecture:** Логика выбора — в чистых модулях с тестами (`navItems.ts`, `homeState.ts`). UI главной — новые компоненты в `src/components/dashboard/home/`; `Dashboard.tsx` становится тонким контейнером «загрузить данные → выбрать состояние → отрисовать». Всё второстепенное уезжает на новую страницу `/more`. Бэкенд не меняется.

**Tech Stack:** React 19, React Router, TanStack Query, Zustand, Tailwind, i18next, Vitest + Testing Library (jsdom), Biome.

**Spec:** `docs/superpowers/specs/2026-09-24-cabinet-ux-redesign-design.md` (разделы 4, 5, 9 — этап 1). Макеты: https://claude.ai/artifact/X8tnej9qiwm1mt3xTYewxK

## Global Constraints

- Только пользовательская часть; админка не меняется (кроме того, что ссылка «Админка» на телефоне переезжает из бургер-меню в «Ещё»).
- Бэкенд и API не меняются.
- Каждая новая строка интерфейса — ключ i18n в `ru.json` и `en.json` (тест `src/locales/locales.test.ts` требует паритета), плюс в `zh.json` и `fa.json` с английским текстом. Ключи добавляются скриптом `scripts/add-locale-keys.mjs` (задача 1), не руками.
- Новые ключи живут в новых неймспейсах (`home.*`, `more.*`, `welcome.*`) и в `nav.*` — существующие ключи не переименовываем (меньше конфликтов с апстримом).
- Новая логика — в новых файлах; существующие файлы делаем тоньше, а не толще.
- Вёрстка mobile-first (390px); на десктопе колонка главной/«Ещё» — `max-w-xl` по центру.
- Тесты компонентов: заголовок `// @vitest-environment jsdom`, мок `react-i18next` возвращает ключ (как в `src/components/dashboard/subscriptionCardLayout.test.tsx`).
- Коммиты в стиле репозитория: `feat(scope): описание по-русски`. Pre-commit хук гоняет Biome на застейдженных файлах.
- Команды: тесты `npm test -- <путь>`, типы `npm run type-check`, линт `npm run lint`, сборка `npm run build`.

## File Structure

| Файл | Статус | Ответственность |
|---|---|---|
| `scripts/add-locale-keys.mjs` | новый | Глубокое слияние JSON-фрагмента в 4 локали |
| `src/components/layout/AppShell/navItems.ts` (+ `.test.ts`) | новый | Единый список разделов, «экран раздела?», корневые пути |
| `src/components/layout/AppShell/navIcons.ts` | новый | Иконки разделов (общие для нижнего бара и шапки) |
| `src/components/layout/AppShell/mobileNavRoutes.ts` (+ `.test.ts`) | удалить | Заменён `navItems.ts` |
| `src/components/layout/AppShell/MobileBottomNav.tsx` | переписать | Нижний бар по `navItems` |
| `src/components/layout/AppShell/AppHeader.tsx` | переписать | Мобильная шапка: только лого и колокольчик |
| `src/components/layout/AppShell/AppShell.tsx` | изменить | Десктопная шапка по `navItems`, без бургера |
| `src/AppWithNavigator.tsx` | изменить | Корневые пути Telegram BackButton из `navItems.ts` |
| `src/pages/More.tsx` (+ `more.test.tsx`) | новый | Раздел «Ещё» |
| `src/pages/News.tsx` | новый | Страница-список новостей на `NewsSection` |
| `src/App.tsx` | изменить | Маршруты `/more`, `/news` |
| `src/utils/homeState.ts` (+ `.test.ts`) | новый | `getHomeState`, `minPlanPriceKopeks` |
| `src/components/dashboard/home/SetupSteps.tsx` | новый | Дорожка «Тариф → Оплата → Подключение» |
| `src/components/dashboard/home/HomeQuickTiles.tsx` (+ `homeQuickTiles.test.tsx`) | новый | Плитки «Баланс» и «Пригласить друга» |
| `src/components/dashboard/home/useHomeFormat.ts` | новый | Форматирование цены и даты |
| `src/components/dashboard/home/heroActions.tsx` | новый | Primary/secondary кнопки главной |
| `src/components/dashboard/home/NewUserHero.tsx` | новый | Состояния `new`, `new_trial`, `new_paid_trial` |
| `src/components/dashboard/home/ActiveHero.tsx` | новый | Состояния `active`, `active_no_devices`, `expiring` |
| `src/components/dashboard/home/ProblemHero.tsx` | новый | Состояния `expired`, `expired_trial`, `traffic_exhausted` |
| `src/components/dashboard/home/HomeHero.tsx` (+ `homeHero.test.tsx`) | новый | Выбор варианта карточки по состоянию |
| `src/components/dashboard/home/MultiSubscriptionsHero.tsx` | новый | Мультитариф: список подписок (перенос из Dashboard) |
| `src/hooks/useTrafficAutoRefresh.ts` | новый | Разовое обновление трафика для лимитных тарифов |
| `src/pages/Dashboard.tsx` | переписать | Тонкий контейнер |
| `src/components/dashboard/WelcomeSheet.tsx`, `src/hooks/useWelcomeSheet.ts` (+ `welcomeSheet.test.ts`) | новый | Приветствие один раз на аккаунт |
| `src/components/Onboarding.tsx` | удалить | Заменён приветствием |
| `src/pages/blockedStorageRendering.test.tsx` | изменить | Проверка приветствия вместо онбординга |
| `SubscriptionCardActive.tsx`, `subscriptionCardLayout.test.tsx`, `StatsGrid.tsx`, `ConnectDeviceTile.tsx` (+ зависимые, если больше не импортируются) | удалить | Заменены новой главной |

`SubscriptionCardExpired.tsx` и `TrialOfferCard.tsx` **остаются**: первый нужен суточным тарифам (приостановка/мгновенное продление, покрыто `subscriptionCardExpiredRenew.test.tsx`), второй используется на `Subscriptions.tsx`.

---

### Task 1: Единый список разделов и скрипт для локалей

**Files:**
- Create: `scripts/add-locale-keys.mjs`
- Create: `src/components/layout/AppShell/navItems.ts`
- Test: `src/components/layout/AppShell/navItems.test.ts`
- Modify: `src/locales/{ru,en,zh,fa}.json` (через скрипт)

**Interfaces:**
- Produces:
  - `type NavKey = 'dashboard' | 'devices' | 'support' | 'more'`
  - `interface NavItem { readonly key: NavKey; readonly path: string }`
  - `navItems(flags?: { multiTariff?: boolean }): readonly NavItem[]`
  - `isNavScreen(pathname: string, items: readonly NavItem[]): boolean`
  - `TOP_LEVEL_PATHS: readonly string[]`
  - ключи `nav.devices`, `nav.more`
  - `node scripts/add-locale-keys.mjs <fragment.json>` — фрагмент вида `{ "ru": {...}, "en": {...}, "zh": {...}, "fa": {...} }`

- [ ] **Step 1: Написать падающий тест**

`src/components/layout/AppShell/navItems.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { TOP_LEVEL_PATHS, isNavScreen, navItems } from './navItems';

/**
 * Одно меню на все платформы: нижний бар на телефоне и шапка на десктопе
 * рисуют один и тот же список. Раньше их было три (бар, бургер, шапка) с
 * разным набором пунктов, и часть разделов на десктопе была недостижима.
 */
describe('navItems', () => {
  it('четыре раздела в фиксированном порядке', () => {
    expect(navItems().map((item) => item.key)).toEqual(['dashboard', 'devices', 'support', 'more']);
    expect(navItems().map((item) => item.path)).toEqual(['/', '/connection', '/support', '/more']);
  });

  it('в мультитарифе «Устройства» ведут на список подписок: /connection не умеет выбирать подписку', () => {
    expect(navItems({ multiTariff: true })[1]).toEqual({ key: 'devices', path: '/subscriptions' });
  });

  it('TOP_LEVEL_PATHS содержит пути обоих вариантов меню', () => {
    for (const item of [...navItems(), ...navItems({ multiTariff: true })]) {
      expect(TOP_LEVEL_PATHS).toContain(item.path);
    }
  });
});

describe('isNavScreen', () => {
  const items = navItems();

  it('экраны разделов — да', () => {
    for (const path of ['/', '/connection', '/support', '/more']) {
      expect(isNavScreen(path, items), path).toBe(true);
    }
  });

  it('хвостовой слеш не мешает', () => {
    expect(isNavScreen('/more/', items)).toBe(true);
  });

  it('вложенные экраны и админка — нет', () => {
    for (const path of [
      '/balance',
      '/connection/qr',
      '/subscriptions/12',
      '/subscription/purchase',
      '/admin',
    ]) {
      expect(isNavScreen(path, items), path).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test -- src/components/layout/AppShell/navItems.test.ts`
Expected: FAIL — `Failed to resolve import "./navItems"`.

- [ ] **Step 3: Реализация**

`src/components/layout/AppShell/navItems.ts`:

```ts
/**
 * Разделы основной навигации. Один список для нижнего бара на телефоне и для
 * шапки на десктопе — чтобы наборы пунктов больше не расходились.
 * Всё второстепенное (баланс, рефералы, колесо, новости…) живёт в «Ещё».
 */
export type NavKey = 'dashboard' | 'devices' | 'support' | 'more';

export interface NavItem {
  /** Хвост ключа перевода `nav.*` и ключ иконки. */
  readonly key: NavKey;
  readonly path: string;
}

export interface NavFlags {
  /**
   * Мультитариф: у страницы подключения нет выбора подписки, поэтому
   * «Устройства» ведут на список подписок, где у каждой своя кнопка подключения.
   */
  readonly multiTariff?: boolean;
}

export function navItems({ multiTariff = false }: NavFlags = {}): readonly NavItem[] {
  return [
    { key: 'dashboard', path: '/' },
    { key: 'devices', path: multiTariff ? '/subscriptions' : '/connection' },
    { key: 'support', path: '/support' },
    { key: 'more', path: '/more' },
  ];
}

/** Корневые экраны: на них Telegram показывает «Закрыть», а не «Назад». */
export const TOP_LEVEL_PATHS: readonly string[] = [
  '/',
  '/connection',
  '/subscriptions',
  '/support',
  '/more',
];

function withoutTrailingSlash(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

/** Экран раздела — на нём показывается нижний бар. */
export function isNavScreen(pathname: string, items: readonly NavItem[]): boolean {
  const path = withoutTrailingSlash(pathname);
  return items.some((item) => item.path === path);
}
```

`scripts/add-locale-keys.mjs`:

```js
#!/usr/bin/env node
/**
 * Глубоко сливает JSON-фрагмент в локали src/locales/<lang>.json.
 * Фрагмент: { "ru": {...}, "en": {...}, "zh": {...}, "fa": {...} }.
 * Формат файлов сохраняется байт-в-байт: JSON.stringify(_, null, 2) + "\n".
 *
 * Использование: node scripts/add-locale-keys.mjs <fragment.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';

const fragmentPath = process.argv[2];
if (!fragmentPath) {
  console.error('usage: node scripts/add-locale-keys.mjs <fragment.json>');
  process.exit(1);
}

function merge(target, source, path) {
  for (const [key, value] of Object.entries(source)) {
    const at = path ? `${path}.${key}` : key;
    if (value !== null && typeof value === 'object') {
      if (target[key] !== undefined && typeof target[key] !== 'object') {
        throw new Error(`${at}: в локали строка, во фрагменте объект`);
      }
      target[key] ??= {};
      merge(target[key], value, at);
    } else {
      target[key] = value;
    }
  }
}

const fragment = JSON.parse(readFileSync(fragmentPath, 'utf8'));
for (const [lang, tree] of Object.entries(fragment)) {
  const file = new URL(`../src/locales/${lang}.json`, import.meta.url);
  const locale = JSON.parse(readFileSync(file, 'utf8'));
  merge(locale, tree, '');
  writeFileSync(file, `${JSON.stringify(locale, null, 2)}\n`);
  console.log(`${lang}: ok`);
}
```

- [ ] **Step 4: Добавить ключи меню**

```bash
cat > /tmp/stage1-nav.json <<'EOF'
{
  "ru": { "nav": { "devices": "Устройства", "more": "Ещё" } },
  "en": { "nav": { "devices": "Devices", "more": "More" } },
  "zh": { "nav": { "devices": "Devices", "more": "More" } },
  "fa": { "nav": { "devices": "Devices", "more": "More" } }
}
EOF
node scripts/add-locale-keys.mjs /tmp/stage1-nav.json
git diff --stat src/locales
```

Expected: `ru: ok`, `en: ok`, `zh: ok`, `fa: ok`; в каждом файле локали +2 строки.

- [ ] **Step 5: Прогнать тесты**

Run: `npm test -- src/components/layout/AppShell/navItems.test.ts src/locales/locales.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/add-locale-keys.mjs src/components/layout/AppShell/navItems.ts src/components/layout/AppShell/navItems.test.ts src/locales
git commit -m "feat(nav): единый список разделов «Главная · Устройства · Поддержка · Ещё»"
```

---

### Task 2: Раздел «Ещё» и страница новостей

**Files:**
- Create: `src/pages/More.tsx`
- Create: `src/pages/News.tsx`
- Test: `src/pages/more.test.tsx`
- Modify: `src/App.tsx` (ленивые импорты и два маршрута)
- Modify: `src/locales/*.json` (через скрипт)

**Interfaces:**
- Consumes: `useFeatureFlags()` → `{ referralEnabled, wheelEnabled, hasContests, hasPolls, giftEnabled }` (`src/hooks/useFeatureFlags.ts`); `useAuthStore` (`user`, `isAdmin`, `logout`); `balanceApi.getBalance()` → `{ balance_rubles, ... }`.
- Produces: маршруты `/more` и `/news`; ключи `more.*`.

- [ ] **Step 1: Написать падающий тест**

`src/pages/more.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test -- src/pages/more.test.tsx`
Expected: FAIL — `Failed to resolve import "./More"`.

- [ ] **Step 3: Добавить ключи**

```bash
cat > /tmp/stage1-more.json <<'EOF'
{
  "ru": { "more": {
    "title": "Ещё",
    "profileHint": "Профиль и способы входа",
    "groups": { "money": "Деньги", "bonuses": "Бонусы", "info": "Информация", "settings": "Настройки" },
    "items": {
      "balance": "Баланс и история платежей",
      "invite": "Пригласить друга",
      "gift": "Подарить подписку",
      "wheel": "Колесо удачи",
      "contests": "Конкурсы",
      "polls": "Опросы",
      "news": "Новости и обновления",
      "info": "Инструкции и частые вопросы",
      "language": "Язык",
      "theme": "Тема оформления"
    }
  } },
  "en": { "more": {
    "title": "More",
    "profileHint": "Profile and sign-in methods",
    "groups": { "money": "Money", "bonuses": "Bonuses", "info": "Information", "settings": "Settings" },
    "items": {
      "balance": "Balance and payment history",
      "invite": "Invite a friend",
      "gift": "Gift a subscription",
      "wheel": "Wheel of fortune",
      "contests": "Contests",
      "polls": "Polls",
      "news": "News and updates",
      "info": "Guides and FAQ",
      "language": "Language",
      "theme": "Theme"
    }
  } }
}
EOF
node -e "const f=require('/tmp/stage1-more.json');f.zh=f.en;f.fa=f.en;require('fs').writeFileSync('/tmp/stage1-more.json',JSON.stringify(f))"
node scripts/add-locale-keys.mjs /tmp/stage1-more.json
```

Expected: `ru: ok`, `en: ok`, `zh: ok`, `fa: ok`.

- [ ] **Step 4: Реализация страницы «Ещё»**

`src/pages/More.tsx`:

```tsx
import type { ComponentType, ReactNode } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';

import { useAuthStore } from '@/store/auth';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useTheme } from '@/hooks/useTheme';
import { useCurrency } from '@/hooks/useCurrency';
import { balanceApi } from '@/api/balance';
import { themeColorsApi } from '@/api/themeColors';
import { API } from '@/config/constants';
import { displayName } from '@/utils/displayName';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import PromoOffersSection from '@/components/PromoOffersSection';
import {
  ChevronRightIcon,
  ClipboardIcon,
  CogIcon,
  GamepadIcon,
  GiftIcon,
  GlobeIcon,
  InfoIcon,
  LogoutIcon,
  MoonIcon,
  NewsIcon,
  SunIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
  WheelIcon,
} from '@/components/icons';

type Icon = ComponentType<{ className?: string }>;

const ROW = 'flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left text-[15px] font-medium text-dark-100 transition-colors hover:bg-dark-800/60';

function RowIcon({ icon: IconComponent }: { icon: Icon }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-dark-800 text-accent-400">
      <IconComponent className="h-[18px] w-[18px]" />
    </span>
  );
}

function Row({ to, icon, label, trailing }: { to: string; icon: Icon; label: string; trailing?: ReactNode }) {
  return (
    <Link to={to} className={ROW}>
      <RowIcon icon={icon} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-dark-500" />
    </Link>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-[13px] font-semibold text-dark-400">{title}</h2>
      <div className="divide-y divide-dark-800/70 overflow-hidden rounded-2xl border border-dark-800/70 bg-dark-900/60">
        {children}
      </div>
    </section>
  );
}

export default function More() {
  const { t } = useTranslation();
  const { user, isAdmin, logout } = useAuthStore(
    useShallow((state) => ({ user: state.user, isAdmin: state.isAdmin, logout: state.logout })),
  );
  const { referralEnabled, wheelEnabled, hasContests, hasPolls, giftEnabled } = useFeatureFlags();
  const { toggleTheme, isDark } = useTheme();
  const { formatWithCurrency } = useCurrency();

  const { data: balance } = useQuery({
    queryKey: ['balance'],
    queryFn: balanceApi.getBalance,
    staleTime: API.BALANCE_STALE_TIME_MS,
  });
  const { data: enabledThemes } = useQuery({
    queryKey: ['enabled-themes'],
    queryFn: themeColorsApi.getEnabledThemes,
    staleTime: 1000 * 60 * 5,
  });
  const canToggleTheme = enabledThemes?.dark && enabledThemes?.light;
  const hasBonuses = referralEnabled || giftEnabled || wheelEnabled || hasContests || hasPolls;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-2xl font-bold text-dark-50">{t('more.title')}</h1>

      <Link
        to="/profile"
        className="flex items-center gap-3 rounded-2xl border border-dark-800/70 bg-dark-900/60 p-4 transition-colors hover:bg-dark-800/60"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-dark-800 text-accent-400">
          <UserIcon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold text-dark-50">
            {displayName(user) || t('nav.profile')}
          </span>
          <span className="block truncate text-sm text-dark-400">{t('more.profileHint')}</span>
        </span>
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-dark-500" />
      </Link>

      <PromoOffersSection />

      <Group title={t('more.groups.money')}>
        <Row
          to="/balance"
          icon={WalletIcon}
          label={t('more.items.balance')}
          trailing={
            balance ? (
              <span className="text-sm text-dark-400">
                {formatWithCurrency(balance.balance_rubles, 0)}
              </span>
            ) : null
          }
        />
      </Group>

      {hasBonuses && (
        <Group title={t('more.groups.bonuses')}>
          {referralEnabled && <Row to="/referral" icon={UsersIcon} label={t('more.items.invite')} />}
          {giftEnabled && <Row to="/gift" icon={GiftIcon} label={t('more.items.gift')} />}
          {wheelEnabled && <Row to="/wheel" icon={WheelIcon} label={t('more.items.wheel')} />}
          {hasContests && (
            <Row to="/contests" icon={GamepadIcon} label={t('more.items.contests')} />
          )}
          {hasPolls && <Row to="/polls" icon={ClipboardIcon} label={t('more.items.polls')} />}
        </Group>
      )}

      <Group title={t('more.groups.info')}>
        <Row to="/news" icon={NewsIcon} label={t('more.items.news')} />
        <Row to="/info" icon={InfoIcon} label={t('more.items.info')} />
      </Group>

      <Group title={t('more.groups.settings')}>
        <div className={ROW}>
          <RowIcon icon={GlobeIcon} />
          <span className="min-w-0 flex-1 truncate">{t('more.items.language')}</span>
          <LanguageSwitcher />
        </div>
        {canToggleTheme && (
          <button type="button" onClick={toggleTheme} className={ROW}>
            <RowIcon icon={isDark ? MoonIcon : SunIcon} />
            <span className="min-w-0 flex-1 truncate">{t('more.items.theme')}</span>
            <span className="text-sm text-dark-400">
              {isDark ? t('theme.dark') : t('theme.light')}
            </span>
          </button>
        )}
      </Group>

      {isAdmin && (
        <Group title={t('admin.nav.title')}>
          <Row to="/admin" icon={CogIcon} label={t('admin.nav.title')} />
        </Group>
      )}

      <button
        type="button"
        onClick={logout}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-medium text-error-400 transition-colors hover:bg-error-500/10"
      >
        <LogoutIcon className="h-[18px] w-[18px]" />
        {t('nav.logout')}
      </button>
    </div>
  );
}
```

`src/pages/News.tsx`:

```tsx
import NewsSection from '@/components/news/NewsSection';
import { WebBackButton } from '@/components/WebBackButton';

/** Лента новостей. Раньше жила только на главной; теперь — пункт раздела «Ещё». */
export default function News() {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <WebBackButton to="/more" />
      <NewsSection />
    </div>
  );
}
```

- [ ] **Step 5: Маршруты**

В `src/App.tsx` рядом с остальными `lazyWithRetry` страниц (найти строку `const Info = lazyWithRetry(`) добавить:

```tsx
const More = lazyWithRetry(() => import('./pages/More'));
const News = lazyWithRetry(() => import('./pages/News'));
```

Сразу после блока `<Route path="/info" … />` (тот, что с `<Info />`) добавить:

```tsx
        <Route
          path="/more"
          element={
            <ProtectedRoute>
              <LazyPage>
                <More />
              </LazyPage>
            </ProtectedRoute>
          }
        />
        <Route
          path="/news"
          element={
            <ProtectedRoute>
              <LazyPage>
                <News />
              </LazyPage>
            </ProtectedRoute>
          }
        />
```

- [ ] **Step 6: Прогнать тесты и типы**

Run: `npm test -- src/pages/more.test.tsx src/locales/locales.test.ts && npm run type-check`
Expected: PASS, без ошибок типов. Если `displayName` ожидает не `User | null` — посмотреть сигнатуру в `src/utils/displayName.ts` и передать `user` так же, как это делает `AppHeader.tsx`.

- [ ] **Step 7: Commit**

```bash
git add src/pages/More.tsx src/pages/News.tsx src/pages/more.test.tsx src/App.tsx src/locales
git commit -m "feat(more): раздел «Ещё» и отдельная лента новостей"
```

---

### Task 3: Оболочка на новом меню

**Files:**
- Create: `src/components/layout/AppShell/navIcons.ts`
- Rewrite: `src/components/layout/AppShell/MobileBottomNav.tsx`
- Rewrite: `src/components/layout/AppShell/AppHeader.tsx`
- Modify: `src/components/layout/AppShell/AppShell.tsx`
- Modify: `src/AppWithNavigator.tsx:32,111`
- Delete: `src/components/layout/AppShell/mobileNavRoutes.ts`, `src/components/layout/AppShell/mobileNavRoutes.test.ts`

**Interfaces:**
- Consumes: `navItems`, `isNavScreen`, `TOP_LEVEL_PATHS`, `NavKey`, `NavItem` (задача 1); маршрут `/more` (задача 2).
- Produces: `NAV_ICONS: Record<NavKey, ComponentType<{ className?: string }>>`; `MobileBottomNav({ items })`; `AppHeader({ isFullscreen, safeAreaInset, contentSafeAreaInset, telegramPlatform })`.

- [ ] **Step 1: Иконки разделов**

`src/components/layout/AppShell/navIcons.ts`:

```ts
import type { ComponentType } from 'react';
import { ChatIcon, DevicesIcon, HomeIcon, MenuIcon } from '@/components/icons';
import type { NavKey } from './navItems';

export const NAV_ICONS: Record<NavKey, ComponentType<{ className?: string }>> = {
  dashboard: HomeIcon,
  devices: DevicesIcon,
  support: ChatIcon,
  more: MenuIcon,
};
```

- [ ] **Step 2: Нижний бар**

Заменить `src/components/layout/AppShell/MobileBottomNav.tsx` целиком:

```tsx
import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { usePlatform } from '@/platform';
import { HIDDEN_UNDER_KEYBOARD, useVirtualKeyboard } from '@/hooks/useVirtualKeyboard';

import { NAV_ICONS } from './navIcons';
import type { NavItem } from './navItems';

interface MobileBottomNavProps {
  /** Разделы из navItems(); AppShell рендерит панель только на их экранах. */
  items: readonly NavItem[];
}

export function MobileBottomNav({ items }: MobileBottomNavProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const { haptic } = usePlatform();
  const isKeyboardOpen = useVirtualKeyboard();

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <nav
      className={cn(
        'fixed z-50 transition-all duration-200 lg:hidden',
        'bg-dark-900/95 backdrop-blur-linear',
        'border border-dark-700/30',
        isKeyboardOpen ? HIDDEN_UNDER_KEYBOARD : 'opacity-100',
      )}
      style={{
        // Отступы объявлены в globals.css (--mobile-nav-*): в standalone iOS
        // панель стоит вплотную к безопасной зоне, в браузере — 16px от края.
        bottom: 'var(--mobile-nav-offset)',
        left: 'max(16px, env(safe-area-inset-left, 0px))',
        right: 'max(16px, env(safe-area-inset-right, 0px))',
        borderRadius: 'var(--bento-radius, 24px)',
        padding: '8px 4px',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
      }}
    >
      <div className="flex justify-around">
        {items.map((item) => {
          const Icon = NAV_ICONS[item.key];
          const active = isActive(item.path);
          return (
            <Link
              key={item.key}
              to={item.path}
              onClick={() => haptic.impact('light')}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex min-w-[64px] flex-1 shrink-0 flex-col items-center justify-center rounded-2xl px-3 py-2.5 transition-all duration-200',
                active ? 'text-accent-400' : 'text-dark-400 hover:text-dark-200',
              )}
            >
              {active && (
                <motion.div
                  layoutId="bottom-nav-active"
                  className="absolute inset-0 rounded-2xl bg-accent-500/15"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              <Icon className="relative z-10 h-5 w-5" />
              <span className="relative z-10 mt-1 whitespace-nowrap text-2xs">
                {t(`nav.${item.key}`)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Мобильная шапка — только лого и колокольчик**

Заменить `src/components/layout/AppShell/AppHeader.tsx` целиком. Бургер, поиск, переключатели темы и языка уходят (тема и язык — в «Ещё», админка — в «Ещё»):

```tsx
import { Link, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  brandingApi,
  getCachedBranding,
  setCachedBranding,
  preloadLogo,
  isLogoPreloaded,
} from '@/api/branding';
import { cn } from '@/lib/utils';
import TicketNotificationBell from '@/components/TicketNotificationBell';
import type { TelegramPlatform } from '@/hooks/useTelegramSDK';

const FALLBACK_NAME = import.meta.env.VITE_APP_NAME || 'Cabinet';
const FALLBACK_LOGO = import.meta.env.VITE_APP_LOGO || 'V';

interface AppHeaderProps {
  isFullscreen: boolean;
  safeAreaInset: { top: number; bottom: number; left: number; right: number };
  contentSafeAreaInset: { top: number; bottom: number; left: number; right: number };
  telegramPlatform?: TelegramPlatform;
}

export function AppHeader({
  isFullscreen,
  safeAreaInset,
  contentSafeAreaInset,
  telegramPlatform,
}: AppHeaderProps) {
  const location = useLocation();
  const [logoLoaded, setLogoLoaded] = useState(() => isLogoPreloaded());

  const { data: branding } = useQuery({
    queryKey: ['branding'],
    queryFn: async () => {
      const data = await brandingApi.getBranding();
      setCachedBranding(data);
      await preloadLogo(data);
      return data;
    },
    initialData: getCachedBranding() ?? undefined,
    initialDataUpdatedAt: 0,
    staleTime: 60000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const appName = branding ? branding.name : FALLBACK_NAME;
  const logoLetter = branding?.logo_letter || FALLBACK_LOGO;
  const hasCustomLogo = branding?.has_custom_logo || false;
  const logoUrl = branding ? brandingApi.getLogoUrl(branding) : null;

  return (
    // В standalone-режиме iOS шапка продолжается под статус-бар через padding-top;
    // тон задаёт .app-mobile-header в globals.css (display-mode: standalone).
    <header
      className="glass app-mobile-header fixed left-0 right-0 top-0 z-50 shadow-lg shadow-black/10 lg:hidden"
      style={{
        paddingTop: isFullscreen
          ? `${Math.max(safeAreaInset.top, contentSafeAreaInset.top) + (telegramPlatform === 'android' ? 48 : 45)}px`
          : 'env(safe-area-inset-top, 0px)',
      }}
    >
      <div className="mx-auto w-full pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className={cn('flex flex-shrink-0 items-center gap-2.5', !appName && 'mr-4')}>
            <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-linear-lg border border-dark-700/50 bg-dark-800/80 shadow-md">
              <span
                className={cn(
                  'absolute text-lg font-bold text-accent-400 transition-opacity duration-200',
                  hasCustomLogo && logoLoaded ? 'opacity-0' : 'opacity-100',
                )}
              >
                {logoLetter}
              </span>
              {hasCustomLogo && logoUrl && (
                <img
                  src={logoUrl}
                  alt={appName || 'Logo'}
                  className={cn(
                    'absolute h-full w-full object-contain transition-opacity duration-200',
                    logoLoaded ? 'opacity-100' : 'opacity-0',
                  )}
                  onLoad={() => setLogoLoaded(true)}
                />
              )}
            </div>
            {appName && (
              <span className="whitespace-nowrap text-base font-semibold text-dark-100">
                {appName}
              </span>
            )}
          </Link>

          <TicketNotificationBell isAdmin={location.pathname.startsWith('/admin')} />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: AppShell**

В `src/components/layout/AppShell/AppShell.tsx`:

1. Заменить импорт иконок:

```tsx
import { ShieldIcon, LogoutIcon, SunIcon, MoonIcon } from '@/components/icons';
```

2. Удалить строку `import { useFeatureFlags } from '@/hooks/useFeatureFlags';` и добавить `import { subscriptionApi } from '@/api/subscription';`.
3. Заменить `import { isMobileNavScreen, mobileNavItems } from './mobileNavRoutes';` на:

```tsx
import { isNavScreen, navItems } from './navItems';
import { NAV_ICONS } from './navIcons';
```

4. Удалить строку `const { referralEnabled, wheelEnabled, hasContests, hasPolls, giftEnabled } = useFeatureFlags();`.
5. Удалить `const [mobileMenuOpen, setMobileMenuOpen] = useState(false);` и `useState` из импорта `react` (останется `import { useEffect } from 'react';`).
6. Заменить блок от комментария «Нижняя панель живёт только на экранах своих кнопок…» до конца массива `desktopNav` на:

```tsx
  // Мультитариф меняет цель «Устройств» (см. navItems). Ключ общий с главной и
  // TelegramBackButton — React Query не делает лишнего запроса.
  const { data: subscriptionsList } = useQuery({
    queryKey: ['subscriptions-list'],
    queryFn: () => subscriptionApi.getSubscriptions(),
    staleTime: 30_000,
  });
  const items = navItems({ multiTariff: subscriptionsList?.multi_tariff_enabled ?? false });

  // Нижняя панель живёт только на экранах разделов; на остальных её нет и
  // место под неё не резервируется (data-mobile-nav="off" → --mobile-nav-clearance).
  const showMobileNav = isNavScreen(location.pathname, items);

  const desktopNav = items.map((item) => ({
    path: item.path,
    label: t(`nav.${item.key}`),
    icon: NAV_ICONS[item.key],
  }));
```

7. Заменить вызов `<AppHeader … />` на:

```tsx
      <AppHeader
        isFullscreen={isMobileFullscreen}
        safeAreaInset={safeAreaInset}
        contentSafeAreaInset={contentSafeAreaInset}
        telegramPlatform={platform}
      />
```

8. Заменить последнюю строку перед закрывающим `</div>`:

```tsx
      {showMobileNav && <MobileBottomNav items={items} />}
```

- [ ] **Step 5: Корневые пути Telegram BackButton**

В `src/AppWithNavigator.tsx` удалить строки 31–32 (комментарий и `const BOTTOM_NAV_PATHS = [...]`), добавить импорт

```tsx
import { TOP_LEVEL_PATHS } from './components/layout/AppShell/navItems';
```

и в эффекте заменить `BOTTOM_NAV_PATHS.includes(location.pathname)` на `TOP_LEVEL_PATHS.includes(location.pathname)`. Логику `SUBSCRIPTION_DETAIL_RE` не трогать.

- [ ] **Step 6: Удалить старый список маршрутов**

```bash
git rm src/components/layout/AppShell/mobileNavRoutes.ts src/components/layout/AppShell/mobileNavRoutes.test.ts
grep -rn "mobileNavRoutes\|mobileNavItems\|isMobileNavScreen\|BOTTOM_NAV_PATHS" src
```

Expected: grep ничего не находит.

- [ ] **Step 7: Проверка**

Run: `npm run type-check && npm run lint && npm test`
Expected: всё зелёное. Если `DevicesIcon` или `MenuIcon` не принимают `{ className }` — type-check укажет строку; иконки описаны в `src/components/icons/index.tsx` и `extended-icons.tsx`.

- [ ] **Step 8: Commit**

```bash
git add -A src/components/layout/AppShell src/AppWithNavigator.tsx
git commit -m "feat(nav): нижний бар и шапка на едином меню, без бургер-меню"
```

---

### Task 4: Выбор состояния главной

**Files:**
- Create: `src/utils/homeState.ts`
- Test: `src/utils/homeState.test.ts`

**Interfaces:**
- Produces:
  - `type HomeStateKind = 'loading' | 'gift_pending' | 'multi' | 'new_trial' | 'new_paid_trial' | 'new' | 'expired_trial' | 'daily_inactive' | 'expired' | 'traffic_exhausted' | 'expiring' | 'active_no_devices' | 'active'`
  - `type HeroState = Exclude<HomeStateKind, 'loading' | 'gift_pending' | 'multi' | 'daily_inactive'>`
  - `type HomeSubscription = Pick<Subscription, 'status' | 'is_trial' | 'is_expired' | 'is_limited' | 'is_daily' | 'is_daily_paused' | 'days_left' | 'autopay_enabled'>`
  - `interface HomeStateInput { isLoading: boolean; hasPendingGifts: boolean; multiTariff: boolean; multiSubscriptionsCount: number; subscription: HomeSubscription | null; trial: Pick<TrialInfo, 'is_available' | 'requires_payment'> | undefined; connectedDevices: number | undefined }`
  - `getHomeState(input: HomeStateInput): HomeStateKind`
  - `isNewUserState(state: HomeStateKind): boolean`
  - `minPlanPriceKopeks(options: PurchaseOptions | undefined): number | null`
  - `EXPIRING_DAYS = 3`

- [ ] **Step 1: Написать падающий тест**

`src/utils/homeState.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { PurchaseOptions } from '@/types';
import {
  type HomeStateInput,
  type HomeSubscription,
  getHomeState,
  isNewUserState,
  minPlanPriceKopeks,
} from './homeState';

/**
 * Главная показывает ровно одно главное действие, и выбирается оно здесь.
 * Порядок проверок — это приоритет: загрузка → подарок → мультитариф →
 * нет подписки → проблемы подписки → «скоро кончится» → «нет устройств».
 */

const base: HomeStateInput = {
  isLoading: false,
  hasPendingGifts: false,
  multiTariff: false,
  multiSubscriptionsCount: 0,
  subscription: null,
  trial: undefined,
  connectedDevices: undefined,
};

const sub = (overrides: Partial<HomeSubscription> = {}): HomeSubscription => ({
  status: 'active',
  is_trial: false,
  is_expired: false,
  is_limited: false,
  is_daily: false,
  is_daily_paused: false,
  days_left: 30,
  autopay_enabled: false,
  ...overrides,
});

const state = (overrides: Partial<HomeStateInput>) => getHomeState({ ...base, ...overrides });

describe('getHomeState — приоритеты', () => {
  it('загрузка важнее всего', () => {
    expect(state({ isLoading: true, hasPendingGifts: true })).toBe('loading');
  });

  it('непринятый подарок важнее подписки', () => {
    expect(state({ hasPendingGifts: true, subscription: sub() })).toBe('gift_pending');
  });

  it('мультитариф с подписками — список', () => {
    expect(state({ multiTariff: true, multiSubscriptionsCount: 2 })).toBe('multi');
  });

  it('мультитариф без подписок ведёт себя как новичок', () => {
    expect(
      state({ multiTariff: true, trial: { is_available: true, requires_payment: false } }),
    ).toBe('new_trial');
  });
});

describe('getHomeState — нет подписки', () => {
  it('бесплатный триал', () => {
    expect(state({ trial: { is_available: true, requires_payment: false } })).toBe('new_trial');
  });

  it('платный триал', () => {
    expect(state({ trial: { is_available: true, requires_payment: true } })).toBe(
      'new_paid_trial',
    );
  });

  it('триал недоступен или неизвестен', () => {
    expect(state({ trial: { is_available: false, requires_payment: false } })).toBe('new');
    expect(state({})).toBe('new');
  });
});

describe('getHomeState — подписка не работает', () => {
  it('истёкший триал', () => {
    expect(state({ subscription: sub({ is_trial: true, is_expired: true }) })).toBe(
      'expired_trial',
    );
  });

  it('истекла или отключена', () => {
    expect(state({ subscription: sub({ is_expired: true }) })).toBe('expired');
    expect(state({ subscription: sub({ status: 'disabled' }) })).toBe('expired');
    expect(state({ subscription: sub({ status: 'expired' }) })).toBe('expired');
  });

  it('суточный тариф на паузе или истёкший — своя карточка с мгновенным продлением', () => {
    expect(state({ subscription: sub({ is_daily: true, is_daily_paused: true }) })).toBe(
      'daily_inactive',
    );
    expect(state({ subscription: sub({ is_daily: true, is_expired: true }) })).toBe(
      'daily_inactive',
    );
  });

  it('трафик исчерпан', () => {
    expect(state({ subscription: sub({ is_limited: true }) })).toBe('traffic_exhausted');
  });
});

describe('getHomeState — подписка работает', () => {
  it('осталось ≤ 3 дней без автопродления', () => {
    expect(state({ subscription: sub({ days_left: 3 }) })).toBe('expiring');
  });

  it('с автопродлением не пугаем', () => {
    expect(state({ subscription: sub({ days_left: 1, autopay_enabled: true }) })).toBe('active');
  });

  it('суточный тариф не «истекает»', () => {
    expect(state({ subscription: sub({ is_daily: true, days_left: 0 }) })).toBe('active');
  });

  it('ни одного устройства', () => {
    expect(state({ subscription: sub(), connectedDevices: 0 })).toBe('active_no_devices');
  });

  it('число устройств ещё не загружено — не торопимся с «подключите устройство»', () => {
    expect(state({ subscription: sub(), connectedDevices: undefined })).toBe('active');
  });

  it('скорое окончание важнее отсутствия устройств', () => {
    expect(state({ subscription: sub({ days_left: 2 }), connectedDevices: 0 })).toBe('expiring');
  });
});

describe('isNewUserState', () => {
  it('только состояния без подписки', () => {
    expect(isNewUserState('new')).toBe(true);
    expect(isNewUserState('new_trial')).toBe(true);
    expect(isNewUserState('new_paid_trial')).toBe(true);
    expect(isNewUserState('expired_trial')).toBe(false);
    expect(isNewUserState('active')).toBe(false);
  });
});

describe('minPlanPriceKopeks', () => {
  it('нет данных — null', () => {
    expect(minPlanPriceKopeks(undefined)).toBeNull();
  });

  it('тарифы: минимум по доступным тарифам, нули не считаются', () => {
    const options = {
      sales_mode: 'tariffs',
      tariffs: [
        { is_available: true, periods: [{ price_kopeks: 19900 }, { price_kopeks: 10900 }] },
        { is_available: false, periods: [{ price_kopeks: 5000 }] },
        { is_available: true, periods: [{ price_kopeks: 0 }] },
      ],
    } as unknown as PurchaseOptions;
    expect(minPlanPriceKopeks(options)).toBe(10900);
  });

  it('классика: минимум по доступным периодам', () => {
    const options = {
      sales_mode: 'classic',
      periods: [
        { is_available: false, price_kopeks: 5000 },
        { is_available: true, price_kopeks: 29900 },
      ],
    } as unknown as PurchaseOptions;
    expect(minPlanPriceKopeks(options)).toBe(29900);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test -- src/utils/homeState.test.ts`
Expected: FAIL — `Failed to resolve import "./homeState"`.

- [ ] **Step 3: Реализация**

`src/utils/homeState.ts`:

```ts
import type { PurchaseOptions, Subscription, TrialInfo } from '@/types';

/**
 * Состояние пользователя для главной. Для каждого — одна главная кнопка
 * (см. docs/superpowers/specs/2026-09-24-cabinet-ux-redesign-design.md, 5.1).
 */
export type HomeStateKind =
  | 'loading'
  | 'gift_pending'
  | 'multi'
  | 'new_trial'
  | 'new_paid_trial'
  | 'new'
  | 'expired_trial'
  | 'daily_inactive'
  | 'expired'
  | 'traffic_exhausted'
  | 'expiring'
  | 'active_no_devices'
  | 'active';

/** Состояния, которые рисует HomeHero; остальные Dashboard рисует сам. */
export type HeroState = Exclude<HomeStateKind, 'loading' | 'gift_pending' | 'multi' | 'daily_inactive'>;

export type HomeSubscription = Pick<
  Subscription,
  | 'status'
  | 'is_trial'
  | 'is_expired'
  | 'is_limited'
  | 'is_daily'
  | 'is_daily_paused'
  | 'days_left'
  | 'autopay_enabled'
>;

export interface HomeStateInput {
  isLoading: boolean;
  hasPendingGifts: boolean;
  multiTariff: boolean;
  multiSubscriptionsCount: number;
  subscription: HomeSubscription | null;
  trial: Pick<TrialInfo, 'is_available' | 'requires_payment'> | undefined;
  /** undefined — ещё не загружено. */
  connectedDevices: number | undefined;
}

/** С какого остатка дней предлагаем продлить (если автопродление выключено). */
export const EXPIRING_DAYS = 3;

export function getHomeState(input: HomeStateInput): HomeStateKind {
  const sub = input.subscription;

  if (input.isLoading) return 'loading';
  if (input.hasPendingGifts) return 'gift_pending';
  if (input.multiTariff && input.multiSubscriptionsCount > 0) return 'multi';

  if (!sub) {
    if (input.trial?.is_available) {
      return input.trial.requires_payment ? 'new_paid_trial' : 'new_trial';
    }
    return 'new';
  }

  const inactive = sub.is_expired || sub.status === 'expired' || sub.status === 'disabled';

  // Суточному тарифу нечего выбирать: его карточка продлевает/снимает с паузы
  // в один клик (SubscriptionCardExpired), и эту логику мы не дублируем.
  if (sub.is_daily && (inactive || sub.is_daily_paused || sub.is_limited)) return 'daily_inactive';
  if (sub.is_trial && inactive) return 'expired_trial';
  if (inactive) return 'expired';
  if (sub.is_limited) return 'traffic_exhausted';
  if (!sub.is_daily && !sub.autopay_enabled && sub.days_left <= EXPIRING_DAYS) return 'expiring';
  if (input.connectedDevices === 0) return 'active_no_devices';
  return 'active';
}

export function isNewUserState(state: HomeStateKind): boolean {
  return state === 'new' || state === 'new_trial' || state === 'new_paid_trial';
}

/** Самая низкая цена покупки — для подписи «от 109 ₽». null, если цен нет. */
export function minPlanPriceKopeks(options: PurchaseOptions | undefined): number | null {
  if (!options) return null;
  const prices =
    options.sales_mode === 'tariffs'
      ? options.tariffs
          .filter((tariff) => tariff.is_available)
          .flatMap((tariff) => tariff.periods.map((period) => period.price_kopeks))
      : options.periods.filter((period) => period.is_available).map((period) => period.price_kopeks);
  const positive = prices.filter((price) => price > 0);
  return positive.length > 0 ? Math.min(...positive) : null;
}
```

- [ ] **Step 4: Прогнать тесты**

Run: `npm test -- src/utils/homeState.test.ts && npm run type-check`
Expected: PASS. Если type-check пишет, что у `Tariff` нет `is_available`, — открыть `interface Tariff` в `src/types/index.ts`, найти поле доступности тарифа и использовать его (и поправить фикстуру в тесте).

- [ ] **Step 5: Commit**

```bash
git add src/utils/homeState.ts src/utils/homeState.test.ts
git commit -m "feat(home): выбор состояния главной и минимальной цены тарифа"
```

---

### Task 5: Дорожка шагов и плитки «Баланс / Пригласить друга»

**Files:**
- Create: `src/components/dashboard/home/SetupSteps.tsx`
- Create: `src/components/dashboard/home/HomeQuickTiles.tsx`
- Create: `src/components/dashboard/home/useHomeFormat.ts`
- Test: `src/components/dashboard/home/homeQuickTiles.test.tsx`
- Modify: `src/locales/*.json` (через скрипт)

**Interfaces:**
- Produces:
  - `SetupSteps({ current: 1 | 2 | 3 })`
  - `HomeQuickTiles({ balanceRubles: number | undefined; referral: { totalReferrals: number; earningsRubles: number; commissionPercent: number } | null; referralEnabled: boolean })`
  - `useHomeFormat(): { price(kopeks: number): string; date(iso: string): string }`
  - ключи `home.steps.*`, `home.tiles.*`

- [ ] **Step 1: Написать падающий тест**

`src/components/dashboard/home/homeQuickTiles.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test -- src/components/dashboard/home/homeQuickTiles.test.tsx`
Expected: FAIL — `Failed to resolve import "./HomeQuickTiles"`.

- [ ] **Step 3: Ключи**

```bash
cat > /tmp/stage1-home-a.json <<'EOF'
{
  "ru": { "home": {
    "steps": { "label": "Шаги настройки", "plan": "Тариф", "payment": "Оплата", "connect": "Подключение" },
    "tiles": {
      "balance": "Баланс",
      "invite": "Пригласить друга",
      "inviteStats": "Приглашено: {{count}} · +{{amount}}",
      "inviteCommission": "{{percent}}% с оплат друзей",
      "inviteDefault": "Бонусы за друзей"
    }
  } },
  "en": { "home": {
    "steps": { "label": "Setup steps", "plan": "Plan", "payment": "Payment", "connect": "Connect" },
    "tiles": {
      "balance": "Balance",
      "invite": "Invite a friend",
      "inviteStats": "Invited: {{count}} · +{{amount}}",
      "inviteCommission": "{{percent}}% of friends' payments",
      "inviteDefault": "Bonuses for friends"
    }
  } }
}
EOF
node -e "const f=require('/tmp/stage1-home-a.json');f.zh=f.en;f.fa=f.en;require('fs').writeFileSync('/tmp/stage1-home-a.json',JSON.stringify(f))"
node scripts/add-locale-keys.mjs /tmp/stage1-home-a.json
```

- [ ] **Step 4: Реализация**

`src/components/dashboard/home/useHomeFormat.ts`:

```ts
import { useTranslation } from 'react-i18next';
import { useCurrency } from '@/hooks/useCurrency';

/** Цена без «,00» для целых сумм и дата «29 мая 2027» на языке интерфейса. */
export function useHomeFormat() {
  const { i18n } = useTranslation();
  const { formatWithCurrency } = useCurrency();

  return {
    price: (kopeks: number) => {
      const rubles = kopeks / 100;
      return formatWithCurrency(rubles, Number.isInteger(rubles) ? 0 : 2);
    },
    date: (iso: string) =>
      new Date(iso).toLocaleDateString(i18n.language, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
  };
}
```

`src/components/dashboard/home/SetupSteps.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { CheckIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

const STEPS = ['plan', 'payment', 'connect'] as const;

interface SetupStepsProps {
  /** Текущий шаг 1–3; шаги до него отмечены пройденными. */
  current: 1 | 2 | 3;
}

/** «Тариф → Оплата → Подключение»: новичок видит, где он и что дальше. */
export function SetupSteps({ current }: SetupStepsProps) {
  const { t } = useTranslation();

  return (
    <ol className="flex items-center gap-2" aria-label={t('home.steps.label')}>
      {STEPS.map((step, index) => {
        const number = index + 1;
        const done = number < current;
        const active = number === current;
        return (
          <li
            key={step}
            className="flex min-w-0 flex-1 items-center gap-2 last:flex-none"
            aria-current={active ? 'step' : undefined}
          >
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                done && 'bg-success-500/15 text-success-400',
                active && 'bg-accent-400 text-on-accent',
                !done && !active && 'border border-dark-600 text-dark-400',
              )}
            >
              {done ? <CheckIcon className="h-3.5 w-3.5" /> : number}
            </span>
            <span
              className={cn(
                'truncate text-[13px] font-semibold',
                active ? 'text-dark-50' : 'text-dark-400',
              )}
            >
              {t(`home.steps.${step}`)}
            </span>
            {number < STEPS.length && (
              <span aria-hidden="true" className="h-0.5 min-w-3 flex-1 rounded bg-dark-700" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
```

`src/components/dashboard/home/HomeQuickTiles.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChevronRightIcon } from '@/components/icons';
import { useCurrency } from '@/hooks/useCurrency';
import { cn } from '@/lib/utils';

interface ReferralSummary {
  totalReferrals: number;
  earningsRubles: number;
  commissionPercent: number;
}

interface HomeQuickTilesProps {
  /** undefined — баланс ещё грузится. */
  balanceRubles: number | undefined;
  referral: ReferralSummary | null;
  referralEnabled: boolean;
}

function Tile({ to, label, testId, children }: { to: string; label: string; testId: string; children: ReactNode }) {
  return (
    <Link to={to} data-testid={testId} className="bento-card-hover flex min-w-0 flex-col gap-2.5">
      <span className="flex items-center justify-between text-[13px] font-semibold text-dark-400">
        {label}
        <ChevronRightIcon className="h-4 w-4" />
      </span>
      {children}
    </Link>
  );
}

export function HomeQuickTiles({ balanceRubles, referral, referralEnabled }: HomeQuickTilesProps) {
  const { t } = useTranslation();
  const { formatWithCurrency } = useCurrency();
  const money = (rubles: number) => formatWithCurrency(rubles, Number.isInteger(rubles) ? 0 : 2);

  let inviteText = t('home.tiles.inviteDefault');
  if (referral && referral.totalReferrals > 0) {
    inviteText = t('home.tiles.inviteStats', {
      count: referral.totalReferrals,
      amount: money(referral.earningsRubles),
    });
  } else if (referral && referral.commissionPercent > 0) {
    inviteText = t('home.tiles.inviteCommission', { percent: referral.commissionPercent });
  }

  return (
    <div className={cn('grid gap-3', referralEnabled ? 'grid-cols-2' : 'grid-cols-1')}>
      <Tile to="/balance" label={t('home.tiles.balance')} testId="home-tile-balance">
        <span className="text-xl font-bold text-dark-50">
          {balanceRubles === undefined ? '—' : money(balanceRubles)}
        </span>
      </Tile>
      {referralEnabled && (
        <Tile to="/referral" label={t('home.tiles.invite')} testId="home-tile-invite">
          <span className="text-sm font-medium leading-snug text-dark-300">{inviteText}</span>
        </Tile>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Прогнать тесты**

Run: `npm test -- src/components/dashboard/home/homeQuickTiles.test.tsx src/locales/locales.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/home src/locales
git commit -m "feat(home): дорожка шагов настройки и плитки баланса и приглашения"
```

---

### Task 6: Главная карточка по состоянию

**Files:**
- Create: `src/components/dashboard/home/heroActions.tsx`
- Create: `src/components/dashboard/home/NewUserHero.tsx`
- Create: `src/components/dashboard/home/ActiveHero.tsx`
- Create: `src/components/dashboard/home/ProblemHero.tsx`
- Create: `src/components/dashboard/home/HomeHero.tsx`
- Test: `src/components/dashboard/home/homeHero.test.tsx`
- Modify: `src/locales/*.json` (через скрипт)

**Interfaces:**
- Consumes: `HeroState` (задача 4), `SetupSteps`, `useHomeFormat` (задача 5).
- Produces: `HomeHero(props: HomeHeroProps)`:

```ts
interface HomeHeroProps {
  state: HeroState;
  subscription: Subscription | null;
  trial: TrialInfo | undefined;
  connectedDevices: number | undefined;
  balanceKopeks: number;
  minPlanPriceKopeks: number | null;
  onActivateTrial: () => void;
  isActivatingTrial: boolean;
  trialError: string | null;
}
```

Главная кнопка в каждой карточке имеет `data-testid="home-primary"` — и она в карточке ровно одна.

- [ ] **Step 1: Написать падающий тест**

`src/components/dashboard/home/homeHero.test.tsx`:

```tsx
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
      subscription: subscription({ traffic_limit_gb: 250, traffic_used_gb: 20, traffic_used_percent: 8 }),
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
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test -- src/components/dashboard/home/homeHero.test.tsx`
Expected: FAIL — `Failed to resolve import "./HomeHero"`.

- [ ] **Step 3: Ключи**

```bash
cat > /tmp/stage1-home-b.json <<'EOF'
{
  "ru": { "home": {
    "unlimited": "Безлимит",
    "status": { "active": "Подписка активна", "trial": "Пробный период" },
    "daysUnit_one": "день", "daysUnit_few": "дня", "daysUnit_many": "дней", "daysUnit_other": "дня",
    "until": "до {{date}}",
    "traffic": "Трафик",
    "trafficUsage": "{{used}} из {{limit}} ГБ",
    "devices": "Устройства",
    "devicesCount": "{{used}} из {{max}}",
    "devicesUnlimited": "{{used}} · без лимита",
    "daily": { "title": "Суточный тариф", "desc": "Оплата списывается с баланса раз в день" },
    "connectFirst": "Осталось подключить устройство — без этого VPN работать не будет. Это займёт около минуты.",
    "expiringNote_one": "Подписка закончится через {{count}} день. Продлите, чтобы VPN не отключился.",
    "expiringNote_few": "Подписка закончится через {{count}} дня. Продлите, чтобы VPN не отключился.",
    "expiringNote_many": "Подписка закончится через {{count}} дней. Продлите, чтобы VPN не отключился.",
    "expiringNote_other": "Подписка закончится через {{count}} дня. Продлите, чтобы VPN не отключился.",
    "trial": {
      "title": "Попробуйте бесплатно",
      "titlePaid": "Пробный период",
      "terms": "{{days}} дн. · трафик: {{traffic}} · устройств: {{devices}}"
    },
    "new": { "title": "Выберите тариф", "desc": "Оплатите подписку и подключите устройство по пошаговой инструкции." },
    "expired": { "title": "Подписка закончилась", "since": "{{date}}", "desc": "VPN на ваших устройствах сейчас не работает. После продления всё заработает само — переподключать ничего не нужно." },
    "expiredTrial": { "title": "Пробный период закончился", "desc": "Выберите тариф, чтобы продолжить пользоваться VPN." },
    "trafficOut": { "title": "Трафик закончился", "desc": "VPN не работает до конца периода. Докупите трафик или смените тариф." },
    "cta": {
      "tryFree": "Попробовать бесплатно",
      "tryPaid": "Попробовать за {{price}}",
      "choosePlan": "Выбрать тариф",
      "choosePlanFrom": "Выбрать тариф · от {{price}}",
      "connect": "Подключить устройство",
      "connectMore": "Подключить ещё устройство",
      "myDevices": "Мои устройства",
      "renew": "Продлить",
      "manage": "Управление",
      "otherPlan": "Выбрать другой тариф",
      "buyTraffic": "Докупить трафик",
      "changePlan": "Сменить тариф"
    }
  } },
  "en": { "home": {
    "unlimited": "Unlimited",
    "status": { "active": "Subscription active", "trial": "Trial period" },
    "daysUnit_one": "day", "daysUnit_other": "days",
    "until": "until {{date}}",
    "traffic": "Traffic",
    "trafficUsage": "{{used}} of {{limit}} GB",
    "devices": "Devices",
    "devicesCount": "{{used}} of {{max}}",
    "devicesUnlimited": "{{used}} · no limit",
    "daily": { "title": "Daily plan", "desc": "Charged from your balance once a day" },
    "connectFirst": "One step left: connect a device — the VPN won't work without it. It takes about a minute.",
    "expiringNote_one": "Your subscription ends in {{count}} day. Renew it so the VPN keeps working.",
    "expiringNote_other": "Your subscription ends in {{count}} days. Renew it so the VPN keeps working.",
    "trial": {
      "title": "Try it for free",
      "titlePaid": "Trial period",
      "terms": "{{days}} d · traffic: {{traffic}} · devices: {{devices}}"
    },
    "new": { "title": "Choose a plan", "desc": "Pay for a subscription and connect a device with a step-by-step guide." },
    "expired": { "title": "Subscription ended", "since": "{{date}}", "desc": "The VPN on your devices isn't working right now. Renew and it will start working again — no need to reconnect." },
    "expiredTrial": { "title": "Trial period ended", "desc": "Choose a plan to keep using the VPN." },
    "trafficOut": { "title": "Traffic is used up", "desc": "The VPN won't work until the period ends. Buy more traffic or change your plan." },
    "cta": {
      "tryFree": "Try for free",
      "tryPaid": "Try for {{price}}",
      "choosePlan": "Choose a plan",
      "choosePlanFrom": "Choose a plan · from {{price}}",
      "connect": "Connect a device",
      "connectMore": "Connect another device",
      "myDevices": "My devices",
      "renew": "Renew",
      "manage": "Manage",
      "otherPlan": "Choose another plan",
      "buyTraffic": "Buy more traffic",
      "changePlan": "Change plan"
    }
  } }
}
EOF
node -e "const f=require('/tmp/stage1-home-b.json');f.zh=f.en;f.fa=f.en;require('fs').writeFileSync('/tmp/stage1-home-b.json',JSON.stringify(f))"
node scripts/add-locale-keys.mjs /tmp/stage1-home-b.json
```

- [ ] **Step 4: Кнопки главной**

`src/components/dashboard/home/heroActions.tsx`:

```tsx
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
```

- [ ] **Step 5: Карточка новичка**

`src/components/dashboard/home/NewUserHero.tsx`:

```tsx
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TrialInfo } from '@/types';
import { SetupSteps } from './SetupSteps';
import { PrimaryButton, PrimaryLink, SecondaryLink } from './heroActions';
import { useHomeFormat } from './useHomeFormat';

interface NewUserHeroProps {
  state: 'new' | 'new_trial' | 'new_paid_trial';
  trial: TrialInfo | undefined;
  balanceKopeks: number;
  minPlanPriceKopeks: number | null;
  onActivateTrial: () => void;
  isActivatingTrial: boolean;
  trialError: string | null;
}

function topUpLink(missingKopeks: number): string {
  const params = new URLSearchParams({
    amount: String(Math.ceil(missingKopeks / 100)),
    returnTo: '/',
  });
  return `/balance/top-up?${params.toString()}`;
}

export function NewUserHero({
  state,
  trial,
  balanceKopeks,
  minPlanPriceKopeks,
  onActivateTrial,
  isActivatingTrial,
  trialError,
}: NewUserHeroProps) {
  const { t } = useTranslation();
  const format = useHomeFormat();

  const planLabel = minPlanPriceKopeks
    ? t('home.cta.choosePlanFrom', { price: format.price(minPlanPriceKopeks) })
    : t('home.cta.choosePlan');

  let title = t('home.new.title');
  let description = t('home.new.desc');
  let primary: ReactNode = <PrimaryLink to="/subscription/purchase">{planLabel}</PrimaryLink>;
  let secondary: ReactNode = null;

  if (trial && (state === 'new_trial' || state === 'new_paid_trial')) {
    description = t('home.trial.terms', {
      days: trial.duration_days,
      traffic:
        trial.traffic_limit_gb === 0
          ? t('home.unlimited')
          : `${trial.traffic_limit_gb} ${t('common.units.gb')}`,
      devices: trial.device_limit === 0 ? '∞' : trial.device_limit,
    });
    const loadingLabel = t('common.loading');

    if (state === 'new_trial') {
      title = t('home.trial.title');
      primary = (
        <PrimaryButton onClick={onActivateTrial} disabled={isActivatingTrial}>
          {isActivatingTrial ? loadingLabel : t('home.cta.tryFree')}
        </PrimaryButton>
      );
      secondary = <SecondaryLink to="/subscription/purchase">{planLabel}</SecondaryLink>;
    } else {
      title = t('home.trial.titlePaid');
      const label = t('home.cta.tryPaid', { price: format.price(trial.price_kopeks) });
      const missing = trial.price_kopeks - balanceKopeks;
      // Этап 2 уберёт пополнение из этого пути; пока — прежнее поведение.
      primary =
        missing > 0 ? (
          <PrimaryLink to={topUpLink(missing)}>{label}</PrimaryLink>
        ) : (
          <PrimaryButton onClick={onActivateTrial} disabled={isActivatingTrial}>
            {isActivatingTrial ? loadingLabel : label}
          </PrimaryButton>
        );
      secondary = (
        <SecondaryLink to="/subscription/purchase">{t('home.cta.choosePlan')}</SecondaryLink>
      );
    }
  }

  return (
    <section
      className="bento-card space-y-5 border border-accent-400/25"
      data-testid={`home-hero-${state}`}
    >
      <SetupSteps current={1} />
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-dark-50">{title}</h2>
        <p className="text-[15px] leading-relaxed text-dark-300">{description}</p>
      </div>
      <div className="space-y-2.5">
        {primary}
        {secondary}
      </div>
      {trialError && <p className="text-sm text-error-400">{trialError}</p>}
    </section>
  );
}
```

- [ ] **Step 6: Карточка работающей подписки**

`src/components/dashboard/home/ActiveHero.tsx`:

```tsx
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { Subscription } from '@/types';
import { PrimaryLink, SecondaryLink } from './heroActions';
import { useHomeFormat } from './useHomeFormat';

interface ActiveHeroProps {
  state: 'active' | 'active_no_devices' | 'expiring';
  subscription: Subscription;
  connectedDevices: number | undefined;
}

/** Сегменты устройств рисуем до 10 мест; дальше — только число. */
const MAX_DEVICE_SEGMENTS = 10;

export function ActiveHero({ state, subscription: sub, connectedDevices }: ActiveHeroProps) {
  const { t } = useTranslation();
  const format = useHomeFormat();

  const used = connectedDevices ?? 0;
  const limit = sub.device_limit;
  const canAddDevice = limit === 0 || used < limit;

  const connectTo = `/connection?sub=${sub.id}`;
  const manageTo = `/subscriptions/${sub.id}`;
  // Триал не продлевается — вместо «Продлить» ведём к выбору тарифа.
  const renewTo = sub.is_trial ? '/subscription/purchase' : `/subscriptions/${sub.id}/renew`;
  const renewLabel = sub.is_trial ? t('home.cta.choosePlan') : t('home.cta.renew');
  const manage = <SecondaryLink to={manageTo}>{t('home.cta.manage')}</SecondaryLink>;

  let primary: ReactNode;
  let secondary: ReactNode = manage;
  if (state === 'active_no_devices') {
    primary = <PrimaryLink to={connectTo}>{t('home.cta.connect')}</PrimaryLink>;
  } else if (state === 'expiring') {
    primary = <PrimaryLink to={renewTo}>{renewLabel}</PrimaryLink>;
  } else {
    primary = canAddDevice ? (
      <PrimaryLink to={connectTo}>
        <PlusIcon className="h-5 w-5" />
        {t('home.cta.connectMore')}
      </PrimaryLink>
    ) : (
      <PrimaryLink to={manageTo}>{t('home.cta.myDevices')}</PrimaryLink>
    );
    if (!sub.is_daily) {
      secondary = (
        <div className="grid grid-cols-2 gap-2.5">
          <SecondaryLink to={renewTo}>{renewLabel}</SecondaryLink>
          {manage}
        </div>
      );
    }
  }

  const planSummary = [sub.tariff_name, sub.traffic_limit_gb === 0 ? t('home.unlimited') : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className="bento-card space-y-5" data-testid={`home-hero-${state}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-success-500/15 px-3 py-1.5 text-[13px] font-semibold text-success-400">
          <span className="h-2 w-2 rounded-full bg-success-400" aria-hidden="true" />
          {sub.is_trial ? t('home.status.trial') : t('home.status.active')}
        </span>
        <span className="min-w-0 truncate text-[13px] font-medium text-dark-400">{planSummary}</span>
      </div>

      {sub.is_daily ? (
        <div className="space-y-1">
          <p className="text-2xl font-bold text-dark-50">{t('home.daily.title')}</p>
          <p className="text-sm text-dark-400">{t('home.daily.desc')}</p>
        </div>
      ) : (
        <div className="space-y-1">
          <p className="flex items-baseline gap-2">
            <span className="text-5xl font-extrabold leading-none tracking-tight text-dark-50">
              {sub.days_left}
            </span>
            <span className="text-lg font-semibold text-dark-300">
              {t('home.daysUnit', { count: sub.days_left })}
            </span>
          </p>
          <p className="text-sm text-dark-400">{t('home.until', { date: format.date(sub.end_date) })}</p>
        </div>
      )}

      {sub.traffic_limit_gb > 0 && (
        <div className="space-y-1.5" data-testid="home-traffic">
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-dark-100">{t('home.traffic')}</span>
            <span className="text-dark-300">
              {t('home.trafficUsage', {
                used: sub.traffic_used_gb.toFixed(1),
                limit: sub.traffic_limit_gb,
              })}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-dark-700">
            <div
              className="h-full rounded-full bg-accent-400"
              style={{ width: `${Math.min(100, Math.max(0, sub.traffic_used_percent))}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-2.5 rounded-xl bg-dark-900/60 p-3.5">
        <div className="flex justify-between text-sm">
          <span className="font-semibold text-dark-100">{t('home.devices')}</span>
          <span className="text-dark-300">
            {limit === 0
              ? t('home.devicesUnlimited', { used })
              : t('home.devicesCount', { used, max: limit })}
          </span>
        </div>
        {limit > 0 && limit <= MAX_DEVICE_SEGMENTS && (
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${limit}, minmax(0, 1fr))` }}
            aria-hidden="true"
          >
            {Array.from({ length: limit }, (_, index) => (
              <span
                key={index}
                className={cn('h-1.5 rounded-full', index < used ? 'bg-accent-400' : 'bg-dark-700')}
              />
            ))}
          </div>
        )}
      </div>

      {state === 'expiring' && (
        <p className="rounded-xl border border-warning-500/30 bg-warning-500/10 p-3 text-sm text-warning-300">
          {t('home.expiringNote', { count: sub.days_left })}
        </p>
      )}
      {state === 'active_no_devices' && (
        <p className="text-sm leading-relaxed text-dark-300">{t('home.connectFirst')}</p>
      )}

      <div className="space-y-2.5">
        {primary}
        {secondary}
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Карточка «подписка не работает»**

`src/components/dashboard/home/ProblemHero.tsx`:

```tsx
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { WarningIcon } from '@/components/icons';
import type { Subscription } from '@/types';
import { PrimaryLink, SecondaryLink } from './heroActions';
import { useHomeFormat } from './useHomeFormat';

interface ProblemHeroProps {
  state: 'expired' | 'expired_trial' | 'traffic_exhausted';
  subscription: Subscription;
  minPlanPriceKopeks: number | null;
}

export function ProblemHero({ state, subscription: sub, minPlanPriceKopeks }: ProblemHeroProps) {
  const { t } = useTranslation();
  const format = useHomeFormat();

  const planLabel = minPlanPriceKopeks
    ? t('home.cta.choosePlanFrom', { price: format.price(minPlanPriceKopeks) })
    : t('home.cta.choosePlan');

  let title: string;
  let subtitle: string | null = null;
  let description: string;
  let primary: ReactNode;
  let secondary: ReactNode = null;

  if (state === 'expired') {
    title = t('home.expired.title');
    subtitle = t('home.expired.since', { date: format.date(sub.end_date) });
    description = t('home.expired.desc');
    primary = <PrimaryLink to={`/subscriptions/${sub.id}/renew`}>{t('home.cta.renew')}</PrimaryLink>;
    secondary = <SecondaryLink to="/subscription/purchase">{t('home.cta.otherPlan')}</SecondaryLink>;
  } else if (state === 'expired_trial') {
    title = t('home.expiredTrial.title');
    description = t('home.expiredTrial.desc');
    primary = <PrimaryLink to="/subscription/purchase">{planLabel}</PrimaryLink>;
  } else {
    title = t('home.trafficOut.title');
    description = t('home.trafficOut.desc');
    // Докупка трафика живёт на странице подписки (TrafficTopupSheet).
    primary = <PrimaryLink to={`/subscriptions/${sub.id}`}>{t('home.cta.buyTraffic')}</PrimaryLink>;
    secondary = <SecondaryLink to="/subscription/purchase">{t('home.cta.changePlan')}</SecondaryLink>;
  }

  return (
    <section
      className="space-y-5 rounded-3xl border border-warning-500/35 bg-warning-500/[0.06] p-5"
      data-testid={`home-hero-${state}`}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-warning-500/15 text-warning-300">
          <WarningIcon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-dark-50">{title}</h2>
          {subtitle && <p className="text-sm text-dark-300">{subtitle}</p>}
        </div>
      </div>
      <p className="text-[15px] leading-relaxed text-dark-200">{description}</p>
      <div className="space-y-2.5">
        {primary}
        {secondary}
      </div>
    </section>
  );
}
```

- [ ] **Step 8: Переключатель по состоянию**

`src/components/dashboard/home/HomeHero.tsx`:

```tsx
import type { Subscription, TrialInfo } from '@/types';
import type { HeroState } from '@/utils/homeState';
import { ActiveHero } from './ActiveHero';
import { NewUserHero } from './NewUserHero';
import { ProblemHero } from './ProblemHero';

export interface HomeHeroProps {
  state: HeroState;
  subscription: Subscription | null;
  trial: TrialInfo | undefined;
  connectedDevices: number | undefined;
  balanceKopeks: number;
  minPlanPriceKopeks: number | null;
  onActivateTrial: () => void;
  isActivatingTrial: boolean;
  trialError: string | null;
}

/** Главная карточка: одна на экране, одно главное действие в ней. */
export function HomeHero(props: HomeHeroProps) {
  const { state, subscription } = props;

  switch (state) {
    case 'new':
    case 'new_trial':
    case 'new_paid_trial':
      return (
        <NewUserHero
          state={state}
          trial={props.trial}
          balanceKopeks={props.balanceKopeks}
          minPlanPriceKopeks={props.minPlanPriceKopeks}
          onActivateTrial={props.onActivateTrial}
          isActivatingTrial={props.isActivatingTrial}
          trialError={props.trialError}
        />
      );
    case 'expired':
    case 'expired_trial':
    case 'traffic_exhausted':
      return subscription ? (
        <ProblemHero
          state={state}
          subscription={subscription}
          minPlanPriceKopeks={props.minPlanPriceKopeks}
        />
      ) : null;
    case 'active':
    case 'active_no_devices':
    case 'expiring':
      return subscription ? (
        <ActiveHero
          state={state}
          subscription={subscription}
          connectedDevices={props.connectedDevices}
        />
      ) : null;
  }
}
```

- [ ] **Step 9: Прогнать тесты**

Run: `npm test -- src/components/dashboard/home src/locales/locales.test.ts && npm run type-check`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/components/dashboard/home src/locales
git commit -m "feat(home): главная карточка с одним действием на каждое состояние"
```

---

### Task 7: Новая главная

**Files:**
- Create: `src/components/dashboard/home/MultiSubscriptionsHero.tsx`
- Create: `src/hooks/useTrafficAutoRefresh.ts`
- Rewrite: `src/pages/Dashboard.tsx`
- Delete: `src/components/dashboard/SubscriptionCardActive.tsx`, `src/components/dashboard/subscriptionCardLayout.test.tsx`, `src/components/dashboard/StatsGrid.tsx`, `src/components/dashboard/ConnectDeviceTile.tsx` и компоненты, импортировавшиеся только ими
- Modify: `src/locales/*.json` (через скрипт)

**Interfaces:**
- Consumes: `getHomeState`, `isNewUserState`, `minPlanPriceKopeks`, `HeroState` (задача 4); `HomeHero` (задача 6); `HomeQuickTiles` (задача 5); `useFeatureFlags().referralEnabled`.
- Produces: `MultiSubscriptionsHero({ subscriptions: SubscriptionListItem[] })`; `useTrafficAutoRefresh(subscription: Subscription | null): void`; ключи `home.greeting`, `home.greetingNoName`, `home.newSubtitle`, `home.support`, `home.multi.*`.

- [ ] **Step 1: Ключи**

```bash
cat > /tmp/stage1-home-c.json <<'EOF'
{
  "ru": { "home": {
    "greeting": "Привет, {{name}}!",
    "greetingNoName": "Привет!",
    "newSubtitle": "Настроим VPN — это займёт пару минут",
    "support": "Есть вопрос? Напишите в поддержку",
    "multi": { "title": "Подписки", "manageAll": "Все подписки", "showAll": "Показать все ({{count}})", "buyAnother": "Купить ещё тариф" }
  } },
  "en": { "home": {
    "greeting": "Hi, {{name}}!",
    "greetingNoName": "Hi!",
    "newSubtitle": "Let's set up your VPN — it takes a couple of minutes",
    "support": "Have a question? Contact support",
    "multi": { "title": "Subscriptions", "manageAll": "All subscriptions", "showAll": "Show all ({{count}})", "buyAnother": "Buy another plan" }
  } }
}
EOF
node -e "const f=require('/tmp/stage1-home-c.json');f.zh=f.en;f.fa=f.en;require('fs').writeFileSync('/tmp/stage1-home-c.json',JSON.stringify(f))"
node scripts/add-locale-keys.mjs /tmp/stage1-home-c.json
```

- [ ] **Step 2: Мультитариф — перенос из Dashboard**

`src/components/dashboard/home/MultiSubscriptionsHero.tsx` (логика та же, что была в `Dashboard.tsx`, — счётчики устройств на каждую карточку и шторка лимита устройств):

```tsx
import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { subscriptionApi } from '@/api/subscription';
import { API } from '@/config/constants';
import SubscriptionListCard from '@/components/subscription/SubscriptionListCard';
import { DeviceLimitSheet } from '@/components/subscription/DeviceLimitSheet';
import type { SubscriptionListItem } from '@/types';

const VISIBLE = 3;

export function MultiSubscriptionsHero({ subscriptions }: { subscriptions: SubscriptionListItem[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const visible = useMemo(() => subscriptions.slice(0, VISIBLE), [subscriptions]);

  // Ключ ['devices', id] общий со страницей подписки — переход туда не стоит сети.
  const deviceQueries = useQueries({
    queries: visible.map((sub) => ({
      queryKey: ['devices', sub.id],
      queryFn: () => subscriptionApi.getDevices(sub.id),
      staleTime: API.BALANCE_STALE_TIME_MS,
    })),
  });

  const [limitSubId, setLimitSubId] = useState<number | null>(null);
  const limitIndex = visible.findIndex((sub) => sub.id === limitSubId);
  const limitSub = limitIndex >= 0 ? visible[limitIndex] : null;

  return (
    <div className="space-y-3" data-testid="home-hero-multi">
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-medium text-dark-400">{t('home.multi.title')}</span>
        <Link to="/subscriptions" className="text-xs text-accent-400 hover:underline">
          {t('home.multi.manageAll')} →
        </Link>
      </div>
      {visible.map((sub, index) => (
        <SubscriptionListCard
          key={sub.id}
          subscription={sub}
          onClick={() => navigate(`/subscriptions/${sub.id}`)}
          connect={{
            connectedDevices: deviceQueries[index]?.data?.total,
            onConnect: () => navigate(`/connection?sub=${sub.id}`),
            onManage: () => setLimitSubId(sub.id),
          }}
        />
      ))}
      {subscriptions.length > VISIBLE && (
        <Link
          to="/subscriptions"
          className="flex w-full items-center justify-center rounded-2xl border border-dashed border-dark-700 p-3 text-xs text-dark-400 hover:text-dark-200"
        >
          {t('home.multi.showAll', { count: subscriptions.length })}
        </Link>
      )}
      <Link
        to="/subscription/purchase"
        className="btn-secondary flex w-full items-center justify-center py-3 text-sm font-medium"
      >
        + {t('home.multi.buyAnother')}
      </Link>

      {limitSub && (
        <DeviceLimitSheet
          isOpen
          onClose={() => setLimitSubId(null)}
          subscriptionId={limitSub.id}
          subscriptionName={limitSub.tariff_name || t('subscription.defaultName', 'Подписка')}
          deviceLimit={limitSub.device_limit}
          isTrial={limitSub.is_trial}
          devices={deviceQueries[limitIndex]?.data?.devices ?? []}
          onOpenSubscription={() => {
            setLimitSubId(null);
            navigate(`/subscriptions/${limitSub.id}`);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Обновление трафика**

`src/hooks/useTrafficAutoRefresh.ts` (замена логики, жившей в `Dashboard.tsx` и `SubscriptionCardActive`: панель отдаёт расход с задержкой, поэтому на главной раз в `API.TRAFFIC_CACHE_MS` просим бэкенд его обновить — только для лимитных тарифов, где полоса трафика видна):

```ts
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscriptionApi } from '@/api/subscription';
import { API } from '@/config/constants';
import { safeLocal } from '@/utils/safeStorage';
import type { Subscription } from '@/types';

export function useTrafficAutoRefresh(subscription: Subscription | null): void {
  const queryClient = useQueryClient();
  const started = useRef(false);

  useEffect(() => {
    if (!subscription || subscription.traffic_limit_gb === 0 || started.current) return;
    started.current = true;

    // Тот же ключ, что использовала старая главная, — кэш переживает обновление.
    const key = `traffic_refresh_ts_${subscription.id}`;
    const last = Number(safeLocal.getItem(key) ?? 0);
    if (Date.now() - last < API.TRAFFIC_CACHE_MS) return;

    subscriptionApi
      .refreshTraffic(subscription.id)
      .then(() => {
        safeLocal.setItem(key, Date.now().toString());
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
      })
      .catch(() => {
        // 429 и сетевые ошибки некритичны: покажем последние известные цифры.
      });
  }, [subscription, queryClient]);
}
```

- [ ] **Step 4: Переписать Dashboard**

Заменить `src/pages/Dashboard.tsx` целиком:

```tsx
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { useAuthStore } from '../store/auth';
import { displayName } from '../utils/displayName';
import { subscriptionApi } from '../api/subscription';
import { referralApi } from '../api/referral';
import { balanceApi } from '../api/balance';
import { giftApi } from '../api/gift';
import { API } from '../config/constants';
import { getApiErrorMessage } from '../utils/api-error';
import { getHomeState, isNewUserState, minPlanPriceKopeks } from '../utils/homeState';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useTrafficAutoRefresh } from '../hooks/useTrafficAutoRefresh';
import PendingGiftCard from '../components/dashboard/PendingGiftCard';
import SubscriptionCardExpired from '../components/dashboard/SubscriptionCardExpired';
import { HomeHero } from '../components/dashboard/home/HomeHero';
import { HomeQuickTiles } from '../components/dashboard/home/HomeQuickTiles';
import { MultiSubscriptionsHero } from '../components/dashboard/home/MultiSubscriptionsHero';
import { ChatIcon } from '@/components/icons';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';

function HeroSkeleton() {
  return (
    <SkeletonGroup className="bento-card">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-6 w-32 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="mb-3 h-12 w-28" />
      <Skeleton className="mb-5 h-4 w-40" />
      <Skeleton className="h-12 w-full rounded-xl" />
    </SkeletonGroup>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const queryClient = useQueryClient();
  const { referralEnabled } = useFeatureFlags();
  const [trialError, setTrialError] = useState<string | null>(null);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const { data: balanceData } = useQuery({
    queryKey: ['balance'],
    queryFn: balanceApi.getBalance,
    staleTime: API.BALANCE_STALE_TIME_MS,
    refetchOnMount: 'always',
  });

  const { data: multiSubData } = useQuery({
    queryKey: ['subscriptions-list'],
    queryFn: () => subscriptionApi.getSubscriptions(),
    staleTime: 60_000,
  });
  const isMultiTariff = multiSubData?.multi_tariff_enabled ?? false;

  const { data: subscriptionResponse, isLoading: subLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => subscriptionApi.getSubscription(),
    retry: false,
    staleTime: API.BALANCE_STALE_TIME_MS,
    refetchOnMount: 'always',
    enabled: !isMultiTariff,
  });
  const subscription = subscriptionResponse?.subscription ?? null;

  // В мультитарифе /cabinet/subscription отключён; «нет подписок» — пустой список.
  const hasNoSubscription = isMultiTariff
    ? multiSubData !== undefined && (multiSubData.subscriptions?.length ?? 0) === 0
    : subscriptionResponse?.has_subscription === false && !subLoading;

  const { data: trialInfo, isLoading: trialLoading } = useQuery({
    queryKey: ['trial-info'],
    queryFn: () => subscriptionApi.getTrialInfo(),
    enabled: !subscription && !subLoading,
  });

  const { data: devicesData } = useQuery({
    queryKey: ['devices'],
    queryFn: () => subscriptionApi.getDevices(),
    enabled: !!subscription && !isMultiTariff,
    staleTime: API.BALANCE_STALE_TIME_MS,
  });

  const { data: referralInfo } = useQuery({
    queryKey: ['referral-info'],
    queryFn: referralApi.getReferralInfo,
    enabled: referralEnabled === true,
  });

  const { data: pendingGifts } = useQuery({
    queryKey: ['pending-gifts'],
    queryFn: giftApi.getPendingGifts,
    staleTime: 30_000,
    retry: false,
  });

  const needsPlanPrice = hasNoSubscription || (!!subscription?.is_trial && subscription.is_expired);
  const { data: purchaseOptions } = useQuery({
    queryKey: ['purchase-options'],
    queryFn: () => subscriptionApi.getPurchaseOptions(),
    enabled: needsPlanPrice,
    staleTime: 60_000,
  });

  useTrafficAutoRefresh(subscription);

  const activateTrialMutation = useMutation({
    mutationFn: () => subscriptionApi.activateTrial(),
    onSuccess: () => {
      setTrialError(null);
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['trial-info'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
      refreshUser();
    },
    onError: (error: unknown) => {
      setTrialError(getApiErrorMessage(error, t('common.error')));
    },
  });

  const state = getHomeState({
    isLoading:
      subLoading || (isMultiTariff && !multiSubData) || (hasNoSubscription && trialLoading),
    hasPendingGifts: (pendingGifts?.length ?? 0) > 0,
    multiTariff: isMultiTariff,
    multiSubscriptionsCount: multiSubData?.subscriptions?.length ?? 0,
    subscription,
    trial: trialInfo,
    connectedDevices: devicesData?.total,
  });

  const firstName = user?.first_name || displayName(user);

  const renderHero = () => {
    switch (state) {
      case 'loading':
        return <HeroSkeleton />;
      case 'gift_pending':
        return <PendingGiftCard gifts={pendingGifts ?? []} />;
      case 'multi':
        return <MultiSubscriptionsHero subscriptions={multiSubData?.subscriptions ?? []} />;
      case 'daily_inactive':
        return subscription ? (
          <SubscriptionCardExpired
            subscription={subscription}
            balanceKopeks={balanceData?.balance_kopeks ?? 0}
            balanceRubles={balanceData?.balance_rubles ?? 0}
          />
        ) : null;
      default:
        return (
          <HomeHero
            state={state}
            subscription={subscription}
            trial={trialInfo}
            connectedDevices={devicesData?.total}
            balanceKopeks={balanceData?.balance_kopeks ?? 0}
            minPlanPriceKopeks={minPlanPriceKopeks(purchaseOptions)}
            onActivateTrial={() => activateTrialMutation.mutate()}
            isActivatingTrial={activateTrialMutation.isPending}
            trialError={trialError}
          />
        );
    }
  };

  const isNewUser = isNewUserState(state);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-dark-50 sm:text-3xl">
          {firstName ? t('home.greeting', { name: firstName }) : t('home.greetingNoName')}
        </h1>
        {isNewUser && <p className="mt-1 text-dark-400">{t('home.newSubtitle')}</p>}
      </div>

      {renderHero()}

      <HomeQuickTiles
        balanceRubles={balanceData?.balance_rubles}
        referralEnabled={referralEnabled === true}
        referral={
          referralInfo
            ? {
                totalReferrals: referralInfo.total_referrals,
                earningsRubles: referralInfo.available_balance_rubles,
                commissionPercent: referralInfo.commission_percent,
              }
            : null
        }
      />

      {isNewUser && (
        <Link
          to="/support"
          className="flex min-h-[44px] items-center gap-2.5 px-1 text-sm font-medium text-dark-400 hover:text-dark-200"
        >
          <ChatIcon className="h-[18px] w-[18px]" />
          {t('home.support')}
        </Link>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Удалить заменённые компоненты**

```bash
git rm src/components/dashboard/SubscriptionCardActive.tsx src/components/dashboard/subscriptionCardLayout.test.tsx src/components/dashboard/StatsGrid.tsx src/components/dashboard/ConnectDeviceTile.tsx
for name in TrafficProgressBar Sparkline; do
  echo "== $name"; grep -rln "$name" src | grep -v "src/components/dashboard/$name.tsx"
done
```

Для каждого из `TrafficProgressBar`, `Sparkline`: если grep ничего не вывел — удалить файл (`git rm src/components/dashboard/<Name>.tsx`); если нашёл импорт — оставить. Затем:

```bash
grep -rn "SubscriptionCardActive\|StatsGrid\|ConnectDeviceTile" src --include=*.ts --include=*.tsx | grep -v "^\S*:\s*//\|^\S*:\s*\*"
```

Expected: только упоминания в комментариях (например, `Subscription.tsx:745`), без импортов.

- [ ] **Step 6: Проверка**

Run: `npm run type-check && npm run lint && npm test`
Expected: всё зелёное. Тесты `blockedStorageRendering.test.tsx` про `useOnboarding` ещё проходят — `Onboarding.tsx` удаляется в задаче 8.

- [ ] **Step 7: Commit**

```bash
git add -A src/pages/Dashboard.tsx src/components/dashboard src/hooks/useTrafficAutoRefresh.ts src/locales
git commit -m "feat(home): новая главная — одна карточка с главным действием и две плитки"
```

---

### Task 8: Приветствие вместо тура

**Files:**
- Create: `src/hooks/useWelcomeSheet.ts`
- Create: `src/components/dashboard/WelcomeSheet.tsx`
- Test: `src/hooks/welcomeSheet.test.ts`
- Modify: `src/pages/Dashboard.tsx` (подключить шторку)
- Modify: `src/pages/blockedStorageRendering.test.tsx` (блок `useOnboarding` → `useWelcomeSheet`)
- Delete: `src/components/Onboarding.tsx`; неймспейс `onboarding` в локалях
- Modify: `src/locales/*.json` (через скрипт)

**Interfaces:**
- Consumes: `isNewUserState` (задача 4); `useBlockingStore((s) => s.blockingType)`; `useSuccessNotification((s) => s.isOpen)`; `safeLocal`, `isStorageAvailable` (`src/utils/safeStorage.ts`); `ResponsiveSheet({ isOpen, onClose, title, children })` (`src/components/ui/ResponsiveSheet.tsx`).
- Produces:
  - `welcomeKey(userId: number): string`
  - `shouldShowWelcome(input: { userId: number | undefined; isNewUser: boolean; seen: boolean; storageAvailable: boolean; overlayOpen: boolean }): boolean`
  - `useWelcomeSheet(userId: number | undefined, isNewUser: boolean): { open: boolean; close: () => void }`
  - `WelcomeSheet({ open, onClose })`

- [ ] **Step 1: Написать падающий тест**

`src/hooks/welcomeSheet.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { shouldShowWelcome, welcomeKey } from './useWelcomeSheet';

/**
 * Приветствие показывается новичку один раз на аккаунт (не на устройство,
 * как старый тур) и никогда не перекрывает другое модальное окно.
 * Если хранилище недоступно, не показываем вовсе: иначе оно всплывало бы
 * при каждом заходе.
 */
const base = {
  userId: 7,
  isNewUser: true,
  seen: false,
  storageAvailable: true,
  overlayOpen: false,
};

describe('shouldShowWelcome', () => {
  it('новичку, который ещё не видел, — да', () => {
    expect(shouldShowWelcome(base)).toBe(true);
  });

  it('уже видел — нет', () => {
    expect(shouldShowWelcome({ ...base, seen: true })).toBe(false);
  });

  it('не новичок — нет', () => {
    expect(shouldShowWelcome({ ...base, isNewUser: false })).toBe(false);
  });

  it('открыто другое окно или блокирующий экран — нет', () => {
    expect(shouldShowWelcome({ ...base, overlayOpen: true })).toBe(false);
  });

  it('хранилище недоступно — нет', () => {
    expect(shouldShowWelcome({ ...base, storageAvailable: false })).toBe(false);
  });

  it('пользователь ещё не загружен — нет', () => {
    expect(shouldShowWelcome({ ...base, userId: undefined })).toBe(false);
  });
});

describe('welcomeKey', () => {
  it('ключ привязан к аккаунту', () => {
    expect(welcomeKey(7)).toBe('welcome_seen:7');
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test -- src/hooks/welcomeSheet.test.ts`
Expected: FAIL — `Failed to resolve import "./useWelcomeSheet"`.

- [ ] **Step 3: Ключи**

```bash
cat > /tmp/stage1-welcome.json <<'EOF'
{
  "ru": { "welcome": {
    "title": "Добро пожаловать в {{name}}",
    "subtitle": "Чтобы VPN заработал, нужно три шага:",
    "step1": { "title": "Выберите тариф", "desc": "или попробуйте бесплатно" },
    "step2": { "title": "Оплатите подписку", "desc": "она включится сразу" },
    "step3": { "title": "Подключите устройство", "desc": "покажем, какое приложение поставить" },
    "start": "Начать",
    "skip": "Разберусь сам"
  } },
  "en": { "welcome": {
    "title": "Welcome to {{name}}",
    "subtitle": "Three steps to get your VPN working:",
    "step1": { "title": "Choose a plan", "desc": "or try it for free" },
    "step2": { "title": "Pay for the subscription", "desc": "it starts right away" },
    "step3": { "title": "Connect a device", "desc": "we'll show which app to install" },
    "start": "Get started",
    "skip": "I'll figure it out"
  } }
}
EOF
node -e "const f=require('/tmp/stage1-welcome.json');f.zh=f.en;f.fa=f.en;require('fs').writeFileSync('/tmp/stage1-welcome.json',JSON.stringify(f))"
node scripts/add-locale-keys.mjs /tmp/stage1-welcome.json
```

- [ ] **Step 4: Хук**

`src/hooks/useWelcomeSheet.ts`:

```ts
import { useState } from 'react';
import { useBlockingStore } from '@/store/blocking';
import { useSuccessNotification } from '@/store/successNotification';
import { isStorageAvailable, safeLocal } from '@/utils/safeStorage';

export function welcomeKey(userId: number): string {
  return `welcome_seen:${userId}`;
}

interface WelcomeInput {
  userId: number | undefined;
  isNewUser: boolean;
  seen: boolean;
  storageAvailable: boolean;
  overlayOpen: boolean;
}

export function shouldShowWelcome(input: WelcomeInput): boolean {
  return (
    input.userId !== undefined &&
    input.isNewUser &&
    !input.seen &&
    input.storageAvailable &&
    !input.overlayOpen
  );
}

/** Приветствие новичку — один раз на аккаунт, не поверх других окон. */
export function useWelcomeSheet(userId: number | undefined, isNewUser: boolean) {
  const blockingType = useBlockingStore((state) => state.blockingType);
  const successOpen = useSuccessNotification((state) => state.isOpen);
  const [storageAvailable] = useState(() => isStorageAvailable('local'));
  const [dismissed, setDismissed] = useState(false);

  const seen = userId !== undefined && safeLocal.getItem(welcomeKey(userId)) === '1';
  const open =
    !dismissed &&
    shouldShowWelcome({
      userId,
      isNewUser,
      seen,
      storageAvailable,
      overlayOpen: Boolean(blockingType) || successOpen,
    });

  const close = () => {
    if (userId !== undefined) safeLocal.setItem(welcomeKey(userId), '1');
    setDismissed(true);
  };

  return { open, close };
}
```

- [ ] **Step 5: Шторка**

`src/components/dashboard/WelcomeSheet.tsx`:

```tsx
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { ResponsiveSheet } from '@/components/ui/ResponsiveSheet';
import { DevicesIcon, ShieldIcon, WalletIcon } from '@/components/icons';
import { useBranding } from '@/hooks/useBranding';

const STEPS: { key: 'step1' | 'step2' | 'step3'; icon: ComponentType<{ className?: string }> }[] = [
  { key: 'step1', icon: ShieldIcon },
  { key: 'step2', icon: WalletIcon },
  { key: 'step3', icon: DevicesIcon },
];

interface WelcomeSheetProps {
  open: boolean;
  onClose: () => void;
}

export function WelcomeSheet({ open, onClose }: WelcomeSheetProps) {
  const { t } = useTranslation();
  const { appName } = useBranding();

  return (
    <ResponsiveSheet isOpen={open} onClose={onClose} title={t('welcome.title', { name: appName })}>
      <div className="space-y-5">
        <p className="text-[15px] text-dark-300">{t('welcome.subtitle')}</p>
        <ol className="space-y-3.5">
          {STEPS.map(({ key, icon: Icon }) => (
            <li key={key} className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-500/15 text-accent-300">
                <Icon className="h-5 w-5" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold text-dark-50">
                  {t(`welcome.${key}.title`)}
                </span>
                <span className="text-sm text-dark-400">{t(`welcome.${key}.desc`)}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={onClose}
            className="btn-primary flex w-full items-center justify-center py-3.5 text-base font-semibold"
          >
            {t('welcome.start')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] w-full items-center justify-center text-[15px] font-medium text-dark-400 hover:text-dark-200"
          >
            {t('welcome.skip')}
          </button>
        </div>
      </div>
    </ResponsiveSheet>
  );
}
```

Если `useBranding()` не возвращает `appName` строкой — посмотреть его в `src/hooks/useBranding.ts` (AppShell берёт оттуда `appName`) и подставить так же.

- [ ] **Step 6: Подключить на главной**

В `src/pages/Dashboard.tsx`:

1. Добавить импорты:

```tsx
import { useWelcomeSheet } from '../hooks/useWelcomeSheet';
import { WelcomeSheet } from '../components/dashboard/WelcomeSheet';
```

2. После строки `const isNewUser = isNewUserState(state);` добавить:

```tsx
  const welcome = useWelcomeSheet(user?.id, isNewUser);
```

3. Перед закрывающим `</div>` корневого контейнера добавить:

```tsx
      <WelcomeSheet open={welcome.open} onClose={welcome.close} />
```

- [ ] **Step 7: Удалить тур и обновить тест заблокированного хранилища**

```bash
grep -rn "components/Onboarding\|useOnboarding" src --include=*.ts --include=*.tsx
```

Expected: только `src/pages/blockedStorageRendering.test.tsx` (и комментарии в `src/utils/storageGuards.test.ts`).

В `src/pages/blockedStorageRendering.test.tsx` заменить весь блок `describe('useOnboarding при заблокированном localStorage', …)` на:

```tsx
describe('useWelcomeSheet при заблокированном localStorage', () => {
  it('рендерится и не показывает приветствие', async () => {
    blockStorage('localStorage');
    const { useWelcomeSheet } = await import('../hooks/useWelcomeSheet');

    function Probe() {
      const { open } = useWelcomeSheet(1, true);
      return <span data-testid="open">{String(open)}</span>;
    }

    render(<Probe />);

    expect(screen.getByTestId('open').textContent).toBe('false');
  });

  it('не бросает при закрытии', async () => {
    blockStorage('localStorage');
    const { useWelcomeSheet } = await import('../hooks/useWelcomeSheet');

    let close: (() => void) | null = null;
    function Probe() {
      const hook = useWelcomeSheet(1, true);
      close = hook.close;
      return null;
    }

    render(<Probe />);

    expect(() => close?.()).not.toThrow();
  });
});
```

В шапочном комментарии файла заменить «useOnboarding (то же)» на «useWelcomeSheet (проверка хранилища в инициализаторе useState)».

Удалить компонент и неиспользуемый неймспейс переводов:

```bash
git rm src/components/Onboarding.tsx
grep -rn "'onboarding\.\|\"onboarding\.\|t(\`onboarding" src --include=*.ts --include=*.tsx
```

Если grep пуст — удалить неймспейс:

```bash
for f in ru en zh fa; do node -e "const fs=require('fs');const p='src/locales/$f.json';const o=JSON.parse(fs.readFileSync(p,'utf8'));delete o.onboarding;fs.writeFileSync(p,JSON.stringify(o,null,2)+'\n')"; done
```

- [ ] **Step 8: Проверка**

Run: `npm run type-check && npm run lint && npm test`
Expected: всё зелёное.

- [ ] **Step 9: Commit**

```bash
git add -A src/hooks/useWelcomeSheet.ts src/hooks/welcomeSheet.test.ts src/components/dashboard/WelcomeSheet.tsx src/components/Onboarding.tsx src/pages/Dashboard.tsx src/pages/blockedStorageRendering.test.tsx src/locales
git commit -m "feat(home): приветствие новичку вместо тура по плитке баланса"
```

---

### Task 9: Проверка целиком

**Files:**
- Modify (опционально): `vite.config.ts` — цель dev-прокси из переменной окружения

- [ ] **Step 1: Полный прогон**

Run: `npm run type-check && npm run lint && npm run format:check && npm test && npm run build`
Expected: всё зелёное; `build` без новых предупреждений о размере чанков.

- [ ] **Step 2: Dev-прокси на реальный бэкенд (для ручной проверки)**

В `vite.config.ts` в обоих прокси (`/api` и `/health`) заменить `target: 'http://localhost:8080'` на `target: process.env.DEV_API_TARGET || 'http://localhost:8080'`. Запуск:

```bash
DEV_API_TARGET=https://cabinet.zanity.net/api npm run dev
```

Для `/health` прокси указывает на корень хоста — если `https://cabinet.zanity.net/health` не существует, баннер «сервис недоступен» может мигнуть; это не влияет на проверку. Войти на `http://localhost:5173` по email.

- [ ] **Step 3: Ручные сценарии (ширина 390px и десктоп)**

1. Нижний бар: Главная · Устройства · Поддержка · Ещё — одинаково на `/`, `/connection`, `/support`, `/more`; на `/balance`, `/subscriptions/<id>`, `/news` бара нет.
2. Десктоп: те же 4 пункта в шапке + «Админка» для админа.
3. «Ещё»: профиль, баланс с суммой, бонусные пункты по флагам, новости → `/news`, язык, тема, выход; для админа — «Админка».
4. Главная с активной подпиской: «Подписка активна», дни, «до <дата>», устройства «k из n», главная кнопка «Подключить ещё устройство», ниже «Продлить» и «Управление», плитки «Баланс» и «Пригласить друга». Новостей, колеса, бейджа промогруппы нет.
5. Новый аккаунт (email-регистрация): приветствие появляется один раз; после закрытия и перезагрузки — не появляется; на главной дорожка шагов и одна главная кнопка.
6. Telegram Mini App (после деплоя на стейдж): на `/more` и `/connection` — «Закрыть», на `/balance` — «Назад».

- [ ] **Step 4: Commit (если менялся vite.config.ts)**

```bash
git add vite.config.ts
git commit -m "chore(dev): цель dev-прокси из DEV_API_TARGET"
```
