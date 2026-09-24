# Редизайн кабинета, этап 5: «Управление подпиской» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Страница `/subscriptions/:id` превращается в «Управление подпиской»: статус с днями и ссылкой на устройства, «Продлить», честное автопродление, дополнительные опции, свёрнутые подробности, перевыпуск. Подключение и список устройств — на вкладке «Устройства».

**Architecture:** Существующие блоки `Subscription.tsx` переставляются внутри файла механически, по меткам-комментариям — запросы, мутации и замыкания не трогаются. Новое — отдельными компонентами с тестами в `src/components/subscription/manage/` и чистой функцией `src/utils/autopayFunding.ts`. Удаляются: кнопка «Подключить устройство», посекундный отсчёт, «Мои устройства» на этой странице.

**Tech Stack:** React 19, TanStack Query, Tailwind, i18next, Vitest + Testing Library (jsdom), Biome.

**Spec:** `docs/superpowers/specs/2026-09-24-subscription-page-design.md`

## Global Constraints

- Бэкенд не меняется. Срок и цену автоплатежа кабинет не знает — баланс сравнивается с самой дешёвой ценой продления (`subscriptionApi.getRenewalOptions(subscriptionId)`); уверенно утверждается только нехватка.
- Поведение действий (автопродление с баланса, SBP, Lava, пауза суточного, окна докупки, серверы, перевыпуск с ограничением 15 минут, удаление истёкшей) не меняется.
- Новые строки — неймспейс `manage.*` в `ru.json`/`en.json` (паритет — `locales.test.ts`), `zh`/`fa` — английский текст, через `node scripts/add-locale-keys.mjs <fragment.json>`.
- Тесты: `// @vitest-environment jsdom`, мок `react-i18next` возвращает ключ; `useCurrency` мокается как в тестах главной.
- Коммиты: `feat(manage): …` по-русски.

## File Structure

| Файл | Статус | Ответственность |
|---|---|---|
| `src/utils/autopayFunding.ts` (+ тест) | новый | `autopayFunding`, `minRenewalPriceKopeks` |
| `src/components/subscription/manage/BalanceAutopayHint.tsx` | новый | Честная строка про баланс под переключателем |
| `src/components/subscription/manage/StatusFacts.tsx` | новый | «N дней · до {дата}», «Устройства: k из n →» |
| `src/components/subscription/manage/CollapsibleSection.tsx` | новый | Свёрнутая секция |
| `src/components/subscription/manage/SectionTitle.tsx` | новый | Заголовок секции |
| `src/components/subscription/manage/manage.test.tsx` | новый | Тесты трёх компонентов |
| `src/pages/Subscription.tsx` | изменить | Новый порядок секций, удаление лишнего |

---

### Task 1: Хватит ли баланса на автопродление

**Files:**
- Create: `src/utils/autopayFunding.ts`
- Test: `src/utils/autopayFunding.test.ts`

**Interfaces:**
- Produces:
  - `type AutopayFunding = { state: 'unknown' } | { state: 'ok' } | { state: 'short'; missingKopeks: number }`
  - `autopayFunding(balanceKopeks: number | undefined, minRenewalKopeks: number | null): AutopayFunding`
  - `minRenewalPriceKopeks(options: { price_kopeks: number }[] | undefined): number | null`

- [ ] **Step 1: Падающий тест**

`src/utils/autopayFunding.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { autopayFunding, minRenewalPriceKopeks } from './autopayFunding';

/**
 * Автопродление списывает с баланса. Кабинет не знает точную цену автоплатежа,
 * поэтому сравнивает баланс с самой дешёвой ценой продления и уверенно говорит
 * только о нехватке.
 */
describe('autopayFunding', () => {
  it('цена или баланс неизвестны — не выдумываем', () => {
    expect(autopayFunding(0, null)).toEqual({ state: 'unknown' });
    expect(autopayFunding(undefined, 10900)).toEqual({ state: 'unknown' });
  });

  it('денег меньше самой дешёвой цены — нехватка с суммой', () => {
    expect(autopayFunding(5000, 10900)).toEqual({ state: 'short', missingKopeks: 5900 });
  });

  it('денег не меньше самой дешёвой цены — ок', () => {
    expect(autopayFunding(10900, 10900)).toEqual({ state: 'ok' });
  });
});

describe('minRenewalPriceKopeks', () => {
  it('минимум по положительным ценам', () => {
    expect(minRenewalPriceKopeks([{ price_kopeks: 19900 }, { price_kopeks: 10900 }])).toBe(10900);
  });

  it('нет вариантов или только бесплатные — null', () => {
    expect(minRenewalPriceKopeks(undefined)).toBeNull();
    expect(minRenewalPriceKopeks([])).toBeNull();
    expect(minRenewalPriceKopeks([{ price_kopeks: 0 }])).toBeNull();
  });
});
```

