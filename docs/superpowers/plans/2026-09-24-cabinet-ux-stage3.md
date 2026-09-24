# Редизайн кабинета, этап 3: подключение по шагам и без тупиков — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Вкладка «Устройства» говорит человеку «ваше устройство — iPhone, вот шаги 1-2-3», не заставляет выбирать из всех приложений сразу, показывает подключённые устройства и никогда не заканчивается экраном без действия.

**Architecture:** Содержимое шагов по-прежнему приходит из Subpage-конфига Remnawave (блоки приложения: «Установка приложения», «Добавление подписки» и т.д.) — кабинет его не выдумывает, а подаёт иначе: блоки нумеруются «Шаг 1 из 3», платформа показывается карточкой «Ваше устройство», прочие приложения свёрнуты. Список устройств выносится из `Subscription.tsx` в `DevicesPanel` без изменения поведения и ставится ещё и на страницу подключения. Экраны «нет подписки», «подключение настраивается» и выбор подписки в мультитарифе — отдельные маленькие компоненты с тестами. После этого «Устройства» всегда ведут на `/connection`.

**Tech Stack:** React 19, React Router, TanStack Query, Tailwind, i18next, Vitest + Testing Library (jsdom), Biome.

**Spec:** `docs/superpowers/specs/2026-09-24-cabinet-ux-redesign-design.md`, раздел 7. Макет «5. Подключение по шагам»: https://claude.ai/artifact/X8tnej9qiwm1mt3xTYewxK

## Global Constraints

- Тексты и кнопки шагов — из Subpage-конфига панели (`appConfig.platforms[*].apps[*].blocks`). Кабинет добавляет только нумерацию, подпись «Ваше устройство» и ссылки внизу.
- Стиль блоков из настройки панели (`uiConfig.installationGuidesBlockType`: cards / timeline / accordion / minimal) сохраняется; нумерация добавляется в cards и timeline.
- Бэкенд не меняется.
- Каждая новая строка — ключ в неймспейсе `connect.*` в `ru.json` и `en.json` (паритет — `src/locales/locales.test.ts`), в `zh.json`/`fa.json` — английский текст, через `node scripts/add-locale-keys.mjs <fragment.json>`.
- Перенос кода (`DevicesPanel`) — без изменения поведения и ключей запросов (`['devices', subscriptionId]`).
- Тесты: `// @vitest-environment jsdom`, мок `react-i18next` возвращает ключ. Команды: `npm test -- <путь>`, `npm run type-check`, `npm run lint`, `npm run build`.
- Коммиты: `feat(connect): …` по-русски.

## File Structure

| Файл | Статус | Ответственность |
|---|---|---|
| `src/components/layout/AppShell/navItems.ts` (+ тест), `AppShell.tsx` | изменить | «Устройства» всегда `/connection` |
| `src/components/subscription/DevicesPanel.tsx` (+ `devicesPanel.test.tsx`) | новый (перенос) | Список устройств: переименовать, удалить, удалить все |
| `src/pages/Subscription.tsx` | изменить | Вместо встроенного списка — `<DevicesPanel>` |
| `src/components/connection/ConnectionStates.tsx` (+ `connectionStates.test.tsx`) | новый | «Сначала оформите подписку», «Подключение настраивается», выбор подписки |
| `src/components/connection/blocks/types.ts`, `CardsBlock.tsx`, `TimelineBlock.tsx` (+ `stepsNumbering.test.tsx`) | изменить | Подпись «Шаг N из M» |
| `src/components/connection/InstallationGuide.tsx` | изменить | Карточка «Ваше устройство», свёрнутые «Другие приложения», «Назад» только по заходу со ссылки |
| `src/pages/Connection.tsx` | изменить | Выбор подписки, состояния без тупиков, автообновление, ссылки QR/поддержка, `DevicesPanel` |
| `src/pages/ConnectionQR.tsx` | изменить | Обычная кнопка «Назад» вместо админской |

---

### Task 1: «Устройства» всегда ведут на страницу подключения

