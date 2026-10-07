export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'finlens-theme';

/**
 * Lê a preferência salva; valor inválido, ausente ou storage bloqueado viram `system`.
 * Recebe uma função porque, com cookies bloqueados, até ler `window.localStorage` lança.
 */
export function readStoredTheme(
  getStorage: () => Pick<Storage, 'getItem'> | undefined,
): ThemePreference {
  try {
    const value = getStorage()?.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(pref: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (pref === 'system') return systemPrefersDark ? 'dark' : 'light';
  return pref;
}

/** Roda antes da primeira pintura para não piscar o tema errado. Espelha readStoredTheme + resolveTheme. */
export const themeScript = `(function(){var p;try{p=localStorage.getItem('${THEME_STORAGE_KEY}')}catch(e){}if(p!=='light'&&p!=='dark'){p=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=p})()`;
