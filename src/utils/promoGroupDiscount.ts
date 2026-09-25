interface DiscountedPeriod {
  price_kopeks: number;
  original_price_kopeks?: number | null;
}

interface DiscountedTariff {
  periods: DiscountedPeriod[];
  device_discount_percent?: number;
  daily_discount_percent?: number;
  custom_days_discount_percent?: number;
}

/**
 * Даёт ли группа пользователя хоть какую-то скидку. Имя группы бот присылает
 * всегда, даже для группы без скидок, — по одному имени плашку «скидки
 * применены» показывать нельзя.
 */
export function hasPromoGroupDiscount(tariffs: DiscountedTariff[]): boolean {
  return tariffs.some(
    (tariff) =>
      tariff.periods.some((period) => (period.original_price_kopeks ?? 0) > period.price_kopeks) ||
      (tariff.device_discount_percent ?? 0) > 0 ||
      (tariff.daily_discount_percent ?? 0) > 0 ||
      (tariff.custom_days_discount_percent ?? 0) > 0,
  );
}