**Files:**
- Modify: `src/components/layout/AppShell/navItems.ts`, `src/components/layout/AppShell/navItems.test.ts`
- Modify: `src/components/layout/AppShell/AppShell.tsx`

**Interfaces:**
- Produces: `navItems(): readonly NavItem[]` (без флагов); `TOP_LEVEL_PATHS = ['/', '/connection', '/support', '/more']`.

Мультитариф больше не нужен меню: выбор подписки появляется на самой странице подключения (задача 5). `/subscriptions` становится вложенным экраном (с главной — «Все подписки»), на нём в Telegram показывается «Назад».

- [ ] **Step 1: Обновить тест**

В `navItems.test.ts` заменить тест про мультитариф и тест про `TOP_LEVEL_PATHS` на:

```ts
  it('«Устройства» — всегда страница подключения: подписку выбирают там', () => {
    expect(navItems()[1]).toEqual({ key: 'devices', path: '/connection' });
  });

  it('TOP_LEVEL_PATHS — ровно разделы меню', () => {
    expect([...TOP_LEVEL_PATHS].sort()).toEqual(navItems().map((item) => item.path).sort());
  });
```

Run: `npm test -- src/components/layout/AppShell/navItems.test.ts`
Expected: FAIL (второй тест: в `TOP_LEVEL_PATHS` лишний `/subscriptions`).

- [ ] **Step 2: Реализация**

В `navItems.ts`:
- удалить интерфейс `NavFlags` и параметр; функция:

```ts
export function navItems(): readonly NavItem[] {
  return [
    { key: 'dashboard', path: '/' },
    { key: 'devices', path: '/connection' },
    { key: 'support', path: '/support' },
    { key: 'more', path: '/more' },
  ];
}
```

- `TOP_LEVEL_PATHS` → `['/', '/connection', '/support', '/more']`.
- Комментарий у `navItems` про мультитариф удалить.

В `AppShell.tsx`: удалить запрос `subscriptions-list` (блок с комментарием «Мультитариф меняет цель «Устройств»…»), импорт `subscriptionApi` и заменить `navItems({ multiTariff: … })` на `navItems()`.

- [ ] **Step 3: Проверка**

Run: `npm test -- src/components/layout/AppShell && npm run type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/AppShell
git commit -m "feat(connect): «Устройства» всегда ведут на страницу подключения"
```

---

### Task 2: Список устройств отдельным компонентом

**Files:**
- Create: `src/components/subscription/DevicesPanel.tsx`
- Test: `src/components/subscription/devicesPanel.test.tsx`
- Modify: `src/pages/Subscription.tsx`

**Interfaces:**
- Produces: `DevicesPanel({ subscriptionId }: { subscriptionId: number | undefined })` — сам грузит `['devices', subscriptionId]`, сам удаляет/переименовывает.

Это перенос: разметка и логика те же, что сейчас в `Subscription.tsx` в секции `{/* My Devices Section */}`.

- [ ] **Step 1: Написать падающий тест**

`src/components/subscription/devicesPanel.test.tsx`:

```tsx
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
        { hwid: 'bbbb2222', platform: 'macOS', device_model: 'Mac', created_at: null, local_name: 'Рабочий' },
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
```

Run: `npm test -- src/components/subscription/devicesPanel.test.tsx`
Expected: FAIL — `Failed to resolve import "./DevicesPanel"`.

- [ ] **Step 2: Создать компонент переносом**

`src/components/subscription/DevicesPanel.tsx` — каркас:

