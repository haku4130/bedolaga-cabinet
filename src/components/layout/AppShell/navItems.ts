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
