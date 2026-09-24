import { useCallback } from 'react';
import { useNavigate } from 'react-router';

/**
 * «Назад» по истории, а если страницу открыли по прямой ссылке (истории в
 * приложении нет) — на запасной адрес, а не прочь из кабинета.
 */
export function useSafeBack(fallback: string): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, fallback]);
}