```tsx
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { subscriptionApi } from '@/api/subscription';
import { DEVICE_ALIAS_MAX_LENGTH } from '@/constants/devices';
import { useDestructiveConfirm } from '@/platform/hooks/useNativeDialog';
import { useHaptic } from '@/platform';
import { useTheme } from '@/hooks/useTheme';
import { getGlassColors } from '@/utils/glassTheme';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';

/**
 * «Мои устройства»: список, переименование, удаление одного и всех.
 * Перенесено из Subscription.tsx без изменения поведения — теперь тот же
 * список есть и на вкладке «Устройства».
 */
export function DevicesPanel({ subscriptionId }: { subscriptionId: number | undefined }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const haptic = useHaptic();
  const destructiveConfirm = useDestructiveConfirm();
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);

  // ↓ сюда — без изменений из Subscription.tsx:
  //   - запрос `devicesData` / `devicesLoading` (блок «// Devices query», без `enabled: !!subscription`),
  //   - `deleteDeviceMutation`, `deleteAllDevicesMutation`,
  //   - `editingDeviceHwid` / `editingDeviceName` и `renameDeviceMutation`
  //     (с их комментариями).

  return (
    // ↓ сюда — без изменений внутренний <div> секции `{/* My Devices Section */}`
    //   из Subscription.tsx (всё, что было внутри `{subscription && ( … )}`).
  );
}
```

Порядок действий:
1. В `Subscription.tsx` найти блок `// Devices query` … до `// Pause subscription mutation` (запрос устройств, две мутации удаления, состояние редактирования и `renameDeviceMutation`). **Скопировать** его в тело `DevicesPanel` на место первого комментария-указателя; у запроса удалить строку `enabled: !!subscription,`.
2. В `Subscription.tsx` найти `{/* My Devices Section */}` и следующий за ним `{subscription && ( <div …> … </div> )}`. **Перенести** внутренний `<div …>…</div>` в `return (…)` компонента на место второго комментария-указателя, удалив сами комментарии-указатели.
3. На месте секции в `Subscription.tsx` оставить:

```tsx
      {/* My Devices Section */}
      {subscription && <DevicesPanel subscriptionId={subscriptionId} />}
```

и добавить импорт `import { DevicesPanel } from '../components/subscription/DevicesPanel';`.

4. В `Subscription.tsx` удалить `deleteDeviceMutation`, `deleteAllDevicesMutation`, `editingDeviceHwid`/`editingDeviceName` и `renameDeviceMutation`. **Запрос `devicesData` оставить** — он нужен выше (`connectedDevices` около строки 721); ключ `['devices', subscriptionId]` общий, лишнего запроса не будет.
5. Прогнать `npm run type-check` и `npx biome check src/pages/Subscription.tsx src/components/subscription/DevicesPanel.tsx`: удалить ставшие неиспользуемыми импорты в `Subscription.tsx` (например `DEVICE_ALIAS_MAX_LENGTH`), ничего другого не трогать.

- [ ] **Step 3: Проверка**

Run: `npm test -- src/components/subscription && npm run type-check && npm run lint`
Expected: PASS; число предупреждений линтера не выросло.

- [ ] **Step 4: Commit**

```bash
git add src/components/subscription/DevicesPanel.tsx src/components/subscription/devicesPanel.test.tsx src/pages/Subscription.tsx
git commit -m "refactor(connect): «Мои устройства» отдельным компонентом"
```

---

### Task 3: Экраны без тупиков

**Files:**
- Create: `src/components/connection/ConnectionStates.tsx`
- Test: `src/components/connection/connectionStates.test.tsx`
- Modify: `src/locales/*.json` (через скрипт)

**Interfaces:**
- Produces:
  - `ConnectionNoSubscription({ trialAvailable }: { trialAvailable: boolean })`
  - `ConnectionNotReady({ isAdmin }: { isAdmin: boolean })`
  - `ConnectionSubscriptionPicker({ subscriptions }: { subscriptions: SubscriptionListItem[] })`
  - ключи `connect.*`

- [ ] **Step 1: Ключи**

