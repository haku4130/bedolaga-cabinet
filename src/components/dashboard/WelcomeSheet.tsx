import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { ResponsiveSheet } from '@/components/ui/ResponsiveSheet';
import { DevicesIcon, ShieldIcon, WalletIcon } from '@/components/icons';
import { useBranding } from '@/hooks/useBranding';

const STEPS: { key: 'step1' | 'step2' | 'step3'; icon: ComponentType<{ className?: string }> }[] = [
  { key: 'step1', icon: ShieldIcon },
  { key: 'step2', icon: WalletIcon },
  { key: 'step3', icon: DevicesIcon },
];

interface WelcomeSheetProps {
  open: boolean;
  onClose: () => void;
  /** Бесплатный пробный период доступен — тогда первый шаг упоминает его. */
  freeTrial: boolean;
}

/** Первое знакомство: три шага до работающего VPN вместо тура по плиткам. */
export function WelcomeSheet({ open, onClose, freeTrial }: WelcomeSheetProps) {
  const { t } = useTranslation();
  const { appName } = useBranding();

  return (
    <ResponsiveSheet isOpen={open} onClose={onClose} title={t('welcome.title', { name: appName })}>
      <div className="space-y-5 px-6 pb-6 pt-4 sm:px-5 sm:pt-0">
        <p className="text-[15px] text-dark-300">{t('welcome.subtitle')}</p>
        <ol className="space-y-3.5">
          {STEPS.map(({ key, icon: Icon }) => (
            <li key={key} className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-500/15 text-accent-300">
                <Icon className="h-5 w-5" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold text-dark-50">
                  {t(`welcome.${key}.title`)}
                </span>
                {(key !== 'step1' || freeTrial) && (
                  <span className="text-sm text-dark-400">{t(`welcome.${key}.desc`)}</span>
                )}
              </span>
            </li>
          ))}
        </ol>
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={onClose}
            className="btn-primary flex w-full items-center justify-center py-3.5 text-base font-semibold"
          >
            {t('welcome.start')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] w-full items-center justify-center text-[15px] font-medium text-dark-400 hover:text-dark-200"
          >
            {t('welcome.skip')}
          </button>
        </div>
      </div>
    </ResponsiveSheet>
  );
}
