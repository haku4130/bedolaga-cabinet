import { useTranslation } from 'react-i18next';
import { CHECKOUT_STATUS_PATH, type PendingCheckout } from '@/utils/checkout';
import { SetupSteps } from './SetupSteps';
import { PrimaryLink } from './heroActions';
import { useHomeFormat } from './useHomeFormat';

interface CheckoutReadyHeroProps {
  pending: PendingCheckout;
  onDismiss: () => void;
}

/** Деньги за подписку пришли, а подписка — нет: говорим прямо и даём оформить. */
export function CheckoutReadyHero({ pending, onDismiss }: CheckoutReadyHeroProps) {
  const { t } = useTranslation();
  const format = useHomeFormat();

  return (
    <section
      className="bento-card space-y-5 border border-accent-400/25"
      data-testid="home-hero-checkout_ready"
    >
      <SetupSteps current={2} />
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-dark-50">{t('checkout.ready.title')}</h2>
        <p className="text-[15px] leading-relaxed text-dark-300">
          {t('checkout.ready.desc', {
            label: pending.label,
            price: format.price(pending.priceKopeks),
          })}
        </p>
      </div>
      <div className="space-y-1.5">
        <PrimaryLink to={CHECKOUT_STATUS_PATH}>{t('checkout.ready.cta')}</PrimaryLink>
        <button
          type="button"
          onClick={onDismiss}
          className="flex min-h-[44px] w-full items-center justify-center text-[15px] font-medium text-dark-400 hover:text-dark-200"
        >
          {t('checkout.ready.dismiss')}
        </button>
      </div>
    </section>
  );
}