```bash
cat > /tmp/stage3-connect.json <<'EOF'
{
  "ru": { "connect": {
    "yourDevice": "Ваше устройство",
    "device": "Устройство",
    "changePlatform": "Выбрать другое устройство",
    "otherApps": "Другие приложения ({{count}})",
    "hideOtherApps": "Скрыть другие приложения",
    "step": "Шаг {{n}} из {{total}}",
    "qrLink": "Подключить компьютер или ТВ по QR-коду",
    "help": "Не получается? Поможем в поддержке",
    "pick": { "title": "Какую подписку подключаем?", "until": "до {{date}}" },
    "noSub": {
      "title": "Сначала оформите подписку",
      "desc": "VPN заработает, как только подписка станет активной. Потом вернитесь сюда — покажем, что установить.",
      "tryFree": "Попробовать бесплатно",
      "choosePlan": "Выбрать тариф"
    },
    "notReady": {
      "title": "Подключение ещё настраивается",
      "desc": "Обычно это занимает несколько минут — страница обновится сама.",
      "help": "Написать в поддержку",
      "adminHint": "Добавьте приложения в разделе «Приложения» админки."
    }
  } },
  "en": { "connect": {
    "yourDevice": "Your device",
    "device": "Device",
    "changePlatform": "Choose another device",
    "otherApps": "Other apps ({{count}})",
    "hideOtherApps": "Hide other apps",
    "step": "Step {{n}} of {{total}}",
    "qrLink": "Connect a computer or TV with a QR code",
    "help": "Not working? Our support will help",
    "pick": { "title": "Which subscription are we connecting?", "until": "until {{date}}" },
    "noSub": {
      "title": "Get a subscription first",
      "desc": "The VPN works as soon as your subscription is active. Then come back here — we'll show what to install.",
      "tryFree": "Try for free",
      "choosePlan": "Choose a plan"
    },
    "notReady": {
      "title": "Connection is still being set up",
      "desc": "It usually takes a few minutes — this page will refresh by itself.",
      "help": "Contact support",
      "adminHint": "Add apps in the admin «Apps» section."
    }
  } }
}
EOF
node -e "const f=require('/tmp/stage3-connect.json');f.zh=f.en;f.fa=f.en;require('fs').writeFileSync('/tmp/stage3-connect.json',JSON.stringify(f))"
node scripts/add-locale-keys.mjs /tmp/stage3-connect.json
```

Expected: `ru: ok` … `fa: ok`; перед этим убедиться, что неймспейса `connect` в `ru.json` ещё нет (`node -e "console.log('connect' in require('./src/locales/ru.json'))"` → `false`).

- [ ] **Step 2: Написать падающий тест**

`src/components/connection/connectionStates.test.tsx`:

```tsx
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
```

Run: `npm test -- src/components/connection/connectionStates.test.tsx`
Expected: FAIL — `Failed to resolve import "./ConnectionStates"`.

- [ ] **Step 3: Реализация**

`src/components/connection/ConnectionStates.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChatIcon, ChevronRightIcon, SettingsIcon } from '@/components/icons';
import { useHomeFormat } from '@/components/dashboard/home/useHomeFormat';
import type { SubscriptionListItem } from '@/types';

const PRIMARY =
  'btn-primary flex w-full items-center justify-center gap-2 py-3.5 text-base font-semibold';
const SECONDARY =
  'btn-secondary flex w-full items-center justify-center gap-2 py-3 text-sm font-medium';

function StateCard({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 pt-6 text-center">
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-dark-50">{title}</h1>
        <p className="text-[15px] leading-relaxed text-dark-300">{text}</p>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

/** Подписки нет: объясняем и ведём туда, где её получить. */
export function ConnectionNoSubscription({ trialAvailable }: { trialAvailable: boolean }) {
  const { t } = useTranslation();
  return (
    <StateCard title={t('connect.noSub.title')} text={t('connect.noSub.desc')}>
      {trialAvailable ? (
        <>
          <Link to="/" className={PRIMARY}>
            {t('connect.noSub.tryFree')}
          </Link>
          <Link to="/subscription/purchase" className={SECONDARY}>
            {t('connect.noSub.choosePlan')}
          </Link>
        </>
      ) : (
        <Link to="/subscription/purchase" className={PRIMARY}>
          {t('connect.noSub.choosePlan')}
        </Link>
      )}
    </StateCard>
  );
}

/** Приложения для подключения ещё не настроены в панели. */
export function ConnectionNotReady({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation();
  return (
    <StateCard
      title={t('connect.notReady.title')}
      text={isAdmin ? t('connect.notReady.adminHint') : t('connect.notReady.desc')}
    >
      {isAdmin && (
        <Link to="/admin/apps" className={PRIMARY}>
          <SettingsIcon className="h-4 w-4" />
          {t('subscription.connection.goToApps')}
        </Link>
      )}
      <Link to="/support" className={SECONDARY}>
        <ChatIcon className="h-4 w-4" />
        {t('connect.notReady.help')}
      </Link>
    </StateCard>
  );
}

/** Мультитариф: сначала — какую подписку подключаем. */
export function ConnectionSubscriptionPicker({
  subscriptions,
}: {
  subscriptions: SubscriptionListItem[];
}) {
  const { t } = useTranslation();
  const format = useHomeFormat();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-bold text-dark-50">{t('connect.pick.title')}</h1>
      <div className="space-y-2">
        {subscriptions.map((sub) => (
          <Link
            key={sub.id}
            to={`/connection?sub=${sub.id}`}
            className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-dark-700/50 bg-dark-800/50 px-4 py-3 transition-colors hover:bg-dark-800"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold text-dark-50">
                {sub.tariff_name || t('subscription.defaultName', 'Подписка')}
              </span>
              {sub.end_date && (
                <span className="block text-sm text-dark-400">
                  {t('connect.pick.until', { date: format.date(sub.end_date) })}
                </span>
              )}
            </span>
            <ChevronRightIcon className="h-4 w-4 shrink-0 text-dark-500" />
          </Link>
        ))}
      </div>
    </div>
  );
}
```