Run: `npm test -- src/utils/autopayFunding.test.ts` → FAIL (нет модуля).

- [ ] **Step 2: Реализация**

`src/utils/autopayFunding.ts`:

```ts
export type AutopayFunding =
  | { state: 'unknown' }
  | { state: 'ok' }
  | { state: 'short'; missingKopeks: number };

/**
 * Хватит ли баланса на автопродление. Точную цену автоплатежа бот выбирает сам,
 * поэтому сравниваем с самой дешёвой ценой продления: нехватка — наверняка,
 * «достаточно» — лишь «не меньше минимума».
 */
export function autopayFunding(
  balanceKopeks: number | undefined,
  minRenewalKopeks: number | null,
): AutopayFunding {
  if (minRenewalKopeks === null || balanceKopeks === undefined) return { state: 'unknown' };
  if (balanceKopeks < minRenewalKopeks) {
    return { state: 'short', missingKopeks: minRenewalKopeks - balanceKopeks };
  }
  return { state: 'ok' };
}

export function minRenewalPriceKopeks(
  options: { price_kopeks: number }[] | undefined,
): number | null {
  const prices = (options ?? []).map((option) => option.price_kopeks).filter((price) => price > 0);
  return prices.length > 0 ? Math.min(...prices) : null;
}
```

- [ ] **Step 3: Проверка и commit**

Run: `npm test -- src/utils/autopayFunding.test.ts && npm run type-check` → PASS.

```bash
git add src/utils/autopayFunding.ts src/utils/autopayFunding.test.ts
git commit -m "feat(manage): хватит ли баланса на автопродление"
```

---

### Task 2: Новые компоненты страницы

**Files:**
- Create: `src/components/subscription/manage/BalanceAutopayHint.tsx`, `StatusFacts.tsx`, `CollapsibleSection.tsx`, `SectionTitle.tsx`
- Test: `src/components/subscription/manage/manage.test.tsx`
- Modify: `src/locales/*.json` (через скрипт)

**Interfaces:**
- Consumes: `autopayFunding` (задача 1); `useHomeFormat` (`src/components/dashboard/home/useHomeFormat.ts`); ключи `home.daysUnit`, `home.until`, `home.devicesCount`, `home.devicesUnlimited` (этап 1).
- Produces:
  - `BalanceAutopayHint({ enabled: boolean; daysBefore: number; balanceKopeks: number | undefined; minRenewalKopeks: number | null; subscriptionId: number })`
  - `StatusFacts({ subscription: Pick<Subscription, 'id' | 'days_left' | 'end_date' | 'device_limit' | 'is_daily'>; connectedDevices: number | undefined })`
  - `CollapsibleSection({ title: string; children: ReactNode })`
  - `SectionTitle({ children: ReactNode })`

- [ ] **Step 1: Ключи**

