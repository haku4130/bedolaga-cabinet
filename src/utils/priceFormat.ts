/**
 * Сумма для показа: копейки пишем, только когда они есть — «109 ₽», но «193.33 ₽».
 */
export function fixedMoney(amount: number, decimals = 2): string {
  const fixed = amount.toFixed(decimals);
  return decimals > 0 && Number.isInteger(Number(fixed)) ? Number(fixed).toFixed(0) : fixed;
}

/** То же для готовых подписей цен от бота («109.00 ₽» → «109 ₽»). */
export function tidyPriceLabel<T extends string | undefined>(label: T): T {
  return (label === undefined ? label : label.replace(/(\d)[.,]00(?!\d)/g, '$1')) as T;
}
