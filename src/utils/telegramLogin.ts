/**
 * Telegram-вход на инстансе настроен: известно имя бота и это не шаблон из
 * .env.example. Кнопка входа и страница входа решают по одной функции.
 */
export function isTelegramLoginConfigured(botUsername: string | null | undefined): boolean {
  return Boolean(botUsername) && botUsername !== 'your_bot';
}