```bash
cat > /tmp/stage5-manage.json <<'EOF'
{
  "ru": { "manage": {
    "title": "Управление подпиской",
    "devices": "Устройства",
    "sections": { "autopay": "Автопродление", "details": "Подробности" },
    "manualSetup": "Ручная настройка",
    "manualSetupHint": "Ссылка подписки — для ручной настройки приложения. Не передавайте её другим.",
    "autopay": {
      "offHint_one": "Продлевать автоматически с баланса за {{count}} день до окончания.",
      "offHint_few": "Продлевать автоматически с баланса за {{count}} дня до окончания.",
      "offHint_many": "Продлевать автоматически с баланса за {{count}} дней до окончания.",
      "offHint_other": "Продлевать автоматически с баланса за {{count}} дня до окончания.",
      "onHint_one": "Спишем с баланса за {{count}} день до окончания.",
      "onHint_few": "Спишем с баланса за {{count}} дня до окончания.",
      "onHint_many": "Спишем с баланса за {{count}} дней до окончания.",
      "onHint_other": "Спишем с баланса за {{count}} дня до окончания.",
      "balance": "На балансе {{amount}}.",
      "short": "Сейчас на балансе {{amount}} — продление не пройдёт. Пополните заранее.",
      "topUp": "Пополнить баланс"
    }
  } },
  "en": { "manage": {
    "title": "Manage subscription",
    "devices": "Devices",
    "sections": { "autopay": "Auto-renewal", "details": "Details" },
    "manualSetup": "Manual setup",
    "manualSetupHint": "Subscription link for setting up an app manually. Don't share it.",
    "autopay": {
      "offHint_one": "Renew automatically from balance {{count}} day before expiry.",
      "offHint_other": "Renew automatically from balance {{count}} days before expiry.",
      "onHint_one": "We'll charge your balance {{count}} day before expiry.",
      "onHint_other": "We'll charge your balance {{count}} days before expiry.",
      "balance": "Balance: {{amount}}.",
      "short": "Your balance is {{amount}} — the renewal won't go through. Top up in advance.",
      "topUp": "Top up balance"
    }
  } }
}
EOF
node -e "const f=require('/tmp/stage5-manage.json');f.zh=f.en;f.fa=f.en;require('fs').writeFileSync('/tmp/stage5-manage.json',JSON.stringify(f))"
node -e "console.log('manage' in require('./src/locales/ru.json'))"
node scripts/add-locale-keys.mjs /tmp/stage5-manage.json
```

Expected: `false`, затем `ru: ok` … `fa: ok`.

- [ ] **Step 2: Падающий тест**

`src/components/subscription/manage/manage.test.tsx`:

```tsx
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
```

Run: `npm test -- src/components/subscription/manage/manage.test.tsx` → FAIL (нет модулей).

- [ ] **Step 3: Реализация**

`src/components/subscription/manage/SectionTitle.tsx`:

```tsx
import type { ReactNode } from 'react';

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="px-1 text-[13px] font-semibold text-dark-400">{children}</h2>;
}
```

`src/components/subscription/manage/CollapsibleSection.tsx`:

```tsx
import { type ReactNode, useState } from 'react';
import { ChevronDownIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

/** Редкое и техническое — свёрнуто, чтобы не мешать, но под рукой. */
export function CollapsibleSection({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="overflow-hidden rounded-3xl border border-dark-800/70 bg-dark-900/60">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-[52px] w-full items-center justify-between px-5 text-left text-[15px] font-semibold text-dark-100"
      >
        {title}
        <ChevronDownIcon
          className={cn('h-4 w-4 text-dark-400 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && <div className="space-y-5 px-5 pb-5">{children}</div>}
    </section>
  );
}
```

`src/components/subscription/manage/StatusFacts.tsx`:

```tsx
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChevronRightIcon } from '@/components/icons';
import { useHomeFormat } from '@/components/dashboard/home/useHomeFormat';
import type { Subscription } from '@/types';

interface StatusFactsProps {
  subscription: Pick<Subscription, 'id' | 'days_left' | 'end_date' | 'device_limit' | 'is_daily'>;
  connectedDevices: number | undefined;
}

/**
 * Главное о подписке одной строкой и вход в устройства: подключение и список
 * устройств живут на вкладке «Устройства», здесь — только ссылка туда.
 */
export function StatusFacts({ subscription: sub, connectedDevices }: StatusFactsProps) {
  const { t } = useTranslation();
  const format = useHomeFormat();
  const used = connectedDevices ?? 0;

  return (
    <div className="mb-6 space-y-3">
      {!sub.is_daily && (
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-dark-300">
          <span className="text-3xl font-extrabold leading-none tracking-tight text-dark-50">
            {sub.days_left}
          </span>
          <span>
            {t('home.daysUnit', { count: sub.days_left })} ·{' '}
            {t('home.until', { date: format.date(sub.end_date) })}
          </span>
        </p>
      )}
      <Link
        to={`/connection?sub=${sub.id}`}
        className="flex min-h-[48px] items-center justify-between gap-3 rounded-[14px] border border-dark-700/50 bg-dark-900/40 px-3.5 text-sm transition-colors hover:bg-dark-800/60"
      >
        <span className="font-semibold text-dark-100">{t('manage.devices')}</span>
        <span className="flex items-center gap-1.5 text-dark-300">
          {sub.device_limit === 0
            ? t('home.devicesUnlimited', { used })
            : t('home.devicesCount', { used, max: sub.device_limit })}
          <ChevronRightIcon className="h-4 w-4 text-dark-500" />
        </span>
      </Link>
    </div>
  );
}
```

