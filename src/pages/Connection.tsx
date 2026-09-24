import { useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { openLink as sdkOpenLink } from '@telegram-apps/sdk-react';
import { subscriptionApi } from '../api/subscription';
import { useTelegramSDK } from '../hooks/useTelegramSDK';
import { useHaptic } from '@/platform';
import { ChatIcon, ScanIcon } from '@/components/icons';
import { resolveTemplate, hasTemplates } from '../utils/templateEngine';
import { openAppScheme } from '../utils/openAppScheme';
import { isHappCryptolinkMode, resolveConnectionUrlForUi } from '../utils/connectionLink';
import { useAuthStore } from '../store/auth';
import type { AppConfig, RemnawavePlatformData } from '../types';
import InstallationGuide from '../components/connection/InstallationGuide';
import {
  ConnectionNoSubscription,
  ConnectionNotReady,
  ConnectionSubscriptionPicker,
} from '../components/connection/ConnectionStates';
import { DevicesPanel } from '../components/subscription/DevicesPanel';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';

function appHasApps(config: AppConfig): boolean {
  return Object.values(config.platforms ?? {}).some(
    (p: RemnawavePlatformData) => p.apps && p.apps.length > 0,
  );
}

export default function Connection() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const subIdParam = searchParams.get('sub') ? Number(searchParams.get('sub')) : undefined;
  const user = useAuthStore((state) => state.user);
  const isAdmin = useAuthStore((state) => state.isAdmin);
  const { isTelegramWebApp } = useTelegramSDK();
  const { impact: hapticImpact } = useHaptic();

  const hapticRef = useRef(hapticImpact);
  hapticRef.current = hapticImpact;

  const { data: subsList, isLoading: subsLoading } = useQuery({
    queryKey: ['subscriptions-list'],
    queryFn: () => subscriptionApi.getSubscriptions(),
    staleTime: 30_000,
  });
  const isMultiTariff = subsList?.multi_tariff_enabled ?? false;
  const subscriptions = subsList?.subscriptions ?? [];
  // Мультитариф: с одной подпиской выбирать нечего, с несколькими — спрашиваем.
  const subId =
    subIdParam ?? (isMultiTariff && subscriptions.length === 1 ? subscriptions[0].id : undefined);
  const needsPick = isMultiTariff && subIdParam === undefined && subscriptions.length > 1;

  const {
    data: appConfig,
    isLoading,
    error,
  } = useQuery<AppConfig>({
    queryKey: ['appConfig', subId],
    queryFn: () => subscriptionApi.getAppConfig(subId),
    enabled: !subsLoading && !needsPick,
    // Пока подключение не настроено — проверяем снова, а не просим «загляните позже».
    refetchInterval: (query) =>
      query.state.status === 'error' || (query.state.data && !appHasApps(query.state.data))
        ? 10_000
        : false,
  });
  const { data: connectionLink, isLoading: isConnectionLinkLoading } = useQuery({
    queryKey: ['connectionLink', subId],
    queryFn: () => subscriptionApi.getConnectionLink(subId),
    retry: false,
    staleTime: 0,
    enabled: !subsLoading && !needsPick,
  });
  const { data: trialInfo } = useQuery({
    queryKey: ['trial-info'],
    queryFn: () => subscriptionApi.getTrialInfo(),
    enabled: appConfig?.hasSubscription === false,
  });

  const qrConnectionUrl = useMemo(
    () =>
      resolveConnectionUrlForUi({
        mode: connectionLink?.connect_mode,
        happSchemeLink: connectionLink?.happ_scheme_link,
        displayLink: connectionLink?.display_link,
        subscriptionUrl: connectionLink?.subscription_url,
        happCryptLink: connectionLink?.happ_cryptolink,
        happCryptoLink: connectionLink?.happ_crypto_link,
        happLink: connectionLink?.happ_link,
        fallbackUrl: appConfig?.subscriptionUrl,
      }),
    [
      appConfig?.subscriptionUrl,
      connectionLink?.connect_mode,
      connectionLink?.display_link,
      connectionLink?.happ_cryptolink,
      connectionLink?.happ_crypto_link,
      connectionLink?.happ_link,
      connectionLink?.happ_scheme_link,
      connectionLink?.subscription_url,
    ],
  );

  const handleGoBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const handleOpenQR = useCallback(() => {
    if (!qrConnectionUrl) return;
    navigate('/connection/qr', {
      replace: !isTelegramWebApp,
      state: {
        url: qrConnectionUrl,
        hideLink: connectionLink?.hide_link ?? appConfig?.hideLink ?? false,
        subscriptionId: subId,
      },
    });
  }, [
    navigate,
    qrConnectionUrl,
    connectionLink?.hide_link,
    appConfig?.hideLink,
    isTelegramWebApp,
    subId,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleGoBack();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleGoBack]);

  const resolveUrl = useCallback(
    (url: string): string => {
      if (!hasTemplates(url) || !appConfig?.subscriptionUrl) return url;
      return resolveTemplate(url, {
        subscriptionUrl: appConfig.subscriptionUrl,
        username: user?.username ?? undefined,
      });
    },
    [appConfig?.subscriptionUrl, user?.username],
  );

  const openDeepLink = useCallback(
    (deepLink: string) => {
      let resolved = deepLink;
      if (hasTemplates(resolved)) {
        resolved = resolveUrl(resolved);
      }
      // In HAPP cryptolink mode keep hiding the plain subscription link: force the
      // happ://crypt... URL only when the button fell back to it or its template
      // could not be resolved. An explicit link from the panel's Subpage config
      // (e.g. happ://add/...) wins — admins expect Subpage edits to apply here.
      if (
        isHappCryptolinkMode(connectionLink?.connect_mode) &&
        qrConnectionUrl &&
        (!resolved || resolved === appConfig?.subscriptionUrl || hasTemplates(resolved))
      ) {
        resolved = qrConnectionUrl;
      }
      const isHttpUrl = /^https?:\/\//i.test(resolved);
      const finalUrlForTelegram = isHttpUrl
        ? resolved
        : `${window.location.origin}/miniapp/redirect.html?url=${encodeURIComponent(resolved)}&lang=${i18n.language || 'en'}`;

      if (isTelegramWebApp) {
        try {
          sdkOpenLink(finalUrlForTelegram, { tryInstantView: false });
          return;
        } catch {
          // SDK not available, fallback
        }
      }

      // In regular browsers open the deeplink directly. openAppScheme uses a contained
      // iframe for custom schemes so an unresolved scheme doesn't paint a full-page
      // net::ERR_UNKNOWN_URL_SCHEME (Android) / silently fail (iOS); http(s) links
      // still navigate normally. (Telegram bug #654272.)
      openAppScheme(resolved);
    },
    [
      isTelegramWebApp,
      i18n.language,
      resolveUrl,
      connectionLink?.connect_mode,
      qrConnectionUrl,
      appConfig?.subscriptionUrl,
    ],
  );

  // Check if any platform has configured apps
  const hasApps = useMemo(() => (appConfig ? appHasApps(appConfig) : false), [appConfig]);

  if (needsPick) {
    return <ConnectionSubscriptionPicker subscriptions={subscriptions} />;
  }

  if (subsLoading || isLoading || isConnectionLinkLoading) {
    return (
      <SkeletonGroup className="space-y-6 pb-6">
        {/* Повторяет шапку InstallationGuide: кнопка «назад», заголовок, выбор платформы. */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
          <Skeleton className="h-6 flex-1" />
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
        </div>
        <Skeleton variant="card" count={3} className="h-24" />
      </SkeletonGroup>
    );
  }

  if (error || !appConfig || !hasApps) {
    return <ConnectionNotReady isAdmin={isAdmin} />;
  }

  // No subscription
  if (!appConfig.hasSubscription) {
    return <ConnectionNoSubscription trialAvailable={trialInfo?.is_available === true} />;
  }

  return (
    <div className="space-y-6">
      <InstallationGuide
        appConfig={appConfig}
        onOpenDeepLink={openDeepLink}
        isTelegramWebApp={isTelegramWebApp}
        // «Назад» — только если пришли по ссылке (с главной, после оплаты);
        // вкладка «Устройства» — раздел меню, возвращаться с неё некуда.
        onGoBack={subIdParam !== undefined ? handleGoBack : undefined}
        onOpenQR={handleOpenQR}
        username={user?.username ?? undefined}
      />
      <div className="space-y-1">
        {qrConnectionUrl && (
          <button
            type="button"
            onClick={handleOpenQR}
            className="flex min-h-[44px] w-full items-center gap-2.5 text-left text-[15px] font-medium text-accent-400 hover:text-accent-300"
          >
            <ScanIcon className="h-[18px] w-[18px]" />
            {t('connect.qrLink')}
          </button>
        )}
        <Link
          to="/support"
          className="flex min-h-[44px] items-center gap-2.5 text-[15px] font-medium text-accent-400 hover:text-accent-300"
        >
          <ChatIcon className="h-[18px] w-[18px]" />
          {t('connect.help')}
        </Link>
      </div>
      <DevicesPanel subscriptionId={subId} />
    </div>
  );
}
