import { KeyRound, X } from "lucide-react";
import { SharedLayoutBg } from "@/components/motion/shared-layout-bg";
import { ThemeToggle } from "@/components/motion/theme-toggle";
import { useI18n, useT, LOCALES } from "@/lib/i18n";
import { Link, usePath } from "@/lib/router";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", key: "nav.home" },
  { to: "/create", key: "nav.create" },
  { to: "/films", key: "nav.explore" },
];

type KeyProps = { hasKey?: boolean; onKey?: () => void; onDisconnect?: () => void };

function KeyButton({ hasKey, onKey, onDisconnect }: KeyProps) {
  const t = useT();
  if (!hasKey)
    return (
      <button type="button" onClick={onKey} className="ml-1 inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3.5 text-sm font-medium text-background transition-opacity hover:opacity-90 sm:ml-2">
        <KeyRound className="size-3.5" /> <span className="hidden sm:inline">{t("header.connectKey")}</span>
        <span className="sm:hidden">{t("header.key")}</span>
      </button>
    );
  return (
    <span className="ml-1 inline-flex h-10 shrink-0 items-center gap-1 rounded-full border border-border pr-1 pl-3 text-sm text-muted-foreground sm:ml-2">
      <span className="size-1.5 rounded-full bg-success" />
      <span className="hidden sm:inline">{t("header.falKey")}</span>
      <button type="button" onClick={onDisconnect} title={t("header.removeKey")} aria-label={t("header.removeKey")} className="grid size-8 place-items-center rounded-full hover:bg-muted hover:text-foreground">
        <X className="size-3.5" />
      </button>
    </span>
  );
}

function LangToggle() {
  const { locale, setLocale } = useI18n();
  const next = LOCALES[(LOCALES.findIndex((l) => l.code === locale) + 1) % LOCALES.length];
  return (
    <button
      type="button"
      onClick={() => setLocale(next.code)}
      title={next.native}
      className="ml-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:ml-2"
    >
      {locale === "en" ? "EN" : "中"}
    </button>
  );
}

export function Header({ hasKey, onKey, onDisconnect }: KeyProps) {
  const path = usePath();
  const t = useT();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:px-6">
        <Link to="/" aria-label={t("brand.name")} className="flex shrink-0 items-center gap-2.5">
          <img src="/logo.svg" alt="" className="size-9" />
          <span className="hidden text-[17px] font-semibold tracking-tight sm:inline">{t("brand.name")}</span>
        </Link>
        <nav className="flex items-center gap-1">
          <SharedLayoutBg className="w-auto flex-row items-center gap-1" pillClassName="rounded-full bg-muted" inset={0}>
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                aria-current={(n.to === "/" ? path === "/" : path.startsWith(n.to)) ? "page" : undefined}
                className={cn(
                  "relative rounded-full px-2 py-1.5 text-sm transition-colors sm:px-3.5",
                  (n.to === "/" ? path === "/" : path.startsWith(n.to)) ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(n.key)}
              </Link>
            ))}
          </SharedLayoutBg>
          <KeyButton hasKey={hasKey} onKey={onKey} onDisconnect={onDisconnect} />
          <LangToggle />
          <ThemeToggle
            variant="circle-blur"
            className="ml-1 size-10 shrink-0 rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground sm:ml-2"
            iconClassName="size-4"
          />
        </nav>
      </div>
    </header>
  );
}
