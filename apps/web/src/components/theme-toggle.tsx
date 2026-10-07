'use client';

import { useEffect, useState } from 'react';
import {
  readStoredTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from '@/lib/theme';

const NEXT: Record<ThemePreference, ThemePreference> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};
const LABEL: Record<ThemePreference, string> = {
  system: 'Sistema',
  light: 'Claro',
  dark: 'Escuro',
};

function apply(pref: ThemePreference) {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = resolveTheme(pref, dark);
}

export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePreference>('system');

  useEffect(() => {
    setPref(readStoredTheme(window.localStorage));
  }, []);

  useEffect(() => {
    if (pref !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [pref]);

  function cycle() {
    const next = NEXT[pref];
    setPref(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage bloqueado: o tema vale só nesta página.
    }
    apply(next);
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Tema: ${LABEL[pref]}. Trocar tema`}
      className="inline-flex h-9 items-center gap-2 rounded-[6px] px-2.5 text-[13px] text-ink-soft hover:bg-ink/5 hover:text-ink"
    >
      <ThemeIcon pref={pref} />
      <span className="hidden sm:inline">{LABEL[pref]}</span>
    </button>
  );
}

function ThemeIcon({ pref }: { pref: ThemePreference }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="8" cy="8" r="6" />
      {pref === 'light' && <circle cx="8" cy="8" r="2.5" fill="currentColor" />}
      {pref === 'dark' && <path d="M8 2a6 6 0 0 0 0 12z" fill="currentColor" />}
      {pref === 'system' && <path d="M8 2v12" />}
    </svg>
  );
}
