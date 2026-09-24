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