`src/components/subscription/manage/BalanceAutopayHint.tsx`:

```tsx
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useHomeFormat } from '@/components/dashboard/home/useHomeFormat';
import { autopayFunding } from '@/utils/autopayFunding';

interface BalanceAutopayHintProps {
  enabled: boolean;
  daysBefore: number;
  balanceKopeks: number | undefined;
  minRenewalKopeks: number | null;
  subscriptionId: number;
}

/**
 * Автопродление списывает с баланса. Если денег меньше самой дешёвой цены
 * продления — прямо говорим, что оно не пройдёт, и даём пополнить недостающее.
 */
export function BalanceAutopayHint({
  enabled,
  daysBefore,
  balanceKopeks,
  minRenewalKopeks,
  subscriptionId,
}: BalanceAutopayHintProps) {
  const { t } = useTranslation();
  const format = useHomeFormat();

  if (!enabled) {
    return (
      <p className="px-1 text-xs text-dark-400">
        {t('manage.autopay.offHint', { count: daysBefore })}
      </p>
    );
  }

  const funding = autopayFunding(balanceKopeks, minRenewalKopeks);
  const onHint = t('manage.autopay.onHint', { count: daysBefore });
  const balance = format.price(balanceKopeks ?? 0);

  if (funding.state === 'short') {
    const params = new URLSearchParams({
      amount: String(Math.ceil(funding.missingKopeks / 100)),
      returnTo: `/subscriptions/${subscriptionId}`,
    });
    return (
      <div className="space-y-2.5 rounded-[14px] border border-warning-500/30 bg-warning-500/10 p-3.5">
        <p className="text-sm text-warning-300">
          {onHint} {t('manage.autopay.short', { amount: balance })}
        </p>
        <Link
          to={`/balance/top-up?${params.toString()}`}
          className="btn-secondary inline-flex items-center justify-center px-4 py-2 text-sm font-medium"
        >
          {t('manage.autopay.topUp')}
        </Link>
      </div>
    );
  }

  return (
    <p className="px-1 text-xs text-dark-400">
      {onHint}
      {funding.state === 'ok' && ` ${t('manage.autopay.balance', { amount: balance })}`}
    </p>
  );
}
```

- [ ] **Step 4: Проверка и commit**

Run: `npm test -- src/components/subscription/manage src/locales/locales.test.ts && npm run type-check` → PASS.

```bash
git add src/components/subscription/manage src/locales
git commit -m "feat(manage): статус с устройствами, честное автопродление, свёрнутые подробности"
```

---

### Task 3: Новый порядок страницы

**Files:**
- Modify: `src/pages/Subscription.tsx`

**Interfaces:**
- Consumes: всё из задач 1–2.

Правка механическая; выполнять скриптом ниже, затем проверять типами, линтером и глазами. Скрипт падает на `assert`, если какая-то метка не найдена, — тогда остановиться и сверить метки с файлом.

- [ ] **Step 1: Запрос цены продления и импорты**

Вручную в `src/pages/Subscription.tsx`:

1. Импорты:

```tsx
import { StatusFacts } from '../components/subscription/manage/StatusFacts';
import { BalanceAutopayHint } from '../components/subscription/manage/BalanceAutopayHint';
import { CollapsibleSection } from '../components/subscription/manage/CollapsibleSection';
import { SectionTitle } from '../components/subscription/manage/SectionTitle';
import { minRenewalPriceKopeks } from '../utils/autopayFunding';
```

2. Сразу после `const purchaseOptions = purchaseOptionsQuery.data;`:

```tsx
  // Самая дешёвая цена продления — чтобы честно сказать, хватит ли баланса на
  // автопродление (точную цену автоплатежа бот выбирает сам).
  const { data: renewalOptions } = useQuery({
    queryKey: ['renewal-options', subscriptionId],
    queryFn: () => subscriptionApi.getRenewalOptions(subscriptionId),
    enabled: !!subscription && !subscription.is_trial && !subscription.is_daily,
    staleTime: 60_000,
  });
  const minRenewalKopeks = minRenewalPriceKopeks(renewalOptions);
```

- [ ] **Step 2: Перестановка скриптом**

