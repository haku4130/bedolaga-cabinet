# Редизайн кабинета, этап 4: вход с одной главной кнопкой — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** На экране входа в браузере одна главная кнопка «Войти через Telegram» с подписью «Нет аккаунта? Он создастся автоматически»; вход через бота — ссылка «Не получается? Войти через бота» (и сам включается, если виджет не загрузился); email — второстепенная кнопка, форма свёрнута.

**Architecture:** Меняется только подача. `TelegramLoginButton`: главная кнопка на всю ширину, «через бота» — текстовая ссылка вместо второй крупной кнопки. `Login.tsx`: форма email по умолчанию свёрнута и раскрывается кнопкой «Войти по email»; если Telegram-вход на инстансе не настроен — форма раскрыта сразу. Проверка «Telegram-вход настроен» выносится в общую функцию, чтобы кнопка и страница решали одинаково. Telegram Mini App (автовход) не меняется.

**Tech Stack:** React 19, TanStack Query, Tailwind, i18next, Vitest + Testing Library (jsdom), Biome.

**Spec:** `docs/superpowers/specs/2026-09-24-cabinet-ux-redesign-design.md`, раздел 8. Макет «1. Вход»: https://claude.ai/artifact/X8tnej9qiwm1mt3xTYewxK

## Global Constraints

- Главный способ на вебе — «Войти через Telegram» (решение владельца, 2026-09-24).
- Логика авторизации (OIDC, виджет, deep-link, согласие с офертой, OAuth, email, восстановление пароля) не меняется — только разметка и порядок.
- Новые строки — неймспейс `login.*` в `ru.json`/`en.json` (паритет — `src/locales/locales.test.ts`), в `zh.json`/`fa.json` — английский текст, через `node scripts/add-locale-keys.mjs <fragment.json>`.
- Тесты: `// @vitest-environment jsdom`; для `TelegramLoginButton` — та же обвязка, что в `src/components/telegramLoginButtonConsent.test.tsx`.
- Коммиты: `feat(login): …` по-русски.

## File Structure

| Файл | Статус | Ответственность |
|---|---|---|
| `src/utils/telegramLogin.ts` (+ `telegramLogin.test.ts`) | новый | `isTelegramLoginConfigured(botUsername)` |
| `src/components/TelegramLoginButton.tsx` (+ `telegramLoginLayout.test.tsx`) | изменить | Главная кнопка на всю ширину, подпись, ссылка «через бота» |
| `src/pages/Login.tsx` | изменить | Email свёрнут, кнопка «Войти по email», один разделитель «или» |

---

### Task 1: Кнопка Telegram — одна главная, бот ссылкой

**Files:**
- Create: `src/utils/telegramLogin.ts`, `src/utils/telegramLogin.test.ts`
- Create: `src/components/telegramLoginLayout.test.tsx`
- Modify: `src/components/TelegramLoginButton.tsx`
- Modify: `src/locales/*.json` (через скрипт)

**Interfaces:**
- Produces: `isTelegramLoginConfigured(botUsername: string | null | undefined): boolean`; ключи `login.autoCreate`, `login.botFallback`.

- [ ] **Step 1: Ключи**

```bash
cat > /tmp/stage4-login.json <<'EOF'
{
  "ru": { "login": {
    "autoCreate": "Нет аккаунта? Он создастся автоматически.",
    "botFallback": "Не получается? Войти через бота"
  } },
  "en": { "login": {
    "autoCreate": "No account yet? It will be created automatically.",
    "botFallback": "Not working? Sign in via the bot"
  } }
}
EOF
node -e "const f=require('/tmp/stage4-login.json');f.zh=f.en;f.fa=f.en;require('fs').writeFileSync('/tmp/stage4-login.json',JSON.stringify(f))"
node -e "console.log('login' in require('./src/locales/ru.json'))"
node scripts/add-locale-keys.mjs /tmp/stage4-login.json
```

Expected: `false`, затем `ru: ok` … `fa: ok`. Если неймспейс `login` уже есть — взять `signin.*` и поправить ключи во всех шагах ниже.

- [ ] **Step 2: Падающие тесты**

