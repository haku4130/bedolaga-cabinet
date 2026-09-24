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
