// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { LocalizedText } from '@/types';
import { CardsBlock } from './CardsBlock';
import { TimelineBlock } from './TimelineBlock';
import type { BlockRendererProps } from './types';

/**
 * Блоки инструкции из панели — это шаги. Человек должен видеть, что их
 * три и где он: «Шаг 1 из 3».
 */

afterEach(cleanup);

const text = (value: string): LocalizedText => ({ ru: value, en: value });

const props = (stepLabel?: BlockRendererProps['stepLabel']): BlockRendererProps => ({
  blocks: [
    { title: text('Установка приложения'), description: text('') },
    { title: text(''), description: text('') },
    { title: text('Добавление подписки'), description: text('') },
  ],
  isMobile: true,
  isLight: false,
  getLocalizedText: (value) => value?.ru ?? '',
  getSvgHtml: () => '',
  renderBlockButtons: () => null,
  stepLabel,
});

const label = (index: number, total: number) => `Шаг ${index + 1} из ${total}`;

describe.each([
  ['cards', CardsBlock],
  ['timeline', TimelineBlock],
])('%s', (_name, Renderer) => {
  it('нумерует только видимые блоки', () => {
    render(<Renderer {...props(label)} />);
    expect(screen.getByText('Шаг 1 из 2')).toBeTruthy();
    expect(screen.getByText('Шаг 2 из 2')).toBeTruthy();
  });

  it('без stepLabel — как раньше', () => {
    render(<Renderer {...props()} />);
    expect(screen.queryByText(/Шаг/)).toBeNull();
  });
});
