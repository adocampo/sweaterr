"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
    theme: Theme;
    resolvedTheme: "light" | "dark";
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "theme";

function getStoredTheme(): Theme {
    if (typeof window === "undefined") return "system";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

function resolveTheme(theme: Theme): "light" | "dark" {
    if (typeof window === "undefined") return theme === "dark" ? "dark" : "light";
    if (theme === "system") {
        return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return theme === "dark" ? "dark" : "light";
}

function applyTheme(theme: Theme) {
    if (typeof document === "undefined") return;
    const resolved = resolveTheme(theme);
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
    root.setAttribute("data-theme", resolved);
    root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>("system");
    const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

    useEffect(() => {
        const initial = getStoredTheme();
        setThemeState(initial);
        const resolved = resolveTheme(initial);
        setResolvedTheme(resolved);
        applyTheme(initial);
    }, []);

    useEffect(() => {
        if (theme !== "system") return;
        const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
        const handler = () => {
            const resolved = resolveTheme("system");
            setResolvedTheme(resolved);
            applyTheme("system");
        };
        mq?.addEventListener("change", handler);
        return () => mq?.removeEventListener("change", handler);
    }, [theme]);

    useEffect(() => {
        const resolved = resolveTheme(theme);
        setResolvedTheme(resolved);
        applyTheme(theme);
        if (theme === "system") {
            window.localStorage.removeItem(STORAGE_KEY);
        } else {
            window.localStorage.setItem(STORAGE_KEY, theme);
        }
    }, [theme]);

    const value = useMemo(() => ({
        theme,
        resolvedTheme,
        setTheme: (next: Theme) => setThemeState(next),
        toggleTheme: () => {
            setThemeState((prev) => {
                if (prev === "system") return "light";
                if (prev === "light") return "dark";
                return "system";
            });
        },
    }), [theme, resolvedTheme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
    return ctx;
}