`src/utils/telegramLogin.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isTelegramLoginConfigured } from './telegramLogin';

/** Кнопка входа и страница входа должны одинаково решать, есть ли Telegram-вход. */
describe('isTelegramLoginConfigured', () => {
  it('есть имя бота — настроен', () => {
    expect(isTelegramLoginConfigured('zanity_bot')).toBe(true);
  });

  it('пусто или шаблонное имя из .env.example — не настроен', () => {
    expect(isTelegramLoginConfigured('')).toBe(false);
    expect(isTelegramLoginConfigured(undefined)).toBe(false);
    expect(isTelegramLoginConfigured('your_bot')).toBe(false);
  });
});
```

`src/components/telegramLoginLayout.test.tsx` — скопировать из `telegramLoginButtonConsent.test.tsx` блок моков (`vi.hoisted` c `translation`, моки `react-i18next`, `react-router`, `../store/auth`, `../api/branding`, `../api/auth`), функцию `installTelegramLoginStub`, `renderButton`, `beforeEach`/`afterEach`, и добавить:

```tsx
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
```

(мок `t` в той обвязке возвращает fallback, если он строка, иначе ключ; у `auth.loginWithTelegram` fallback не передаётся — в тексте будет ключ.)

Run: `npm test -- src/utils/telegramLogin.test.ts src/components/telegramLoginLayout.test.tsx`
Expected: FAIL (нет модуля; нет подписи и ссылки).

- [ ] **Step 3: Реализация**

`src/utils/telegramLogin.ts`:

```ts
/**
 * Telegram-вход на инстансе настроен: известно имя бота и это не шаблон из
 * .env.example. Кнопка входа и страница входа решают по одной функции.
 */
export function isTelegramLoginConfigured(botUsername: string | null | undefined): boolean {
  return Boolean(botUsername) && botUsername !== 'your_bot';
}
```

`src/components/TelegramLoginButton.tsx`:

1. Импорт `import { isTelegramLoginConfigured } from '../utils/telegramLogin';` и проверку `if (!botUsername || botUsername === 'your_bot') {` заменить на `if (!isTelegramLoginConfigured(botUsername)) {`.
2. В «Normal widget UI»: у OIDC-кнопки заменить `className` на

```tsx
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#54a9eb] px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#4a96d2] disabled:opacity-50"
```

   и у её обёртки `className="flex flex-col items-center space-y-2"` → `className="flex w-full flex-col items-center space-y-2"`.
3. Удалить разделитель «или» (`<div className="flex w-full max-w-xs items-center gap-3"> … {t('common.or')} … </div>`) и крупную кнопку «Manual opt-in» (с `auth.loginWithBot`) вместе с её комментарием; на их место:

```tsx
      <p className="text-center text-xs text-dark-400">{t('login.autoCreate')}</p>

      {/* Запасной путь: тот же deep-link, что включается сам, если виджет не
          загрузился, — ссылкой, а не второй крупной кнопкой рядом с главной. */}
      <button
        type="button"
        onClick={() => setManualDeepLink(true)}
        className="min-h-[36px] text-sm font-medium text-accent-400 transition-colors hover:text-accent-300"
      >
        {t('login.botFallback')}
      </button>
```

4. Корневой контейнер «Normal widget UI» `className="flex flex-col items-center space-y-4"` → `className="flex w-full flex-col items-center space-y-3"`.

- [ ] **Step 4: Проверка**

Run: `npm test -- src/utils/telegramLogin.test.ts src/components/telegramLoginLayout.test.tsx src/components/telegramLoginButtonConsent.test.tsx src/locales/locales.test.ts && npm run type-check`
Expected: PASS (тест согласия не затронут).

- [ ] **Step 5: Commit**

```bash
git add src/utils/telegramLogin.ts src/utils/telegramLogin.test.ts src/components/TelegramLoginButton.tsx src/components/telegramLoginLayout.test.tsx src/locales
git commit -m "feat(login): одна главная кнопка Telegram, вход через бота — ссылкой"
```

---

### Task 2: Страница входа — email свёрнут

**Files:**
- Modify: `src/pages/Login.tsx`

**Interfaces:**
- Consumes: `isTelegramLoginConfigured` (задача 1); `brandingApi.getTelegramWidgetConfig` (ключ `['telegram-widget-config']`, общий с кнопкой).

