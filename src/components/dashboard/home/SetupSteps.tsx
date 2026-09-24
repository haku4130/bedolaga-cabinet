import { useTranslation } from 'react-i18next';
import { CheckIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

const STEPS = ['plan', 'payment', 'connect'] as const;

interface SetupStepsProps {
  /** Текущий шаг 1–3; шаги до него отмечены пройденными. */
  current: 1 | 2 | 3;
}

/** «Тариф → Оплата → Подключение»: новичок видит, где он и что дальше. */
export function SetupSteps({ current }: SetupStepsProps) {
  const { t } = useTranslation();

  return (
    <ol className="flex items-center gap-2" aria-label={t('home.steps.label')}>
      {STEPS.map((step, index) => {
        const number = index + 1;
        const done = number < current;
        const active = number === current;
        return (
          <li
            key={step}
            className="flex min-w-0 flex-1 items-center gap-2 last:flex-none"
            aria-current={active ? 'step' : undefined}
          >
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                done && 'bg-success-500/15 text-success-400',
                active && 'bg-accent-400 text-on-accent',
                !done && !active && 'border border-dark-600 text-dark-400',
              )}
            >
              {done ? <CheckIcon className="h-3.5 w-3.5" /> : number}
            </span>
            <span
              className={cn(
                'truncate text-[13px] font-semibold',
                active ? 'text-dark-50' : 'text-dark-400',
              )}
            >
              {t(`home.steps.${step}`)}
            </span>
            {number < STEPS.length && (
              <span aria-hidden="true" className="h-0.5 min-w-3 flex-1 rounded bg-dark-700" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
