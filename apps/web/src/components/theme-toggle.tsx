'use client';

import { useEffect, useState } from 'react';
import {
  nextTheme,
  readStoredTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from '@/lib/theme';

const LABEL: Record<ThemePreference, string> = {
  system: 'Sistema',
  light: 'Claro',
  dark: 'Escuro',
};

const systemPrefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

function apply(pref: ThemePreference) {
  document.documentElement.dataset.theme = resolveTheme(pref, systemPrefersDark());
}

export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePreference>('system');
  // O rótulo só aparece depois de ler a preferência salva, para não piscar "Sistema".
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPref(readStoredTheme(() => window.localStorage));
    setReady(true);

    // Outra aba trocou o tema: acompanha.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const next = readStoredTheme(() => window.localStorage);
      setPref(next);
      apply(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (pref !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [pref]);

  function cycle() {
    const next = nextTheme(pref, systemPrefersDark());
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
      <span className={`hidden sm:inline ${ready ? '' : 'invisible'}`}>{LABEL[pref]}</span>
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