В тесте выбора подписки ссылка ищется по тексту имени тарифа (`closest('a')`), поэтому имя тарифа должно лежать внутри `<Link>` — как в коде выше.

- [ ] **Step 4: Проверка**

Run: `npm test -- src/components/connection/connectionStates.test.tsx src/locales/locales.test.ts && npm run type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/connection/ConnectionStates.tsx src/components/connection/connectionStates.test.tsx src/locales
git commit -m "feat(connect): экраны без тупиков — нет подписки, настраивается, выбор подписки"
```

---

### Task 4: Нумерация шагов

**Files:**
- Modify: `src/components/connection/blocks/types.ts`, `CardsBlock.tsx`, `TimelineBlock.tsx`
- Test: `src/components/connection/blocks/stepsNumbering.test.tsx`

**Interfaces:**
- Produces: `BlockRendererProps.stepLabel?: (index: number, total: number) => string` — если передан, cards и timeline пишут подпись над заголовком каждого видимого блока; первая карточка в cards выделена рамкой.

- [ ] **Step 1: Написать падающий тест**

`src/components/connection/blocks/stepsNumbering.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { LocalizedText } from '@/types';
import { CardsBlock } from './CardsBlock';
import { TimelineBlock } from './TimelineBlock';
import type { BlockRendererProps } from './types';

/**
 * Блоки инструкции из панели — это шаги. Человек должен видеть, что их
 * три и где он: «Шаг 1 из 3».
 */

afterEach(cleanup);

const text = (value: string): LocalizedText => ({ ru: value, en: value });

const props = (stepLabel?: BlockRendererProps['stepLabel']): BlockRendererProps => ({
  blocks: [
    { title: text('Установка приложения'), description: text('') },
    { title: text(''), description: text('') },
    { title: text('Добавление подписки'), description: text('') },
  ],
  isMobile: true,
  isLight: false,
  getLocalizedText: (value) => value?.ru ?? '',
  getSvgHtml: () => '',
  renderBlockButtons: () => null,
  stepLabel,
});

const label = (index: number, total: number) => `Шаг ${index + 1} из ${total}`;

describe.each([
  ['cards', CardsBlock],
  ['timeline', TimelineBlock],
])('%s', (_name, Renderer) => {
  it('нумерует только видимые блоки', () => {
    render(<Renderer {...props(label)} />);
    expect(screen.getByText('Шаг 1 из 2')).toBeTruthy();
    expect(screen.getByText('Шаг 2 из 2')).toBeTruthy();
  });

  it('без stepLabel — как раньше', () => {
    render(<Renderer {...props()} />);
    expect(screen.queryByText(/Шаг/)).toBeNull();
  });
});
```

Run: `npm test -- src/components/connection/blocks/stepsNumbering.test.tsx`
Expected: FAIL (подписей нет).

