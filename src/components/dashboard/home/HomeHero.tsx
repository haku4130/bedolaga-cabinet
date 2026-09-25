import type { Subscription, TrialInfo } from '@/types';
import type { HeroState } from '@/utils/homeState';
import { ActiveHero } from './ActiveHero';
import { NewUserHero } from './NewUserHero';
import { ProblemHero } from './ProblemHero';

export interface HomeHeroProps {
  state: HeroState;
  subscription: Subscription | null;
  trial: TrialInfo | undefined;
  connectedDevices: number | undefined;
  balanceKopeks: number;
  minPlanPriceKopeks: number | null;
  onActivateTrial: () => void;
  isActivatingTrial: boolean;
  trialError: string | null;
}

/** Главная карточка: одна на экране, одно главное действие в ней. */
export function HomeHero(props: HomeHeroProps) {
  const { state, subscription } = props;

  switch (state) {
    case 'new':
    case 'new_trial':
    case 'new_paid_trial':
      return (
        <NewUserHero
          state={state}
          trial={props.trial}
          balanceKopeks={props.balanceKopeks}
          minPlanPriceKopeks={props.minPlanPriceKopeks}
          onActivateTrial={props.onActivateTrial}
          isActivatingTrial={props.isActivatingTrial}
          trialError={props.trialError}
        />
      );
    case 'expired':
    case 'expired_trial':
    case 'disabled':
    case 'traffic_exhausted':
      return subscription ? (
        <ProblemHero
          state={state}
          subscription={subscription}
          minPlanPriceKopeks={props.minPlanPriceKopeks}
        />
      ) : null;
    case 'active':
    case 'active_no_devices':
    case 'expiring':
      return subscription ? (
        <ActiveHero
          state={state}
          subscription={subscription}
          connectedDevices={props.connectedDevices}
        />
      ) : null;
  }
}
