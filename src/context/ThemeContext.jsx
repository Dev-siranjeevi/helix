import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

const applyTheme = (theme) =>
  document.documentElement.setAttribute("data-theme", theme);

export function ThemeProvider({ children, initialTheme = "dark", onThemeChange }) {
  const [theme, setTheme] = useState(initialTheme);

  // Apply whenever theme changes
  useEffect(() => { applyTheme(theme); }, [theme]);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    onThemeChange?.(next);
  };

  const setExplicit = (t) => {
    setTheme(t);
    onThemeChange?.(t);
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === "dark", toggle, setTheme: setExplicit }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
};