- [ ] **Step 1: Состояние формы**

1. `const [showEmailForm, setShowEmailForm] = useState(true);` → `useState(false)`.
2. Импорты: `import { isTelegramLoginConfigured } from '../utils/telegramLogin';`; `useEffect` в импорт из `react`, если его там нет.
3. После запроса `emailAuthConfig` добавить:

```tsx
  // Форма email свёрнута: главный путь — Telegram. Но если Telegram-вход на
  // инстансе не настроен, email — единственный путь, и форма открыта сразу.
  const { data: telegramWidgetConfig } = useQuery({
    queryKey: ['telegram-widget-config'],
    queryFn: brandingApi.getTelegramWidgetConfig,
    staleTime: 60000,
  });
  useEffect(() => {
    if (!telegramWidgetConfig) return;
    const botUsername =
      telegramWidgetConfig.bot_username || import.meta.env.VITE_TELEGRAM_BOT_USERNAME || '';
    if (!isTelegramLoginConfigured(botUsername)) setShowEmailForm(true);
  }, [telegramWidgetConfig]);
```

- [ ] **Step 2: Разметка — один «или», email кнопкой**

1. Блок «OAuth providers»: разделитель «или» внутри него удалить; вместо этого перед блоком OAuth вставить общий разделитель, который показывается, если есть хоть один второстепенный способ:

```tsx
            {(oauthProviders.length > 0 || isEmailAuthEnabled) && (
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-dark-700" />
                <span className="text-xs text-dark-500">{t('auth.or', 'or')}</span>
                <div className="h-px flex-1 bg-dark-700" />
              </div>
            )}
```

2. Блок «Email auth section»: строку-разделитель с кнопкой-«пилюлей» (`<div className="my-4 flex items-center gap-3"> … auth.loginWithEmail … </div>`) заменить на кнопку во всю ширину:

```tsx
                <button
                  type="button"
                  onClick={() => setShowEmailForm(!showEmailForm)}
                  aria-expanded={showEmailForm}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl border border-dark-700 bg-dark-800/60 py-3 text-sm font-medium text-dark-200 transition-colors hover:border-dark-600 hover:bg-dark-700 ${
                    oauthProviders.length > 0 ? 'mt-3' : ''
                  }`}
                >
                  <EmailIcon className="h-4 w-4 text-dark-400" />
                  <span>{t('auth.loginWithEmail')}</span>
                  <ChevronDownIcon
                    className={`h-4 w-4 text-dark-400 transition-transform duration-300 ${showEmailForm ? 'rotate-180' : ''}`}
                  />
                </button>
```

   Сворачиваемый блок формы (`grid-rows-[1fr]/[0fr]`) не менять, только добавить ему верхний отступ при раскрытии: у внутреннего `<div className="space-y-4 pb-1 pt-1">` → `pt-4`.

- [ ] **Step 3: Проверка**

Run: `npm run type-check && npm run lint && npm test`
Expected: всё зелёное; число предупреждений линтера не выросло.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Login.tsx
git commit -m "feat(login): форма email свёрнута, «Войти по email» — второстепенной кнопкой"
```

---

### Task 3: Проверка целиком

- [ ] **Step 1: Полный прогон**

Run: `npm run type-check && npm run lint && npm run format:check && npm test && npm run build`
Expected: всё зелёное.

- [ ] **Step 2: Ручные сценарии**

Экран входа виден только без сессии, поэтому проверка делается с разрешения владельца: выход из кабинета во встроенном браузере (dev-прокси на рабочий бэкенд), затем владелец входит снова — уже через новый экран.

1. Ширина 375 px: логотип, одна главная кнопка «Войти через Telegram» на всю ширину, под ней «Нет аккаунта? Он создастся автоматически.» и ссылка «Не получается? Войти через бота»; «или»; «Войти по email» — кнопкой, форма свёрнута.
2. «Не получается? Войти через бота» → QR и «Открыть бота», «Вернуться к виджету» возвращает главную кнопку.
3. «Войти по email» раскрывает форму с вкладками «Вход / Регистрация»; вход по email работает.
4. На localhost виджет Telegram может не загрузиться (домен бота) — тогда сразу показывается вход через бота; это ожидаемое поведение, а не ошибка.
