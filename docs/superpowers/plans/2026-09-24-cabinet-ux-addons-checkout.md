# Докупка устройств и трафика через «Оплатить» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** В окнах «Докупить устройства» и «Докупить трафик» — кнопка «Оплатить 453 ₽» вместо «Недостаточно средств · Пополнить»; без денег на балансе — оплата у провайдера и страница статуса «Устройства добавлены → Подключить устройство» / «Трафик добавлен → К подписке».

**Architecture:** Расширение механизма этапа 2 (`src/utils/checkout.ts`, `useCheckout`, `/subscription/status`) на два новых вида покупки. Бэкенд уже сохраняет корзины `add_devices` / `add_traffic` на 402 и докупает их после пополнения. Успех определяется по серверу: у подписки вырос `device_limit` или `traffic_limit_gb` (или трафик стал безлимитным) относительно запомненного до оплаты.

**Tech Stack:** React 19, TanStack Query, i18next, Vitest + Testing Library (jsdom), Biome.

**Spec:** этап 2 родительской спецификации (`docs/superpowers/specs/2026-09-24-cabinet-ux-redesign-design.md`, раздел 6) — те же правила; решение владельца от 2026-09-24 распространить их на докупку.

## Global Constraints

- Бэкенд не меняется. 402 от `/devices/purchase` отдаёт недостающее в `missing_kopeks`, от `/traffic` — в `missing_amount`; оба с `cart_saved: true`.
- Покупка трафика увеличивает `traffic_limit_gb` на купленный объём (у безлимита лимит остаётся 0); безлимитный пакет делает лимит 0.
- Новые строки — `checkout.addon.*` в `ru.json`/`en.json`, `zh`/`fa` — английский текст, через `node scripts/add-locale-keys.mjs`.
- Коммиты: `feat(checkout): …` по-русски.

---

### Task 1: Модель покупки знает про устройства и трафик

**Files:** Modify `src/utils/checkout.ts`, `src/utils/checkout.test.ts`, `src/hooks/useCheckout.ts`, `src/hooks/useCheckout.test.tsx`

**Interfaces:**
- `CheckoutKind = 'purchase' | 'renew' | 'devices' | 'traffic'`
- `PendingCheckout` += `devices: number | null`, `baselineDeviceLimit: number | null`, `baselineTrafficLimitGb: number | null`
- `CheckoutRequest` += `devices?: number | null`
- `getCheckoutShortfall` читает `missing_amount ?? missing_kopeks`
- `shouldSuppressWsModal` скрывает также `subscription.devices_purchased` / `subscription.traffic_purchased` на странице статуса

- [ ] **Step 1: Падающие тесты** — в `checkout.test.ts`: в фабрику `pending` добавить `devices: null, baselineDeviceLimit: null, baselineTrafficLimitGb: null`; добавить:

```ts
describe('resolveCheckoutStatus — докупка', () => {
  const base = { now: NOW, openedAt: NOW, balanceKopeks: 0 };

  it('устройства: лимит вырос — готово', () => {
    const p = pending({ kind: 'devices', subscriptionId: 5, devices: 1, baselineDeviceLimit: 3 });
    expect(resolveCheckoutStatus({ ...base, pending: p, subscriptions: [sub({ device_limit: 4 })] }).status).toBe('done');
    expect(resolveCheckoutStatus({ ...base, pending: p, subscriptions: [sub({ device_limit: 3 })] }).status).toBe('waiting');
  });

  it('трафик: лимит вырос или стал безлимитным — готово', () => {
    const p = pending({ kind: 'traffic', subscriptionId: 5, trafficGb: 50, baselineTrafficLimitGb: 100 });
    expect(resolveCheckoutStatus({ ...base, pending: p, subscriptions: [sub({ traffic_limit_gb: 150 })] }).status).toBe('done');
    expect(resolveCheckoutStatus({ ...base, pending: p, subscriptions: [sub({ traffic_limit_gb: 0 })] }).status).toBe('done');
    expect(resolveCheckoutStatus({ ...base, pending: p, subscriptions: [sub({ traffic_limit_gb: 100 })] }).status).toBe('waiting');
  });
});
```

и в `describe('getCheckoutShortfall')`: `it('докупка устройств отдаёт missing_kopeks', …)` с `{ code: 'insufficient_funds', missing_kopeks: 45300, cart_saved: true }` → `45300`; в `shouldSuppressWsModal`: `'subscription.devices_purchased'` и `'subscription.traffic_purchased'` на `/subscription/status` → `true`, на `/` → `false`.

В `useCheckout.test.tsx` мок списка подписок дополнить `device_limit: 3, traffic_limit_gb: 100` и добавить тест: `start({ ...request(...), kind: 'devices', subscriptionId: 5, devices: 1 })` c успешным `pay` → `loadPendingCheckout()` имеет `baselineDeviceLimit: 3`, `baselineTrafficLimitGb: 100`, `devices: 1`.