- [ ] **Step 2: Реализация**

`types.ts` — в `BlockRendererProps` добавить:

```ts
  /** «Шаг N из M» над заголовком блока; без него блоки рисуются как раньше. */
  stepLabel?: (index: number, total: number) => string;
```

`CardsBlock.tsx` — принять `stepLabel` в деструктуризации; класс карточки заменить на:

```tsx
            className={`rounded-2xl border p-4 sm:p-5 ${
              stepLabel && index === 0
                ? 'border-accent-400/40 bg-accent-500/5'
                : isLight
                  ? 'border-dark-700/60 bg-white/80 shadow-sm'
                  : 'border-dark-700/50 bg-dark-800/50'
            }`}
```

и перед `<h3>` добавить:

```tsx
                {stepLabel && (
                  <p className="mb-0.5 text-xs font-semibold text-accent-400">
                    {stepLabel(index, visibleBlocks.length)}
                  </p>
                )}
```

`TimelineBlock.tsx` — принять `stepLabel` и перед `<h3>` добавить тот же блок `{stepLabel && (…)}`.

- [ ] **Step 3: Проверка**

Run: `npm test -- src/components/connection && npm run type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/connection/blocks
git commit -m "feat(connect): «Шаг N из M» в инструкции подключения"
```

---

### Task 5: Страница подключения

**Files:**
- Modify: `src/components/connection/InstallationGuide.tsx`
- Modify: `src/pages/Connection.tsx`
- Modify: `src/pages/ConnectionQR.tsx`

**Interfaces:**
- Consumes: `stepLabel` (задача 4); `ConnectionNoSubscription`, `ConnectionNotReady`, `ConnectionSubscriptionPicker` (задача 3); `DevicesPanel` (задача 2); ключи `connect.*` (задача 3).
- Produces: `InstallationGuide` с необязательным `onGoBack?: () => void`.

- [ ] **Step 1: InstallationGuide — «Назад», шаги, выбор платформы**

1. В `Props` сделать `onGoBack?: () => void`; кнопку «Назад» в шапке показывать при `!isTelegramWebApp && onGoBack`.
2. Добавить импорт `DevicesIcon` в импорт иконок.
3. Вынести обработчик `onChange` селекта платформы в функцию (тело то же) и добавить сворачивание приложений:

```tsx
  const [showOtherApps, setShowOtherApps] = useState(false);

  const handlePlatformChange = (newPlatform: string) => {
    setActivePlatformKey(newPlatform);
    setShowOtherApps(false);
    const data = appConfig.platforms[newPlatform] as RemnawavePlatformData | undefined;
    if (data?.apps?.length) {
      // Keep the user's current app (by name) if it also exists on the
      // new platform; only fall back to featured/first otherwise.
      const app =
        data.apps.find((a) => a.name === selectedApp?.name) ||
        data.apps.find((a) => a.featured) ||
        data.apps[0];
      if (app) setSelectedApp(app);
    }
  };
```

(объявить после `currentPlatformApps`).

4. Удалить из шапки блок `{availablePlatforms.length > 1 && ( <div className="relative flex items-center"> … <select …> … </div> )}` и сразу после шапки (`</div>` блока «Header + platform dropdown») вставить карточку устройства:

```tsx
      {currentPlatformKey && (
        <div className="flex items-center gap-3 rounded-2xl border border-dark-700/50 bg-dark-800/50 p-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dark-900/60 text-accent-400">
            {currentPlatformSvg ? (
              <span
                className="h-5 w-5 [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: currentPlatformSvg }}
              />
            ) : (
              <DevicesIcon className="h-5 w-5" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-dark-400">
              {currentPlatformKey === detectedPlatform ? t('connect.yourDevice') : t('connect.device')}
            </span>
            <span className="block truncate text-base font-semibold text-dark-50">
              {getPlatformDisplayName(currentPlatformKey)}
            </span>
          </span>
          {availablePlatforms.length > 1 && (
            <label className="relative flex items-center">
              <span className="sr-only">{t('connect.changePlatform')}</span>
              <select
                value={currentPlatformKey}
                onChange={(e) => handlePlatformChange(e.target.value)}
                className="appearance-none rounded-xl border border-dark-700 bg-dark-800 py-2 pl-3 pr-8 text-sm font-medium text-dark-200 outline-none transition-colors hover:border-dark-600"
              >
                {availablePlatforms.map((p) => (
                  <option key={p} value={p}>
                    {getPlatformDisplayName(p)}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2.5 text-dark-400">
                <ChevronIcon className="h-4 w-4" />
              </span>
            </label>
          )}
        </div>
      )}
```

