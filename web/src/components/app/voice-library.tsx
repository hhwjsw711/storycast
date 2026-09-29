import { AnimatePresence, motion } from "motion/react";
import { AudioLines, Check, Heart, Loader2, Mic, Pause, Play, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/motion/button/base";
import { Drawer } from "@/components/motion/drawer";
import { Input } from "@/components/motion/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/motion/select";
import { Switch } from "@/components/motion/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { TextShimmer } from "@/components/motion/text-shimmer";
import { EASE_OUT, SPRING_LAYOUT } from "@/lib/ease";
import { usePlayer } from "@/lib/use-player";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { api, type Voice, type VoiceFacets, type VoiceQuery } from "@/lib/api";

const EMPTY: VoiceQuery = { search: "", gender: "", age: "", accent: "", category: "", language: "", sort: "popular", curated: false, tags: [] };

const PRESET_KEYS: { id: string; key: string; q: Partial<VoiceQuery> }[] = [
  { id: "story", key: "voice.presetStoryteller", q: { tags: ["storyteller"] } },
  { id: "kids", key: "voice.presetKids", q: { tags: ["cartoon"] } },
  { id: "doc", key: "voice.presetDocumentary", q: { tags: ["documentary-narrator"] } },
  { id: "grandma", key: "voice.presetGrandma", q: { tags: ["grandma"] } },
  { id: "grandpa", key: "voice.presetGrandpa", q: { tags: ["grandpa"] } },
  { id: "calm", key: "voice.presetCalm", q: { tags: ["calm"] } },
  { id: "warm", key: "voice.presetWarm", q: { tags: ["warm"] } },
  { id: "teacher", key: "voice.presetTeacher", q: { tags: ["teacher"] } },
  { id: "epic", key: "voice.presetEpic", q: { tags: ["movie-trailer"] } },
  { id: "funny", key: "voice.presetFunny", q: { tags: ["funny"] } },
  { id: "mysterious", key: "voice.presetMysterious", q: { tags: ["mysterious"] } },
];

const SORTS: Record<string, string> = { popular: "voice.sortPopular", curated: "voice.sortCurated", name: "voice.sortAz" };
const FAV_KEY = "storycast-voice-favs";
const TAG_LIMIT = 28;

export const pretty = (s: string) => s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace("Middle Aged", "Middle-aged");

export const splitName = (n: string) => {
  const [name, ...rest] = n.split(/\s+[-–|]\s+/);
  return { name: name.trim(), tagline: rest.join(" · ").trim() };
};

function loadFavs(): Record<string, Voice> {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || "{}");
  } catch {
    return {};
  }
}

export function previewFor(v: Voice, lang: string) {
  return api.preview(v, lang);
}

function Chip({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors",
        active ? "border-transparent text-primary-foreground" : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
      )}
    >
      {active && <motion.span layout transition={SPRING_LAYOUT} className="absolute inset-0 rounded-full bg-primary" />}
      <span className="relative">
        {children}
        {count !== undefined && <span className={cn("ml-1 font-mono text-[10px]", active ? "opacity-80" : "opacity-50")}>{count}</span>}
      </span>
    </button>
  );
}

function Ring({ progress }: { progress: number }) {
  const r = 19;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 44 44" className="pointer-events-none absolute inset-0 -rotate-90">
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeDasharray={c} strokeDashoffset={c * (1 - progress)} strokeLinecap="round" />
    </svg>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lang: string;
  topic: string;
  selected: Voice | null;
  onSelect: (v: Voice | null) => void;
};

