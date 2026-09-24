import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TrialInfo } from '@/types';
import { SetupSteps } from './SetupSteps';
import { PrimaryButton, PrimaryLink, SecondaryLink } from './heroActions';
import { useHomeFormat } from './useHomeFormat';

interface NewUserHeroProps {
  state: 'new' | 'new_trial' | 'new_paid_trial';
  trial: TrialInfo | undefined;
  balanceKopeks: number;
  minPlanPriceKopeks: number | null;
  onActivateTrial: () => void;
  isActivatingTrial: boolean;
  trialError: string | null;
}

function topUpLink(missingKopeks: number): string {
  const params = new URLSearchParams({
    amount: String(Math.ceil(missingKopeks / 100)),
    returnTo: '/',
  });
  return `/balance/top-up?${params.toString()}`;
}

export function NewUserHero({
  state,
  trial,
  balanceKopeks,
  minPlanPriceKopeks,
  onActivateTrial,
  isActivatingTrial,
  trialError,
}: NewUserHeroProps) {
  const { t } = useTranslation();
  const format = useHomeFormat();

  const planLabel = minPlanPriceKopeks
    ? t('home.cta.choosePlanFrom', { price: format.price(minPlanPriceKopeks) })
    : t('home.cta.choosePlan');

  let title = t('home.new.title');
  let description = t('home.new.desc');
  let primary: ReactNode = <PrimaryLink to="/subscription/purchase">{planLabel}</PrimaryLink>;
  let secondary: ReactNode = null;

  if (trial && (state === 'new_trial' || state === 'new_paid_trial')) {
    description = t('home.trial.terms', {
      days: trial.duration_days,
      traffic:
        trial.traffic_limit_gb === 0
          ? t('home.unlimited')
          : `${trial.traffic_limit_gb} ${t('common.units.gb')}`,
      devices: trial.device_limit === 0 ? '∞' : trial.device_limit,
    });
    const loadingLabel = t('common.loading');

    if (state === 'new_trial') {
      title = t('home.trial.title');
      primary = (
        <PrimaryButton onClick={onActivateTrial} disabled={isActivatingTrial}>
          {isActivatingTrial ? loadingLabel : t('home.cta.tryFree')}
        </PrimaryButton>
      );
      secondary = <SecondaryLink to="/subscription/purchase">{planLabel}</SecondaryLink>;
    } else {
      title = t('home.trial.titlePaid');
      const label = t('home.cta.tryPaid', { price: format.price(trial.price_kopeks) });
      const missing = trial.price_kopeks - balanceKopeks;
      // Этап 2 уберёт пополнение из этого пути; пока — прежнее поведение.
      primary =
        missing > 0 ? (
          <PrimaryLink to={topUpLink(missing)}>{label}</PrimaryLink>
        ) : (
          <PrimaryButton onClick={onActivateTrial} disabled={isActivatingTrial}>
            {isActivatingTrial ? loadingLabel : label}
          </PrimaryButton>
        );
      secondary = (
        <SecondaryLink to="/subscription/purchase">{t('home.cta.choosePlan')}</SecondaryLink>
      );
    }
  }

  return (
    <section
      className="bento-card space-y-5 border border-accent-400/25"
      data-testid={`home-hero-${state}`}
    >
      <SetupSteps current={1} />
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-dark-50">{title}</h2>
        <p className="text-[15px] leading-relaxed text-dark-300">{description}</p>
      </div>
      <div className="space-y-2.5">
        {primary}
        {secondary}
      </div>
      {trialError && <p className="text-sm text-error-400">{trialError}</p>}
    </section>
  );
}