Run: `npm test -- src/utils/checkout.test.ts src/hooks/useCheckout.test.tsx` → FAIL.

- [ ] **Step 2: Реализация** — в `checkout.ts`:
  - типы и `loadPendingCheckout`: принимать четыре вида; новые поля читать как `raw.x ?? null`;
  - `resolveCheckoutStatus`: условие «продлилось» заменить на `isFulfilled(pending, target)`:

```ts
function isFulfilled(pending: PendingCheckout, target: SubscriptionListItem | null): boolean {
  if (target === null || INACTIVE_STATUSES.has(target.status)) return false;
  if (pending.kind === 'devices') {
    return pending.baselineDeviceLimit !== null && target.device_limit > pending.baselineDeviceLimit;
  }
  if (pending.kind === 'traffic') {
    const before = pending.baselineTrafficLimitGb;
    if (before === null) return false;
    // Докупка увеличивает лимит; безлимитный пакет делает его 0.
    return target.traffic_limit_gb > before || (before > 0 && target.traffic_limit_gb === 0);
  }
  return (
    target.end_date !== null &&
    (pending.baselineEndDate === null ||
      Date.parse(target.end_date) > Date.parse(pending.baselineEndDate))
  );
}
```

  - `getCheckoutShortfall`: `const missing = detail.missing_amount ?? detail.missing_kopeks;` и проверять `missing`;
  - `shouldSuppressWsModal`: список типов на странице статуса — `subscription.activated`, `subscription.renewed`, `subscription.devices_purchased`, `subscription.traffic_purchased`.

  В `useCheckout.ts`: `CheckoutRequest.devices?: number | null`; при сохранении — `devices: request.devices ?? null`, `baselineDeviceLimit: target?.device_limit ?? null`, `baselineTrafficLimitGb: target?.traffic_limit_gb ?? null`.

- [ ] **Step 3:** `npm test -- src/utils/checkout.test.ts src/hooks/useCheckout.test.tsx && npm run type-check` → PASS; commit `feat(checkout): ожидаемая покупка — ещё и докупка устройств и трафика`.

---

### Task 2: Страница статуса для докупки

**Files:** Modify `src/pages/CheckoutStatus.tsx`, `src/pages/checkoutStatus.test.tsx`, `src/components/WebSocketNotifications.tsx`, `src/locales/*.json`

- [ ] **Step 1: Ключи**

```bash
cat > /tmp/addons.json <<'EOF'
{
  "ru": { "checkout": { "addon": {
    "devicesLabel": "устройства: +{{count}}",
    "trafficLabel": "трафик: +{{gb}} ГБ",
    "trafficUnlimitedLabel": "безлимитный трафик",
    "devicesDone": "Устройства добавлены",
    "devicesDoneDesc": "Теперь можно подключить до {{count}} устройств.",
    "trafficDone": "Трафик добавлен",
    "trafficDoneDesc": "Лимит трафика: {{gb}} ГБ.",
    "trafficDoneUnlimited": "Трафик теперь без ограничений.",
    "toSubscription": "К подписке"
  } } },
  "en": { "checkout": { "addon": {
    "devicesLabel": "devices: +{{count}}",
    "trafficLabel": "traffic: +{{gb}} GB",
    "trafficUnlimitedLabel": "unlimited traffic",
    "devicesDone": "Devices added",
    "devicesDoneDesc": "You can now connect up to {{count}} devices.",
    "trafficDone": "Traffic added",
    "trafficDoneDesc": "Traffic limit: {{gb}} GB.",
    "trafficDoneUnlimited": "Traffic is now unlimited.",
    "toSubscription": "To subscription"
  } } }
}
EOF
node -e "const f=require('/tmp/addons.json');f.zh=f.en;f.fa=f.en;require('fs').writeFileSync('/tmp/addons.json',JSON.stringify(f))"
node scripts/add-locale-keys.mjs /tmp/addons.json
```

- [ ] **Step 2: Падающие тесты** в `checkoutStatus.test.tsx`: мок списка подписок получает `device_limit: api.deviceLimit` (по умолчанию 3) и `traffic_limit_gb: 100`; мок API — `purchaseDevices: api.purchaseDevices` (vi.fn); добавить:
  - `devices` с `baselineDeviceLimit: 3`, `api.deviceLimit = 4` → текст `checkout.addon.devicesDone` и ссылка `checkout.done.connect` → `/connection?sub=5`;
  - `devices`, давняя покупка, `api.balance = 45300`, лимит 3 → «Оформить» вызывает `purchaseDevices(1, 5)`.

