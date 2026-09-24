import type { ReactNode } from 'react';

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="px-1 text-[13px] font-semibold text-dark-400">{children}</h2>;
}
