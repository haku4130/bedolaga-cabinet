// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { useSafeBack } from './useSafeBack';

function setup(entries: string[]) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      {children}
    </MemoryRouter>
  );
  return renderHook(() => ({ back: useSafeBack('/balance'), path: useLocation().pathname }), {
    wrapper,
  });
}

afterEach(() => window.history.replaceState(null, ''));

describe('useSafeBack', () => {
  it('без истории уводит на запасной адрес', () => {
    window.history.replaceState({ idx: 0 }, '');
    const { result } = setup(['/balance/top-up/sbp']);
    act(() => result.current.back());
    expect(result.current.path).toBe('/balance');
  });

  it('с историей возвращает на предыдущую страницу', () => {
    window.history.replaceState({ idx: 1 }, '');
    const { result } = setup(['/subscription/purchase', '/balance/top-up/sbp']);
    act(() => result.current.back());
    expect(result.current.path).toBe('/subscription/purchase');
  });
});
