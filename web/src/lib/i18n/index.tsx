import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { en } from "./locales/en";
import { zh } from "./locales/zh";

export type Locale = "en" | "zh";

export const LOCALES: { code: Locale; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "zh", label: "Chinese", native: "中文" },
];

const MESSAGES: Record<Locale, Record<string, string>> = { en, zh };

const STORAGE_KEY = "memegineer-lang";

function detect(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved && saved in MESSAGES) return saved;
  } catch {}
  const nav = navigator.language.slice(0, 2);
  return nav === "zh" ? "zh" : "en";
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(msg: string, params?: Record<string, string | number>): string {
  if (!params) return msg;
  return msg.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detect);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    _currentLocale = l;
    _listeners.forEach((fn) => fn(l));
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
    document.documentElement.lang = l;
  }, []);

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const dict = MESSAGES[locale] ?? MESSAGES.en;
      const msg = dict[key] ?? MESSAGES.en[key] ?? key;
      return interpolate(msg, params);
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function useT() {
  return useI18n().t;
}

// Global translation for non-React modules (pipeline.ts etc.)
let _currentLocale: Locale = detect();
const _listeners = new Set<(l: Locale) => void>();

export function getT() {
  return (key: string, params?: Record<string, string | number>) => {
    const dict = MESSAGES[_currentLocale] ?? MESSAGES.en;
    const msg = dict[key] ?? MESSAGES.en[key] ?? key;
    return interpolate(msg, params);
  };
}

export function onLocaleChange(fn: (l: Locale) => void) {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}
