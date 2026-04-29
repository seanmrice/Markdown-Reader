import { useEffect, useState } from 'react';
import type { ThemeMode } from '../../types';

export type ResolvedTheme = 'light' | 'dark';

export function useTheme(theme: ThemeMode): ResolvedTheme {
  const [resolved, setResolved] = useState<ResolvedTheme>(() => {
    if (theme === 'light') return 'light';
    if (theme === 'dark') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark');

    if (theme === 'light') {
      root.classList.add('theme-light');
      setResolved('light');
      return;
    }
    if (theme === 'dark') {
      root.classList.add('theme-dark');
      setResolved('dark');
      return;
    }

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = (e: MediaQueryListEvent | MediaQueryList) => {
      setResolved(e.matches ? 'dark' : 'light');
    };
    update(mq);
    mq.addEventListener('change', update as (e: MediaQueryListEvent) => void);
    return () => mq.removeEventListener('change', update as (e: MediaQueryListEvent) => void);
  }, [theme]);

  return resolved;
}
