// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/hooks/useBranding', () => ({ useBranding: () => ({ appName: 'VPN' }) }));
vi.mock('@/components/ui/ResponsiveSheet', () => ({
  ResponsiveSheet: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
    isOpen ? <div>{children}</div> : null,
}));

import { WelcomeSheet } from './WelcomeSheet';

afterEach(cleanup);

describe('WelcomeSheet', () => {
  it('упоминает бесплатный период, когда он доступен', () => {
    render(<WelcomeSheet open onClose={() => {}} freeTrial />);
    expect(screen.getByText('welcome.step1.desc')).toBeTruthy();
  });

  it('не обещает бесплатный период, когда его нет', () => {
    render(<WelcomeSheet open onClose={() => {}} freeTrial={false} />);
    expect(screen.queryByText('welcome.step1.desc')).toBeNull();
    expect(screen.getByText('welcome.step2.desc')).toBeTruthy();
  });
});