```bash
python3 - <<'PY'
p = 'src/pages/Subscription.tsx'
s = open(p).read()

def cut(start_marker, end_marker):
    """Вырезать [start_marker, end_marker) и вернуть вырезанное."""
    global s
    a = s.index(start_marker)
    b = s.index(end_marker, a)
    chunk = s[a:b]
    s = s[:a] + s[b:]
    return chunk

# 1. Заголовок страницы
old_title = """        <h1 className="text-2xl font-bold text-dark-50 sm:text-3xl">
          {isMultiTariff && subscription?.tariff_name
            ? subscription.tariff_name
            : t('subscription.title')}
        </h1>"""
assert s.count(old_title) == 1
s = s.replace(old_title, """        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-dark-50 sm:text-3xl">{t('manage.title')}</h1>
          {subscription?.tariff_name && (
            <p className="mt-0.5 truncate text-sm text-dark-400">{subscription.tariff_name}</p>
          )}
        </div>""")

# 2. Кнопка «Подключить устройство» — удалить
cut('              {/* ─── Connect Device Button ─── */}', '              {/* ─── Subscription URL ─── */}')

# 3. Из карточки статуса вынести: ссылку, отсчёт, локации, пакеты, автопродление, SBP, Lava
CARD_END = "            </div>\n          );\n        })()\n      ) : ("
block = cut('              {/* ─── Subscription URL ─── */}', CARD_END)
def part(start, end=None):
    a = block.index(start)
    b = block.index(end, a) if end else len(block)
    return block[a:b]
url_block = part('{/* ─── Subscription URL ─── */}', '              {/* ─── Countdown ─── */}')
locations_block = part('{/* ─── Locations ─── */}', '              {/* ─── Purchased Traffic Packages ─── */}')
packages_block = part('{/* ─── Purchased Traffic Packages ─── */}', '              {/* ─── Autopay Toggle ─── */}')
autopay_block = part('{/* ─── Autopay Toggle ─── */}', '              {/* ─── SBP Recurring Auto-payment ───')
sbp_block = part('{/* ─── SBP Recurring Auto-payment ───', '              {/* ─── Автопродление Lava ───')
lava_block = part('{/* ─── Автопродление Lava ───')
# Отсчёт (Countdown) не переносится — удаляется.

# 4. В карточке: факты статуса перед трафиком, полоса трафика — только у лимитных
tp = '              {/* ─── Traffic Progress ─── */}\n'
assert s.count(tp) == 1
tp_start = s.index(tp)
tp_end = s.index(CARD_END, tp_start)
traffic = s[tp_start + len(tp):tp_end]
s = (
    s[:tp_start]
    + "              <StatusFacts\n                subscription={subscription}\n                connectedDevices={connectedDevices}\n              />\n\n"
    + tp + "              {!isUnlimited && (\n                <>\n" + traffic + "                </>\n              )}\n"
    + s[tp_end:]
)

# 5. Хвост страницы: вырезать и собрать заново
daily = cut('      {/* Daily Subscription Pause */}', '      {/* Purchase / Renewal CTA */}')
cta = cut('      {/* Purchase / Renewal CTA */}', '      {/* Delete expired subscription */}')
delete_expired = cut('      {/* Delete expired subscription */}', '      {/* Additional Options (Buy Devices) */}')
extras = cut('      {/* Additional Options (Buy Devices) */}', '      {/* Reissue Subscription')
reissue = cut('      {/* Reissue Subscription', '      {/* My Devices Section */}')
devices_end = "      {subscription && <DevicesPanel subscriptionId={subscriptionId} />}\n"
cut('      {/* My Devices Section */}', devices_end)
s = s.replace(devices_end, '', 1)

autopay_section = (
    "      {/* Автопродление: с баланса (честно про деньги), SBP, Lava */}\n"
    "      {subscription &&\n"
    "        !subscription.is_trial &&\n"
    "        (!subscription.is_daily || sbpUiStateValue !== 'hidden' || lavaUiStateValue !== 'hidden') && (\n"
    "          <section className=\"space-y-2\">\n"
    "            <SectionTitle>{t('manage.sections.autopay')}</SectionTitle>\n"
    "            <div className=\"space-y-3\">\n"
    "              " + autopay_block.strip() + "\n"
    "              {!subscription.is_daily && (\n"
    "                <BalanceAutopayHint\n"
    "                  enabled={subscription.autopay_enabled}\n"
    "                  daysBefore={subscription.autopay_days_before}\n"
    "                  balanceKopeks={purchaseOptions?.balance_kopeks}\n"
    "                  minRenewalKopeks={minRenewalKopeks}\n"
    "                  subscriptionId={subscription.id}\n"
    "                />\n"
    "              )}\n"
    "              " + sbp_block.strip() + "\n"
    "              " + lava_block.strip() + "\n"
    "            </div>\n"
    "          </section>\n"
    "        )}\n\n"
)

details_section = (
    "      {/* Подробности: ручная настройка, локации, докупленный трафик */}\n"
    "      {subscription && (\n"
    "        <CollapsibleSection title={t('manage.sections.details')}>\n"
    "          {displayedConnectionUrl && !shouldHideConnectionLink && (\n"
    "            <div className=\"space-y-1\">\n"
    "              <p className=\"text-sm font-semibold text-dark-100\">{t('manage.manualSetup')}</p>\n"
    "              <p className=\"text-xs text-dark-400\">{t('manage.manualSetupHint')}</p>\n"
    "            </div>\n"
    "          )}\n"
    "          " + url_block.strip() + "\n"
    "          " + locations_block.strip() + "\n"
    "          " + packages_block.strip() + "\n"
    "        </CollapsibleSection>\n"
    "      )}\n\n"
)

tail = cta + autopay_section + daily + extras + details_section + reissue + delete_expired
end_marker = "    </div>\n  );\n}\n"
assert s.rstrip().endswith(end_marker.rstrip())
idx = s.rindex(end_marker)
s = s[:idx] + tail + s[idx:]
open(p, 'w').write(s)
PY
```

