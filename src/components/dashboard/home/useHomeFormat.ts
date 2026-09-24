import { useTranslation } from 'react-i18next';
import { useCurrency } from '@/hooks/useCurrency';

/** Цена без «,00» для целых сумм и дата «29 мая 2027» на языке интерфейса. */
export function useHomeFormat() {
  const { i18n } = useTranslation();
  const { formatWithCurrency } = useCurrency();

  return {
    price: (kopeks: number) => {
      const rubles = kopeks / 100;
      return formatWithCurrency(rubles, Number.isInteger(rubles) ? 0 : 2);
    },
    date: (iso: string) =>
      new Date(iso).toLocaleDateString(i18n.language, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
  };
}