- [ ] **Step 3: Реализация** в `CheckoutStatus.tsx`:
  - `paymentPathFor`: для `devices`/`traffic` с `subscriptionId` — `/subscriptions/{id}`;
  - в `confirmMutation`: ветки `devices` → `subscriptionApi.purchaseDevices(pending.devices ?? 1, pending.subscriptionId ?? undefined)`, `traffic` → `subscriptionApi.purchaseTraffic(pending.trafficGb ?? 0, pending.subscriptionId ?? undefined)`;
  - экран «готово»: для `devices` — заголовок `checkout.addon.devicesDone`, подзаголовок `checkout.addon.devicesDoneDesc` (`count: sub.device_limit`), без дорожки шагов и карточки «последний шаг», главная кнопка «Подключить устройство» (`/connection?sub={id}`), тихая — «К подписке» (`/subscriptions/{id}`); для `traffic` — `checkout.addon.trafficDone`, подзаголовок `trafficDoneDesc` (`gb: sub.traffic_limit_gb`) или `trafficDoneUnlimited` при 0, главная кнопка «К подписке». Покупка/продление — как было.

  В `WebSocketNotifications.tsx` ветки `subscription.devices_purchased` и `subscription.traffic_purchased` обернуть `showSuccessModal(...)` в `if (!suppressModal)`.

- [ ] **Step 4:** `npm test -- src/pages/checkoutStatus.test.tsx src/locales/locales.test.ts && npm run type-check` → PASS; commit `feat(checkout): статус докупки — «Устройства добавлены», «Трафик добавлен»`.

---

### Task 3: Окна докупки — «Оплатить»

**Files:** Modify `src/components/subscription/sheets/DeviceTopupSheet.tsx`, `TrafficTopupSheet.tsx`

- [ ] **Step 1: Устройства.** Импорт `useCheckout`; `const checkout = useCheckout();`. Удалить блок «Insufficient balance» (`InsufficientBalancePrompt` с `saveDevicesCart`) и его импорт. Кнопку «Купить» заменить: итог `total = devicePriceData?.total_price_kopeks ?? 0`, `fromBalance = min(balance, total)`, `toPay = total - fromBalance`; при `fromBalance > 0 && toPay > 0` — строки «С баланса −X» / «К оплате Y» (ключи `checkout.fromBalance`, `checkout.toPay`); кнопка `disabled={checkout.isPending || !devicePriceData?.available}`, `onClick`:

```tsx
checkout.start({
  kind: 'devices',
  tariffId: subscription.tariff_id ?? null,
  subscriptionId: subscriptionId ?? subscription.id,
  periodDays: 0,
  trafficGb: null,
  devices: devicesToAdd,
  label: `${subscription.tariff_name ?? t('subscription.defaultName', 'Подписка')} · ${t('checkout.addon.devicesLabel', { count: devicesToAdd })}`,
  priceKopeks: total,
  pay: () => subscriptionApi.purchaseDevices(devicesToAdd, subscriptionId),
})
```

  Подпись кнопки: `toPay > 0 ? t('checkout.pay', { amount: formatPrice(toPay) }) : t('checkout.payFromBalance', { amount: formatPrice(total) })`; ошибка — `checkout.error`. `devicePurchaseMutation` удалить (успех теперь ведёт на страницу статуса; инвалидации делает `useCheckout`).

- [ ] **Step 2: Трафик** — то же: удалить `InsufficientBalancePrompt` с `saveTrafficCart` и `hasEnoughBalance`-блокировку; `checkout.start({ kind: 'traffic', …, trafficGb: selectedTrafficPackage, devices: null, label: … selectedPkg?.is_unlimited ? t('checkout.addon.trafficUnlimitedLabel') : t('checkout.addon.trafficLabel', { gb: selectedTrafficPackage }), priceKopeks: selectedPkg.price_kopeks, pay: () => subscriptionApi.purchaseTraffic(selectedTrafficPackage, subscriptionId) })`; подпись кнопки — как у устройств; `purchaseMutation` удалить.

- [ ] **Step 3:** `npm run type-check && npm run lint && npm test` → зелёное (линтер — не больше предупреждений, чем было); commit `feat(checkout): докупка устройств и трафика через «Оплатить»`.

---

### Task 4: Проверка

- [ ] `npm run type-check && npm run lint && npm run format:check && npm test && npm run build`.
- [ ] Ручная (тестовый аккаунт владельца, баланс 0 ₽): «Докупить устройства» → «Оплатить 453 ₽», нет «Недостаточно средств»; нажатие → экран «Оплата подписки · Стандартный · устройства: +1» с суммой (до провайдера не идти); `/subscription/status` для этой покупки — «Ждём подтверждение оплаты», «Вернуться к оплате» ведёт на страницу подписки. Экран «Устройства добавлены» — подставив в `pending_checkout` меньший `baselineDeviceLimit` локально.