5. Блок «App chips»: перед ним вычислить

```tsx
  const otherAppsCount = currentPlatformApps.filter((app) => app.name !== selectedApp?.name).length;
  const visibleApps = showOtherApps
    ? currentPlatformApps
    : currentPlatformApps.filter((app) => app.name === selectedApp?.name);
```

и в разметке `currentPlatformApps.map(…)` заменить на `visibleApps.map(…)` (разметку чипа не менять), а сразу после `</div>` списка чипов (внутри условия `currentPlatformApps.length > 0`) добавить:

```tsx
          {otherAppsCount > 0 && (
            <button
              type="button"
              onClick={() => setShowOtherApps((value) => !value)}
              className="min-h-[36px] text-sm font-medium text-accent-400 hover:text-accent-300"
            >
              {showOtherApps
                ? t('connect.hideOtherApps')
                : t('connect.otherApps', { count: otherAppsCount })}
            </button>
          )}
```

Обёртку `<div className="flex flex-wrap gap-2">` поместить в `<div className="space-y-2">` вместе с кнопкой.

6. В `<Renderer … />` добавить проп:

```tsx
          stepLabel={(index, total) => t('connect.step', { n: index + 1, total })}
```

- [ ] **Step 2: Connection — выбор подписки, состояния, ссылки, устройства**

В `src/pages/Connection.tsx`:

1. Импорты: `ChatIcon`, `ScanIcon` из `@/components/icons` (рядом с `SettingsIcon`; `SettingsIcon` и `Link` станут не нужны — удалить, если линтер скажет); `ConnectionNoSubscription`, `ConnectionNotReady`, `ConnectionSubscriptionPicker` из `../components/connection/ConnectionStates`; `DevicesPanel` из `../components/subscription/DevicesPanel`; `Link` из `react-router` оставить для ссылки на поддержку.
2. Выбор подписки. Вместо строки `const subId = …` :

```tsx
  const subIdParam = searchParams.get('sub') ? Number(searchParams.get('sub')) : undefined;
  const { data: subsList, isLoading: subsLoading } = useQuery({
    queryKey: ['subscriptions-list'],
    queryFn: () => subscriptionApi.getSubscriptions(),
    staleTime: 30_000,
  });
  const isMultiTariff = subsList?.multi_tariff_enabled ?? false;
  const subscriptions = subsList?.subscriptions ?? [];
  // Мультитариф: с одной подпиской выбирать нечего, с несколькими — спрашиваем.
  const subId =
    subIdParam ?? (isMultiTariff && subscriptions.length === 1 ? subscriptions[0].id : undefined);
  const needsPick = isMultiTariff && subIdParam === undefined && subscriptions.length > 1;
```

3. Запросам `appConfig` и `connectionLink` добавить `enabled: !subsLoading && !needsPick`; запросу `appConfig` — автообновление, пока подключение не настроено:

```tsx
    refetchInterval: (query) =>
      query.state.status === 'error' || (query.state.data && !appHasApps(query.state.data))
        ? 10_000
        : false,
```

а `hasApps` посчитать через ту же функцию, объявленную над компонентом:

```tsx
function appHasApps(config: AppConfig): boolean {
  return Object.values(config.platforms ?? {}).some(
    (p: RemnawavePlatformData) => p.apps && p.apps.length > 0,
  );
}
```

(`const hasApps = useMemo(() => (appConfig ? appHasApps(appConfig) : false), [appConfig]);`).

4. Триал для экрана «нет подписки»:

