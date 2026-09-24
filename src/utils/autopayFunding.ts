export type AutopayFunding =
  | { state: 'unknown' }
  | { state: 'ok' }
  | { state: 'short'; missingKopeks: number };

/**
 * Хватит ли баланса на автопродление. Точную цену автоплатежа бот выбирает сам,
 * поэтому сравниваем с самой дешёвой ценой продления: нехватка — наверняка,
 * «достаточно» — лишь «не меньше минимума».
 */
export function autopayFunding(
  balanceKopeks: number | undefined,
  minRenewalKopeks: number | null,
): AutopayFunding {
  if (minRenewalKopeks === null || balanceKopeks === undefined) return { state: 'unknown' };
  if (balanceKopeks < minRenewalKopeks) {
    return { state: 'short', missingKopeks: minRenewalKopeks - balanceKopeks };
  }
  return { state: 'ok' };
}

export function minRenewalPriceKopeks(
  options: { price_kopeks: number }[] | undefined,
): number | null {
  const prices = (options ?? []).map((option) => option.price_kopeks).filter((price) => price > 0);
  return prices.length > 0 ? Math.min(...prices) : null;
}
