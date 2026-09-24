import { Link, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  brandingApi,
  getCachedBranding,
  setCachedBranding,
  preloadLogo,
  isLogoPreloaded,
} from '@/api/branding';
import { cn } from '@/lib/utils';
import TicketNotificationBell from '@/components/TicketNotificationBell';
import type { TelegramPlatform } from '@/hooks/useTelegramSDK';

const FALLBACK_NAME = import.meta.env.VITE_APP_NAME || 'Cabinet';
const FALLBACK_LOGO = import.meta.env.VITE_APP_LOGO || 'V';

interface AppHeaderProps {
  isFullscreen: boolean;
  safeAreaInset: { top: number; bottom: number; left: number; right: number };
  contentSafeAreaInset: { top: number; bottom: number; left: number; right: number };
  telegramPlatform?: TelegramPlatform;
}

/**
 * Мобильная шапка: логотип и уведомления. Всё остальное (тема, язык, профиль,
 * админка, выход) живёт в разделе «Ещё» — бургер-меню больше нет.
 */
export function AppHeader({
  isFullscreen,
  safeAreaInset,
  contentSafeAreaInset,
  telegramPlatform,
}: AppHeaderProps) {
  const location = useLocation();
  const [logoLoaded, setLogoLoaded] = useState(() => isLogoPreloaded());

  const { data: branding } = useQuery({
    queryKey: ['branding'],
    queryFn: async () => {
      const data = await brandingApi.getBranding();
      setCachedBranding(data);
      await preloadLogo(data);
      return data;
    },
    initialData: getCachedBranding() ?? undefined,
    initialDataUpdatedAt: 0,
    staleTime: 60000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const appName = branding ? branding.name : FALLBACK_NAME;
  const logoLetter = branding?.logo_letter || FALLBACK_LOGO;
  const hasCustomLogo = branding?.has_custom_logo || false;
  const logoUrl = branding ? brandingApi.getLogoUrl(branding) : null;

  return (
    // В standalone-режиме iOS шапка продолжается под статус-бар через padding-top;
    // тон задаёт .app-mobile-header в globals.css (display-mode: standalone).
    <header
      className="glass app-mobile-header fixed left-0 right-0 top-0 z-50 shadow-lg shadow-black/10 lg:hidden"
      style={{
        paddingTop: isFullscreen
          ? `${Math.max(safeAreaInset.top, contentSafeAreaInset.top) + (telegramPlatform === 'android' ? 48 : 45)}px`
          : 'env(safe-area-inset-top, 0px)',
      }}
    >
      <div className="mx-auto w-full pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]">
        <div className="flex h-16 items-center justify-between">
          <Link
            to="/"
            className={cn('flex flex-shrink-0 items-center gap-2.5', !appName && 'mr-4')}
          >
            <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-linear-lg border border-dark-700/50 bg-dark-800/80 shadow-md">
              <span
                className={cn(
                  'absolute text-lg font-bold text-accent-400 transition-opacity duration-200',
                  hasCustomLogo && logoLoaded ? 'opacity-0' : 'opacity-100',
                )}
              >
                {logoLetter}
              </span>
              {hasCustomLogo && logoUrl && (
                <img
                  src={logoUrl}
                  alt={appName || 'Logo'}
                  className={cn(
                    'absolute h-full w-full object-contain transition-opacity duration-200',
                    logoLoaded ? 'opacity-100' : 'opacity-0',
                  )}
                  onLoad={() => setLogoLoaded(true)}
                />
              )}
            </div>
            {appName && (
              <span className="whitespace-nowrap text-base font-semibold text-dark-100">
                {appName}
              </span>
            )}
          </Link>

          <TicketNotificationBell isAdmin={location.pathname.startsWith('/admin')} />
        </div>
      </div>
    </header>
  );
}
