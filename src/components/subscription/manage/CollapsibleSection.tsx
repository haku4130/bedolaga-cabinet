import { type ReactNode, useState } from 'react';
import { ChevronDownIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

/** Редкое и техническое — свёрнуто, чтобы не мешать, но под рукой. */
export function CollapsibleSection({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="overflow-hidden rounded-3xl border border-dark-800/70 bg-dark-900/60">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-[52px] w-full items-center justify-between px-5 text-left text-[15px] font-semibold text-dark-100"
      >
        {title}
        <ChevronDownIcon
          className={cn('h-4 w-4 text-dark-400 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && <div className="space-y-5 px-5 pb-5">{children}</div>}
    </section>
  );
}
