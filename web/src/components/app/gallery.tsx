import { ArrowRight } from "lucide-react";
import { FilmCard } from "@/components/app/film-card";
import { Link } from "@/lib/router";
import { useT } from "@/lib/i18n";
import type { Film } from "@/lib/api";

export function Gallery({ films }: { films: Film[] }) {
  const t = useT();
  const latest = films.slice(0, 6);

  return (
    <section id="films" className="scroll-mt-24">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{t("gallery.library")}</p>
          <h2 className="mt-1 text-3xl font-medium tracking-tight">{t("gallery.latest")}</h2>
        </div>
        <Link to="/films" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          {t("gallery.allFilms", { n: films.length })} <ArrowRight className="size-4" />
        </Link>
      </div>

      {latest.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border-strong p-8 text-center text-sm text-muted-foreground">{t("gallery.noFilms")}</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {latest.map((f) => (
            <FilmCard key={f.id} film={f} />
          ))}
        </div>
      )}
    </section>
  );
}
