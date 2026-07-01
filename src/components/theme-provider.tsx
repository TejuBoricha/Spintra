"use client";

import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes";

type Theme = "dark" | "light";

const STORAGE_KEY = "spintra-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey={STORAGE_KEY}>
      {children}
    </NextThemesProvider>
  );
}

export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void } {
  const { theme, setTheme } = useNextTheme();
  return {
    theme: theme === "light" ? "light" : "dark",
    setTheme: (next: Theme) => setTheme(next),
  };
}
