import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { en } from "./locales/en";
import { zh } from "./locales/zh";
import { ja } from "./locales/ja";
import { es } from "./locales/es";

export type Locale = "en" | "zh" | "ja" | "es";
export type LocaleChoice = Locale | "auto";

export const AUTO = "auto";

export const LOCALES: { code: Locale; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "zh", label: "Chinese", native: "中文" },
  { code: "ja", label: "Japanese", native: "日本語" },
  { code: "es", label: "Spanish", native: "Español" },
];

const MESSAGES: Record<Locale, Record<string, string>> = { en, zh, ja, es };

const STORAGE_KEY = "memegineer-lang";

function browserLocale(): Locale {
  for (const lang of navigator.languages ?? [navigator.language]) {
    const code = lang.slice(0, 2);
    if (code in MESSAGES) return code as Locale;
  }
  return "en";
}

function readChoice(): LocaleChoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as LocaleChoice | null;
    if (saved && (saved === AUTO || saved in MESSAGES)) return saved;
  } catch {}
  return AUTO;
}

const resolve = (l: LocaleChoice): Locale => (l === AUTO ? browserLocale() : l);

type I18nContextValue = {
  locale: Locale;
  choice: LocaleChoice;
  setLocale: (l: LocaleChoice) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(msg: string, params?: Record<string, string | number>): string {
  if (!params) return msg;
  return msg.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<LocaleChoice>(() => {
    const l = readChoice();
    const resolved = resolve(l);
    document.documentElement.lang = resolved;
    _choice = l;
    _currentLocale = resolved;
    return l;
  });
  const locale = useMemo<Locale>(() => resolve(choice), [choice]);

  const setLocale = useCallback((l: LocaleChoice) => {
    setChoiceState(l);
    _choice = l;
    const resolved = resolve(l);
    _currentLocale = resolved;
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
    document.documentElement.lang = resolved;
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

  const value = useMemo(() => ({ locale, choice, setLocale, t }), [locale, choice, setLocale, t]);

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
let _choice: LocaleChoice = readChoice();
let _currentLocale: Locale = resolve(_choice);

export function getT() {
  return (key: string, params?: Record<string, string | number>) => {
    const dict = MESSAGES[_currentLocale] ?? MESSAGES.en;
    const msg = dict[key] ?? MESSAGES.en[key] ?? key;
    return interpolate(msg, params);
  };
}