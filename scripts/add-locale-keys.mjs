#!/usr/bin/env node
/**
 * Глубоко сливает JSON-фрагмент в локали src/locales/<lang>.json.
 * Фрагмент: { "ru": {...}, "en": {...}, "zh": {...}, "fa": {...} }.
 * Формат файлов сохраняется байт-в-байт: JSON.stringify(_, null, 2) + "\n".
 *
 * Использование: node scripts/add-locale-keys.mjs <fragment.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';

const fragmentPath = process.argv[2];
if (!fragmentPath) {
  console.error('usage: node scripts/add-locale-keys.mjs <fragment.json>');
  process.exit(1);
}

function merge(target, source, path) {
  for (const [key, value] of Object.entries(source)) {
    const at = path ? `${path}.${key}` : key;
    if (value !== null && typeof value === 'object') {
      if (target[key] !== undefined && typeof target[key] !== 'object') {
        throw new Error(`${at}: в локали строка, во фрагменте объект`);
      }
      target[key] ??= {};
      merge(target[key], value, at);
    } else {
      target[key] = value;
    }
  }
}

const fragment = JSON.parse(readFileSync(fragmentPath, 'utf8'));
for (const [lang, tree] of Object.entries(fragment)) {
  const file = new URL(`../src/locales/${lang}.json`, import.meta.url);
  const locale = JSON.parse(readFileSync(file, 'utf8'));
  merge(locale, tree, '');
  writeFileSync(file, `${JSON.stringify(locale, null, 2)}\n`);
  console.log(`${lang}: ok`);
}
