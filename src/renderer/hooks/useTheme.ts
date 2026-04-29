import { useEffect } from 'react';
import type { ThemeMode } from '../../types';

export function useTheme(theme: ThemeMode) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark');

    if (theme === 'light') {
      root.classList.add('theme-light');
    } else if (theme === 'dark') {
      root.classList.add('theme-dark');
    }
  }, [theme]);
}
