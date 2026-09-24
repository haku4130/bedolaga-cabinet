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