- [ ] **Step 3: Убрать ставшее ненужным**

Run: `npx biome check --write src/pages/Subscription.tsx && npm run type-check`

По сообщениям type-check удалить из `Subscription.tsx` ставшее неиспользуемым — ожидаемо: компонент `CountdownTimer` целиком (строки от `/** Isolated countdown so 1s interval doesn't re-render the whole page */` до `});` перед `export default function Subscription()`), импорты `memo`, `uiLocale`, `HoverBorderGradient`, `DevicesIcon`, `CalendarIcon`, `DevicesPanel`, и в карточке — `const isAtDeviceLimit = …` (две строки). Ничего другого не удалять: если type-check называет что-то ещё — сверить, действительно ли это было только в удалённых блоках.

- [ ] **Step 4: Проверка**

Run: `npm run type-check && npm run lint && npm test && npm run build`
Expected: всё зелёное; число предупреждений линтера не больше, чем до этапа (257 warnings / 102 infos на момент этапа 4).

- [ ] **Step 5: Commit**

```bash
git add src/pages/Subscription.tsx
git commit -m "feat(manage): страница подписки — статус, продление, автопродление, дополнительно, подробности"
```

---

### Task 4: Проверка целиком

- [ ] **Step 1: Полный прогон**

Run: `npm run type-check && npm run lint && npm run format:check && npm test && npm run build` → всё зелёное.

- [ ] **Step 2: Ручные сценарии (dev-прокси на рабочий бэкенд, 375 px; владелец входит заново — сессия истекла)**

1. `/subscriptions/<id>`: заголовок «Управление подпиской» и имя тарифа; карточка статуса: плашка, «N дней · до {дата}», строка «Устройства: k из n →» ведёт на вкладку «Устройства»; у безлимита полосы трафика нет; кнопки «Подключить устройство», посекундного отсчёта и «Мои устройства» нет.
2. Под карточкой — «Продлить подписку» без прокрутки (на 375 × 812).
3. «Автопродление»: переключатель; при балансе 0 ₽ и включённом — предупреждение «продление не пройдёт» и «Пополнить баланс» с суммой (открыть — это экран пополнения, не оплачивать); при выключенном — пояснение. Переключатель включается/выключается как раньше.
4. «Дополнительные опции»: «Докупить устройства», «Уменьшить», «Докупить трафик» открывают окна (закрыть без покупки).
5. «Подробности» свёрнуты; раскрываются: «Ручная настройка» со ссылкой и копированием, «Локации», докупленный трафик (если есть).
6. «Перевыпустить подписку» — только посмотреть, что блок на месте и не активировать (действие сбрасывает устройства).
