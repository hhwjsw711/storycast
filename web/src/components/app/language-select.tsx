import { Check, ChevronDown, Globe } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { EASE_OUT } from "@/lib/ease";
import { AUTO, LOCALES, useI18n, useT, type LocaleChoice } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const MENU_ITEM = '[role="menuitemradio"]';

export function LanguageSelect() {
  const { locale, choice, setLocale } = useI18n();
  const t = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion() ?? false;

  const items = () => [...(rootRef.current?.querySelectorAll<HTMLButtonElement>(MENU_ITEM) ?? [])];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const arr = items();
        if (!arr.length) return;
        const idx = arr.findIndex((b) => b === document.activeElement);
        const next = e.key === "ArrowDown" ? (idx + 1) % arr.length : (idx <= 0 ? arr.length : idx) - 1;
        arr[next].focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  // Open: focus the active entry (or the first one) so arrow keys start from context
  useEffect(() => {
    if (!open) return;
    const arr = items();
    (arr.find((b) => b.getAttribute("aria-checked") === "true") ?? arr[0])?.focus();
  }, [open]);

  const pick = (l: LocaleChoice) => {
    setLocale(l);
    setOpen(false);
    btnRef.current?.focus();
  };

  const currentNative = LOCALES.find((l) => l.code === locale)?.native ?? "English";
  const itemCls = (active: boolean) =>
    cn(
      "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-sm outline-none transition-colors",
      active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:bg-muted",
    );

  return (
    <div ref={rootRef} className="relative ml-1 sm:ml-2">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("lang.pick")}
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <Globe className="size-3.5" aria-hidden />
        <span>{currentNative}</span>
        <ChevronDown className={cn("size-3 transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="menu"
            aria-label={t("lang.pick")}
            initial={reduce ? false : { opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: EASE_OUT }}
            className="absolute right-0 top-full z-50 mt-2 min-w-44 overflow-hidden rounded-xl border border-border bg-background/85 p-1 shadow-lg shadow-black/10 backdrop-blur-xl"
          >
            <li role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={choice === AUTO}
                onClick={() => pick(AUTO)}
                className={itemCls(choice === AUTO)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{t("lang.auto")}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground/70">{currentNative}</span>
                </span>
                {choice === AUTO ? <Check className="size-3.5 shrink-0" aria-hidden /> : null}
              </button>
            </li>
            <li className="mx-2 my-1 h-px bg-border" aria-hidden />
            {LOCALES.map((l) => (
              <li key={l.code} role="none">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={choice === l.code}
                  onClick={() => pick(l.code)}
                  className={itemCls(choice === l.code)}
                >
                  <span className="truncate">{l.native}</span>
                  {choice === l.code ? <Check className="size-3.5 shrink-0" aria-hidden /> : null}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}