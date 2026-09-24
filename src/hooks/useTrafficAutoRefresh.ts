import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscriptionApi } from '@/api/subscription';
import { API } from '@/config/constants';
import { safeLocal } from '@/utils/safeStorage';
import type { Subscription } from '@/types';

/**
 * Панель отдаёт расход трафика с задержкой, поэтому раз в API.TRAFFIC_CACHE_MS
 * просим бэкенд его пересчитать. Только для лимитных тарифов — на безлимите
 * полоса трафика на главной не показывается.
 */
export function useTrafficAutoRefresh(subscription: Subscription | null): void {
  const queryClient = useQueryClient();
  const started = useRef(false);

  useEffect(() => {
    if (!subscription || subscription.traffic_limit_gb === 0 || started.current) return;
    started.current = true;

    // Тот же ключ, что использовала старая главная, — кэш переживает обновление.
    const key = `traffic_refresh_ts_${subscription.id}`;
    const last = Number(safeLocal.getItem(key) ?? 0);
    if (Date.now() - last < API.TRAFFIC_CACHE_MS) return;

    subscriptionApi
      .refreshTraffic(subscription.id)
      .then(() => {
        safeLocal.setItem(key, Date.now().toString());
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
      })
      .catch(() => {
        // 429 и сетевые ошибки некритичны: покажем последние известные цифры.
      });
  }, [subscription, queryClient]);
}