```tsx
  const { data: trialInfo } = useQuery({
    queryKey: ['trial-info'],
    queryFn: () => subscriptionApi.getTrialInfo(),
    enabled: appConfig?.hasSubscription === false,
  });
```

5. Ранние возвраты в таком порядке (перед текущей проверкой загрузки): `if (needsPick) return <ConnectionSubscriptionPicker subscriptions={subscriptions} />;`. Скелетон загрузки — условие дополнить `|| subsLoading`. Блок «error || !appConfig || !hasApps» целиком заменить на `return <ConnectionNotReady isAdmin={isAdmin} />;`. Блок «No subscription» заменить на `return <ConnectionNoSubscription trialAvailable={trialInfo?.is_available === true} />;`.

6. Финальный `return` заменить на:

```tsx
  return (
    <div className="space-y-6">
      <InstallationGuide
        appConfig={appConfig}
        onOpenDeepLink={openDeepLink}
        isTelegramWebApp={isTelegramWebApp}
        // «Назад» — только если пришли по ссылке (с главной, после оплаты);
        // вкладка «Устройства» — раздел меню, возвращаться с неё некуда.
        onGoBack={subIdParam !== undefined ? handleGoBack : undefined}
        onOpenQR={handleOpenQR}
        username={user?.username ?? undefined}
      />
      <div className="space-y-1">
        {qrConnectionUrl && (
          <button
            type="button"
            onClick={handleOpenQR}
            className="flex min-h-[44px] w-full items-center gap-2.5 text-left text-[15px] font-medium text-accent-400 hover:text-accent-300"
          >
            <ScanIcon className="h-[18px] w-[18px]" />
            {t('connect.qrLink')}
          </button>
        )}
        <Link
          to="/support"
          className="flex min-h-[44px] items-center gap-2.5 text-[15px] font-medium text-accent-400 hover:text-accent-300"
        >
          <ChatIcon className="h-[18px] w-[18px]" />
          {t('connect.help')}
        </Link>
      </div>
      <DevicesPanel subscriptionId={subId} />
    </div>
  );
```

- [ ] **Step 3: QR — обычная «Назад»**

В `src/pages/ConnectionQR.tsx` заменить `import { AdminBackButton } from '@/components/admin';` на `import { WebBackButton } from '@/components/WebBackButton';` и `<AdminBackButton to={connectionPath} replace />` на `<WebBackButton to={connectionPath} replace />`.

- [ ] **Step 4: Проверка**

Run: `npm run type-check && npm run lint && npm test`
Expected: всё зелёное; число предупреждений линтера не выросло.

- [ ] **Step 5: Commit**

```bash
git add src/components/connection/InstallationGuide.tsx src/pages/Connection.tsx src/pages/ConnectionQR.tsx
git commit -m "feat(connect): «Ваше устройство», шаги, ссылки на QR и поддержку, мои устройства"
```

---

### Task 6: Проверка целиком

- [ ] **Step 1: Полный прогон**

Run: `npm run type-check && npm run lint && npm run format:check && npm test && npm run build`
Expected: всё зелёное.

- [ ] **Step 2: Ручные сценарии (dev-прокси на рабочий бэкенд, ширина 375 и 320 px)**

1. Вкладка «Устройства»: карточка «Ваше устройство: <платформа>» (в браузере на Mac — macOS), селект других платформ; чип выбранного приложения и «Другие приложения (N)» — по нажатию показываются остальные; блоки с подписями «Шаг 1 из N», первый выделен; ниже ссылки «Подключить компьютер или ТВ по QR-коду» и «Не получается? Поможем в поддержке»; ещё ниже — «Мои устройства» со списком.
2. Кнопки «Назад» на вкладке нет; с главной («Подключить ещё устройство») — есть.
3. QR: открывается, «Назад» возвращает на подключение.
4. Страница подписки: «Мои устройства» выглядит и работает как раньше (переименование, удаление — проверить на реальном устройстве не удаляя его: открыть режим переименования и отменить).
5. Смена платформы в селекте на Android: список «Другие приложения» свёрнут, шаги от выбранного приложения.