export function VoiceLibrary({ open, onOpenChange, lang, topic, selected, onSelect }: Props) {
  const t = useT();
  const [facets, setFacets] = useState<VoiceFacets | null>(null);
  const [q, setQ] = useState<VoiceQuery>(EMPTY);
  const [search, setSearch] = useState("");
  const [tagSearch, setTagSearch] = useState("");
  const [allTags, setAllTags] = useState(false);
  const [preset, setPreset] = useState<string | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [favOnly, setFavOnly] = useState(false);
  const [favs, setFavs] = useState<Record<string, Voice>>(loadFavs);
  const [auditioning, setAuditioning] = useState<string | null>(null);
  const player = usePlayer();
  const sentinel = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);

  const stopPlayer = player.stop;
  useEffect(() => {
    if (open && !facets) api.voiceFacets().then(setFacets).catch(() => {});
    if (!open) stopPlayer();
  }, [open, facets, stopPlayer]);

  useEffect(() => {
    const timer = setTimeout(() => setQ((prev) => (prev.search === search ? prev : { ...prev, search })), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchPage = useCallback(async (query: VoiceQuery, p: number) => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setLoading(true);
    setError("");
    try {
      const res = await api.voices(query, p, ctrl.signal);
      setVoices((prev) => (p === 0 ? res.voices : [...prev, ...res.voices.filter((v) => !prev.some((x) => x.voice_id === v.voice_id))]));
      setHasMore(res.has_more);
      setTotal(res.total_count);
      setPage(p);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      if (abort.current === ctrl) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchPage(q, 0);
  }, [open, q, fetchPage]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || favOnly) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && !loading && fetchPage(q, page + 1), { rootMargin: "500px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, page, q, fetchPage, favOnly]);

  const shown = favOnly ? Object.values(favs) : voices;

  const tagList = useMemo(() => {
    const tags = facets?.tags ?? [];
    const needle = tagSearch.toLowerCase().trim();
    const hits = needle ? tags.filter((tag) => tag.tag.includes(needle)) : tags;
    const chosen = hits.filter((tag) => q.tags.includes(tag.tag));
    const rest = hits.filter((tag) => !q.tags.includes(tag.tag));
    return [...chosen, ...(allTags || needle ? rest : rest.slice(0, TAG_LIMIT))];
  }, [facets, tagSearch, q.tags, allTags]);

  function set<K extends keyof VoiceQuery>(k: K, v: VoiceQuery[K]) {
    setPreset(null);
    setQ((prev) => ({ ...prev, [k]: v }));
  }
  function toggleTag(tag: string) {
    set("tags", q.tags.includes(tag) ? q.tags.filter((x) => x !== tag) : [...q.tags, tag]);
  }
  function applyPreset(id: string) {
    const p = PRESET_KEYS.find((x) => x.id === id);
    if (!p || preset === id) {
      setPreset(null);
      setQ({ ...EMPTY, sort: q.sort });
      return;
    }
    setPreset(id);
    setQ({ ...EMPTY, sort: q.sort, ...p.q });
  }
  function reset() {
    setPreset(null);
    setSearch("");
    setTagSearch("");
    setQ(EMPTY);
    setFavOnly(false);
  }
  function toggleFav(v: Voice) {
    setFavs((prev) => {
      const next = { ...prev };
      if (next[v.voice_id]) delete next[v.voice_id];
      else next[v.voice_id] = v;
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }
  function audition(v: Voice) {
    setAuditioning(v.voice_id);
    const src = api.sample(v.voice_id, topic || "a story you won't forget", lang).finally(() => setAuditioning(null));
    player.toggle(`${v.voice_id}:line`, src);
  }

  const activeFilters = [q.gender, q.age, q.accent, q.category, q.language, q.curated ? "curated" : "", ...q.tags].filter(Boolean).length;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} side="right" ariaLabel={t("voice.library")} className="w-full max-w-[min(780px,100vw)] sm:w-[740px]">
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-border px-5 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium tracking-tight">{t("voice.library")}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {favOnly
                  ? t("voice.favCount", { n: shown.length })
                  : t("voice.count", { shown: total.toLocaleString(), total: (facets?.total ?? 0).toLocaleString() })}
              </p>
            </div>
            <button type="button" onClick={() => onOpenChange(false)} aria-label={t("motion.close")} className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-4 flex gap-2">
            <Input value={search} onChange={setSearch} placeholder={t("voice.search")} leftIcon={<Search className="size-4" />} className="flex-1" />
            <Button variant={showFilters ? "secondary" : "ghost"} size="md" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters} className="h-10 shrink-0">
              <SlidersHorizontal className="size-4" />
              {activeFilters > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] leading-4 text-primary-foreground">{activeFilters}</span>}
            </Button>
          </div>

          <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
            {PRESET_KEYS.map((p) => (
              <Chip key={p.id} active={preset === p.id} onClick={() => applyPreset(p.id)}>
                {t(p.key)}
              </Chip>
            ))}
          </div>

          <AnimatePresence initial={false}>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: EASE_OUT }}
                className="overflow-hidden"
              >
                <div className="flex max-h-[42vh] flex-col gap-3 overflow-y-auto pt-4 pr-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Tabs value={q.gender || "any"} onValueChange={(v) => set("gender", v === "any" ? "" : v)} variant="segment">
                      <TabsList>
                        <TabsTrigger value="any">{t("voice.any")}</TabsTrigger>
                        {(facets?.gender ?? []).map((g) => (
                          <TabsTrigger key={g} value={g}>
                            {pretty(g)}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                    <Tabs value={q.age || "any"} onValueChange={(v) => set("age", v === "any" ? "" : v)} variant="segment">
                      <TabsList>
                        <TabsTrigger value="any">{t("voice.anyAge")}</TabsTrigger>
                        {(facets?.age ?? []).map((a) => (
                          <TabsTrigger key={a} value={a}>
                            {pretty(a)}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Select value={q.accent || "any"} onValueChange={(v) => set("accent", v === "any" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("voice.accent")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">{t("voice.anyAccent")}</SelectItem>
                        {(facets?.accent ?? []).map((a) => (
                          <SelectItem key={a} value={a}>
                            {pretty(a)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={q.language || "any"} onValueChange={(v) => set("language", v === "any" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("voice.nativeLang")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">{t("voice.anyLang")}</SelectItem>
                        {(facets?.languages ?? []).map((l) => (
                          <SelectItem key={l.language} value={l.language}>
                            {pretty(l.language)} ({l.count})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={q.category || "any"} onValueChange={(v) => set("category", v === "any" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("voice.category")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">{t("voice.anyCategory")}</SelectItem>
                        {(facets?.category ?? []).map((c) => (
                          <SelectItem key={c} value={c}>
                            {pretty(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={q.sort} onValueChange={(v) => set("sort", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("voice.sort")} />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SORTS).map(([k, label]) => (
                          <SelectItem key={k} value={k}>
                            {t(label)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-xs font-medium">{t("voice.characterMood")}</span>
                      <input
                        value={tagSearch}
                        onChange={(e) => setTagSearch(e.target.value)}
                        placeholder={t("voice.findTag")}
                        className="h-7 w-32 rounded-full border border-border bg-transparent px-3 text-xs outline-none placeholder:text-muted-foreground focus:border-border-strong"
                      />
                      {q.tags.length > 1 && <span className="text-[11px] text-muted-foreground">{t("voice.tagsAllMatch")}</span>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {tagList.map((tag) => (
                        <Chip key={tag.tag} active={q.tags.includes(tag.tag)} onClick={() => toggleTag(tag.tag)} count={tag.count}>
                          {pretty(tag.tag)}
                        </Chip>
                      ))}
                      {!tagSearch && (facets?.tags.length ?? 0) > TAG_LIMIT && (
                        <button type="button" onClick={() => setAllTags((a) => !a)} className="px-2 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                          {allTags ? t("voice.fewer") : t("voice.more", { n: (facets?.tags.length ?? 0) - TAG_LIMIT })}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                     <Switch checked={q.curated} onCheckedChange={(v) => set("curated", v)} label={t("voice.handPicked")} />
                     <Switch checked={favOnly} onCheckedChange={setFavOnly} label={t("voice.favorites", { n: Object.keys(favs).length })} />
                     <button type="button" onClick={reset} className="ml-auto text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                       {t("voice.reset")}
                     </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              onOpenChange(false);
            }}
            className={cn(
              "mb-2 flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors",
              selected ? "border-border hover:bg-muted/60" : "border-primary/40 bg-primary/5",
            )}
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted">
              <AudioLines className="size-4 text-accent" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{t("voice.directorChoice")}</span>
              <span className="block text-xs text-muted-foreground">{t("voice.directorChoiceDesc")}</span>
            </span>
            {!selected && <Check className="size-4 text-primary" />}
          </button>

          {error && <p className="px-3 py-6 text-center text-sm text-destructive">{error}</p>}

          <ul className="flex flex-col">
            {shown.map((v) => {
              const isSel = selected?.voice_id === v.voice_id;
              const playingPreview = player.playing === v.voice_id;
              const playingLine = player.playing === `${v.voice_id}:line`;
              const { name, tagline } = splitName(v.name);
              const traits = [v.gender, v.age, v.accent, ...(v.languages ?? [])].filter(Boolean).map(pretty);
              return (
                <motion.li
                  key={v.voice_id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: EASE_OUT }}
                  className={cn("group flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors", isSel ? "bg-primary/8" : "hover:bg-muted/60")}
                >
                  <button
                    type="button"
                    onClick={() => player.toggle(v.voice_id, previewFor(v, lang))}
                    aria-label={playingPreview ? t("voice.pauseName", { name }) : t("voice.playName", { name })}
                    className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-foreground ring-1 ring-border transition-transform active:scale-95"
                  >
                    {playingPreview ? <Pause className="size-4 fill-current" /> : <Play className="size-4 translate-x-px fill-current" />}
                    {playingPreview && <Ring progress={player.progress} />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{name}</span>
                      {v.curated && (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent/15 px-1.5 text-[10px] text-accent">
                           <Sparkles className="size-2.5" /> {t("voice.picked")}
                        </span>
                      )}
                      {tagline && <span className="hidden truncate text-xs text-muted-foreground sm:inline">{tagline}</span>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{[...traits, ...v.tags.slice(0, 4).map(pretty)].join(" · ")}</p>
                    {v.description && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground/80">{v.description}</p>}
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleFav(v)}
                    aria-label={favs[v.voice_id] ? t("voice.removeFav") : t("voice.addFav")}
                    className={cn("flex size-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted", favs[v.voice_id] ? "text-rose-500" : "text-muted-foreground")}
                  >
                    <Heart className={cn("size-4", favs[v.voice_id] && "fill-current")} />
                  </button>
                  <button
                    type="button"
                    onClick={() => audition(v)}
                    aria-label={t("voice.hearRead", { name })}
                    title={t("voice.hearTopic")}
                    className={cn("flex size-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted", playingLine ? "text-primary" : "text-muted-foreground")}
                  >
                    {auditioning === v.voice_id ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
                  </button>
                  <Button
                    variant={isSel ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => {
                      onSelect(v);
                      player.stop();
                      onOpenChange(false);
                    }}
                    className="shrink-0"
                  >
                    {isSel ? <Check className="size-3.5" /> : null}
                    {isSel ? t("voice.chosen") : t("voice.use")}
                  </Button>
                </motion.li>
              );
            })}
          </ul>

          {!loading && shown.length === 0 && !error && (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">
              {t("voice.noMatch")}{" "}
              <button type="button" onClick={reset} className="text-foreground underline underline-offset-2">
                {t("voice.resetFilters")}
              </button>
            </p>
          )}
          {loading && (
            <div className="flex justify-center py-6">
              <TextShimmer className="text-sm">{t("voice.finding")}</TextShimmer>
            </div>
          )}
          <div ref={sentinel} className="h-1" />
        </div>
      </div>
    </Drawer>
  );
}
