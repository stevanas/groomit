import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { storage } from "@/src/utils/storage";
import { lightColors, darkColors, ThemeColors } from "@/src/theme";

const KEY = "theme_mode";
export type ThemeMode = "light" | "dark";

type ThemeCtx = {
  mode: ThemeMode;
  colors: ThemeColors;
  ready: boolean;
  chosen: boolean; // whether the user has explicitly picked a theme
  setMode: (m: ThemeMode) => Promise<void>;
};

const Context = createContext<ThemeCtx>({
  mode: "light",
  colors: lightColors,
  ready: false,
  chosen: false,
  setMode: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [ready, setReady] = useState(false);
  const [chosen, setChosen] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await storage.getItem<string>(KEY, "");
      if (stored === "light" || stored === "dark") {
        setModeState(stored);
        setChosen(true);
      }
      setReady(true);
    })();
  }, []);

  const setMode = useCallback(async (m: ThemeMode) => {
    setModeState(m);
    setChosen(true);
    await storage.setItem(KEY, m);
  }, []);

  const colors = mode === "dark" ? darkColors : lightColors;

  const value = useMemo(() => ({ mode, colors, ready, chosen, setMode }), [mode, colors, ready, chosen, setMode]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useTheme = () => useContext(Context);

export function useThemedStyles<T>(factory: (c: ThemeColors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors]);
}
