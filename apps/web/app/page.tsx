"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Hash, Inbox, Keyboard, UserPlus, LayoutGrid, LayoutList, Plus, Search, SlidersHorizontal, Table2, X } from "lucide-react";
import { ALL_KINDS, bestRegionFit, daysLeft, fitTotal, isOpen, KIND_LABEL, matchedKeywords, sortByDeadline, type Notice, type NoticeKind } from "@muse/core";
import { useApp } from "@/lib/store";
import { NoticeCard, NoticeTable, PosterCard } from "@/components/NoticeCard";
import { NoticeDetail } from "@/components/NoticeDetail";
import { AddNotice } from "@/components/AddNotice";
import { activeCount, DEFAULT_FILTERS, FilterBar, FilterSheet, type Filters } from "@/components/FeedFilters";
import { Button, cx, Empty, IconButton, Segmented, Tip } from "@/components/ui";
import { usePref } from "@/lib/prefs";

type Tab = "all" | NoticeKind;
type Quick = "all" | "new" | "now" | "prep" | "week";
type View = "list" | "table" | "poster";

const hasVerdict = (n: Notice, s: string, entity: string) =>
  n.analysis?.verdicts.some((v) => v.status === s && (entity === "all" || v.entityId === entity));

const SHORTCUTS: [string, string][] = [["/", "검색"], ["j / k", "다음 · 이전 공고"], ["s", "저장(★)"], ["x", "삭제"], ["o", "원문 열기"], ["Esc", "상세 닫기"]];

export default function FeedPage() {
  const { ready, notices, state, markSeen, enabledKinds, entities, lastSync, toggleStar, remove, toast, live, keywords } = useApp();
  const [kwSel, setKwSel] = usePref<string[]>("mg-kw-sel", []);
  const myKw = keywords.include;
  const kwActive = kwSel.filter((k) => k === "*" || myKw.includes(k));
  const toggleKw = (k: string) => setKwSel(kwActive.includes(k) ? kwActive.filter((x) => x !== k) : [...kwActive.filter((x) => x !== "*"), k]);
  const [tab, setTab] = usePref<Tab>("mg-tab", "all");
  const [view, setView] = usePref<View>("mg-view", "list");
  const [f, setF] = usePref<Filters>("mg-filters", DEFAULT_FILTERS);
  const [quick, setQuick] = useState<Quick>("all");
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  // 다른 화면에서 ?n=공고id 로 돌아오면 그 공고를 열어 둠
  const [openFromUrl, setOpenFromUrl] = useState<string | null>(null);
  useEffect(() => { setOpenFromUrl(new URLSearchParams(window.location.search).get("n")); }, []);
  useEffect(() => {
    if (!openFromUrl || !notices.some((x) => x.id === openFromUrl)) return;
    setSelId(openFromUrl); setOpenFromUrl(null);
    window.history.replaceState(null, "", "/");
  }, [openFromUrl, notices]);
  const [adding, setAdding] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const mSearchRef = useRef<HTMLInputElement>(null);

  const base = useMemo(() => notices.filter((n) => enabledKinds.includes(n.kind) && !state.hidden[n.id]), [notices, enabledKinds, state.hidden]);
  const open = base.filter((n) => isOpen(n));
  const counts: Record<Tab, number> = { all: 0, grant: 0, service: 0, edu: 0, venue: 0, residency: 0 };
  open.forEach((n) => { if (!state.seen[n.id]) { counts[n.kind]++; counts.all++; } });

  const inTab = base.filter((n) => tab === "all" || n.kind === tab);
  const tiles = {
    new: inTab.filter((n) => isOpen(n) && !state.seen[n.id]).length,
    now: inTab.filter((n) => isOpen(n) && hasVerdict(n, "now", f.entity)).length,
    prep: inTab.filter((n) => isOpen(n) && hasVerdict(n, "prep", f.entity)).length,
    week: inTab.filter((n) => { const d = daysLeft(n.deadline); return d !== null && d >= 0 && d <= 7; }).length,
  };
  const regions = [...new Set(base.filter((n) => !n.overseas).map((n) => n.region).filter(Boolean))] as string[];

  const list = useMemo(() => {
    const l = inTab.filter((n) => {
      if (!f.showClosed && !isOpen(n)) return false;
      if (q && !`${n.title} ${n.org} ${n.summary ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (f.region !== "all" && n.region !== f.region) return false;
      if (f.overseas && !n.overseas) return false;
      if (f.domestic && n.overseas) return false;
      if (f.regionOk && bestRegionFit(n, entities)?.status === "mismatch") return false;
      if (f.saved && !state.starred[n.id]) return false;
      if (kwActive.length) {
        const m = matchedKeywords(n, myKw);
        if (kwActive.includes("*") ? m.length === 0 : !kwActive.some((k) => m.includes(k))) return false;
      }
      if (quick === "new" && state.seen[n.id]) return false;
      if (quick === "now" && !hasVerdict(n, "now", f.entity)) return false;
      if (quick === "prep" && !hasVerdict(n, "prep", f.entity)) return false;
      if (quick === "week") { const d = daysLeft(n.deadline); if (d === null || d < 0 || d > 7) return false; }
      if (f.entity !== "all" && n.analysis && !n.analysis.verdicts.some((v) => v.entityId === f.entity && v.status !== "no")) return false;
      return true;
    });
    return [...l].sort((a, b) =>
      f.sort === "fit" ? (fitTotal(b) ?? -1) - (fitTotal(a) ?? -1) || sortByDeadline(a, b)
        : f.sort === "recent" ? (b.postedAt ?? "").localeCompare(a.postedAt ?? "")
          : sortByDeadline(a, b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inTab, f, q, quick, state, kwSel, myKw, entities]);

  const groups: { title: string; items: Notice[] }[] = [];
  if (f.sort === "deadline") {
    const g = (t: string, fn: (d: number | null) => boolean) => { const items = list.filter((n) => fn(daysLeft(n.deadline))); if (items.length) groups.push({ title: t, items }); };
    g("3일 안에 마감", (d) => d !== null && d >= 0 && d <= 3);
    g("2주 안에 마감", (d) => d !== null && d > 3 && d <= 14);
    g("여유 있음", (d) => d !== null && d > 14);
    g("예정 · 상시", (d) => d === null);
    g("마감됨", (d) => d !== null && d < 0);
  } else groups.push({ title: "", items: list });

  const sel = notices.find((n) => n.id === selId) ?? null;
  const openNotice = useCallback((n: Notice) => { setSelId(n.id); markSeen(n.id); }, [markSeen]);
  useEffect(() => { setQuick("all"); }, [tab]);

  // PC 키보드 단축키
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (window.innerWidth < 1024 || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable=true]") || document.querySelector("[role=dialog]")) return;
      const idx = list.findIndex((n) => n.id === selId);
      const go = (i: number) => {
        const n = list[Math.max(0, Math.min(list.length - 1, i))];
        if (!n) return;
        openNotice(n);
        document.querySelector(`[data-notice="${n.id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      };
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === "j") go(idx + 1);
      else if (e.key === "k") go(idx < 0 ? 0 : idx - 1);
      else if (e.key === "s" && sel) toggleStar(sel.id);
      else if (e.key === "x" && sel) { remove(sel.id); toast("삭제했어요 · 설정에서 복원"); go(idx + 1); }
      else if (e.key === "o" && sel) window.open(sel.url, "_blank", "noopener");
      else if (e.key === "Escape") setSelId(null);
      else if (e.key === "?") setKeysOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list, selId, sel, openNotice, toggleStar, remove, toast]);

  const syncText = lastSync ? new Date(lastSync).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
  const TABS: Tab[] = ["all", ...ALL_KINDS.filter((k) => enabledKinds.includes(k))];
  const QUICK: { k: Quick; label: string; n: number; tone: string }[] = [
    { k: "new", label: "새 공고", n: tiles.new, tone: "text-seal" },
    { k: "now", label: "지원 가능", n: tiles.now, tone: "text-[var(--v-now)]" },
    { k: "prep", label: "준비 필요", n: tiles.prep, tone: "text-[var(--v-prep)]" },
    { k: "week", label: "이번 주 마감", n: tiles.week, tone: "text-ink" },
  ];
  const shownQuick = QUICK.filter((x) => tab === "all" || tab === "grant" || tab === "service" || (x.k !== "now" && x.k !== "prep"));
  const nFilters = activeCount(f);
  const kwCount = (k: string) => inTab.filter((n) => isOpen(n) && (k === "*" ? matchedKeywords(n, myKw).length > 0 : matchedKeywords(n, [k]).length > 0)).length;
  const kwRow = (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none lg:flex-wrap -mx-4 px-4 lg:mx-0 lg:px-0">
      <span className="shrink-0 text-[12.5px] font-bold text-mute mr-0.5 flex items-center gap-1"><Hash size={14} />내 키워드</span>
      {myKw.length === 0 ? (
        <Link href="/settings#keywords" className="shrink-0 h-8 px-3 rounded-full border border-dashed border-brand text-brand-ink text-[13px] font-semibold flex items-center">+ 키워드 고르기</Link>
      ) : (
        <>
          <button onClick={() => setKwSel(kwActive.length ? [] : ["*"])} aria-pressed={kwActive.length === 0}
            className={cx("shrink-0 h-8 px-3 rounded-full text-[13px] font-semibold border", kwActive.length === 0 ? "bg-ink text-bg border-ink" : "border-line text-mute bg-surface")}>전체</button>
          <button onClick={() => setKwSel(kwActive.includes("*") ? [] : ["*"])} aria-pressed={kwActive.includes("*")}
            className={cx("shrink-0 h-8 px-3 rounded-full text-[13px] font-semibold border", kwActive.includes("*") ? "bg-brand text-white border-brand dark:text-[#0f1413]" : "border-line text-mute bg-surface")}>
            내 키워드 모두 <span className="tnum opacity-80">{kwCount("*")}</span></button>
          {myKw.map((k) => (
            <button key={k} onClick={() => toggleKw(k)} aria-pressed={kwActive.includes(k)}
              className={cx("shrink-0 h-8 px-3 rounded-full text-[13px] font-semibold border transition-colors",
                kwActive.includes(k) ? "bg-brand text-white border-brand dark:text-[#0f1413]" : "border-brand/30 bg-brand-soft/60 text-brand-ink")}>
              #{k} <span className="tnum opacity-75">{kwCount(k)}</span>
            </button>
          ))}
          <Link href="/settings#keywords" className="shrink-0 h-8 px-2.5 rounded-full text-[13px] text-mute hover:text-ink flex items-center">편집</Link>
        </>
      )}
    </div>
  );
  const resetAll = () => { setQuick("all"); setQ(""); setF(DEFAULT_FILTERS); };

  const tabButtons = (mobile: boolean) => TABS.map((t) => (
    <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
      className={cx(t !== "all" && `k-${t}`, "shrink-0 flex items-center gap-1.5 font-semibold transition-colors",
        mobile
          ? cx("h-9 px-3.5 rounded-full text-[14px]", tab === t ? "bg-ink text-bg" : "bg-surface text-mute border border-line")
          : cx("relative h-11 px-2.5 2xl:px-3 text-[14.5px]", tab === t ? "text-ink" : "text-mute hover:text-ink"))}>
      {t !== "all" && <span className={cx("size-2 rounded-full", mobile && tab === t ? "bg-bg" : "bg-[var(--k)]")} />}
      {t === "all" ? "전체" : KIND_LABEL[t]}
      {counts[t] > 0 && <span className={cx("tnum text-[11px] rounded-full px-1.5 min-w-5 leading-5 text-center",
        mobile ? (tab === t ? "bg-bg/20" : "bg-surface-2") : (tab === t ? "bg-ink text-bg" : "bg-surface-2 text-mute"))}>{counts[t]}</span>}
      {!mobile && tab === t && <span className="absolute inset-x-2 -bottom-px h-[2.5px] rounded-full bg-ink" />}
    </button>
  ));

  const listBody = (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.title || "all"}>
          {g.title && <h2 className="text-[12.5px] font-bold text-mute mb-2.5 flex items-center gap-2">{g.title}<span className="tnum font-normal text-faint">{g.items.length}</span></h2>}
          <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-1">
            {g.items.map((n) => <NoticeCard key={n.id} n={n} active={selId === n.id} onOpen={() => openNotice(n)} activeKeywords={kwActive} onPickKeyword={toggleKw} />)}
          </div>
        </section>
      ))}
    </div>
  );

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_460px] min-h-dvh">
      <main className="min-w-0">
        {/* ───────── 모바일·태블릿 헤더 (고정) ───────── */}
        <header className="lg:hidden sticky top-0 z-30 bg-bg/92 backdrop-blur-md border-b border-line/70">
          {!searchOpen ? (
            <div className="flex items-center gap-1 px-4 h-14">
              <img src="/icon.svg" alt="" className="size-7 rounded-lg" />
              <span className="font-serif text-[17px] font-bold ml-1.5 flex-1">공고</span>
              <IconButton label="검색" className="size-10" onClick={() => { setSearchOpen(true); setTimeout(() => mSearchRef.current?.focus(), 30); }}><Search size={20} /></IconButton>
              <IconButton label="필터와 정렬" className="size-10 relative" onClick={() => setFilterOpen(true)}>
                <SlidersHorizontal size={20} />
                {nFilters > 0 && <span className="absolute top-1.5 right-1.5 size-4 rounded-full bg-brand text-white text-[10px] font-bold grid place-items-center dark:text-[#0f1413]">{nFilters}</span>}
              </IconButton>
              <IconButton label={view === "poster" ? "목록 보기" : "포스터 보기"} className="size-10" onClick={() => setView(view === "poster" ? "list" : "poster")}>
                {view === "poster" ? <LayoutList size={20} /> : <LayoutGrid size={20} />}
              </IconButton>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 h-14">
              <div className="relative flex-1">
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <input ref={mSearchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="공고 제목, 기관 검색" enterKeyHint="search"
                  className="w-full h-10 rounded-xl bg-surface-2 pl-9 pr-3 text-[15px] focus:outline-none" />
              </div>
              <button className="text-[14.5px] font-semibold text-mute px-1" onClick={() => { setQ(""); setSearchOpen(false); }}>취소</button>
            </div>
          )}
          <div role="tablist" aria-label="공고 종류" className="flex gap-1.5 px-4 pb-2.5 overflow-x-auto scrollbar-none">{tabButtons(true)}</div>
        </header>

        <div className="px-4 sm:px-6 lg:px-10 pt-3 lg:pt-9 pb-10 max-w-[1000px] w-full mx-auto xl:mx-0 xl:ml-auto">
          {/* ───────── PC 헤더 ───────── */}
          <div className="hidden lg:flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
            <div className="shrink-0">
              <h1 className="font-serif text-[30px] font-bold leading-tight">공고</h1>
              <p className="text-[12.5px] text-mute mt-1 flex items-center gap-1 whitespace-nowrap">
                <span className="size-1.5 rounded-full bg-brand" /><span className="tnum">{syncText}</span> 수집 기준 · 접수 중 <b className="text-ink tnum">{open.length}</b>건
                <Tip>하루 두 번(06:00, 18:00) 자동으로 새 공고를 모아요. 공고 정보는 바뀔 수 있으니 지원 전에 원문을 꼭 확인하세요.</Tip>
              </p>
            </div>
            <div className="flex items-center gap-2 flex-1 justify-end min-w-[300px]">
              <div className="relative flex-1 max-w-80">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="공고 검색"
                  className="w-full h-10 rounded-lg border border-line bg-surface pl-9 pr-9 text-[14px] focus:outline-none focus:border-brand" />
                {q ? <button aria-label="검색어 지우기" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 size-6 grid place-items-center text-faint hover:text-ink"><X size={15} /></button>
                  : <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-faint border border-line rounded px-1.5">/</kbd>}
              </div>
              <Button variant="primary" onClick={() => setAdding(true)}><Plus size={17} /> 공고 추가</Button>
            </div>
          </div>
          <div className="hidden lg:flex items-end gap-3 mt-5 border-b border-line">
            <div role="tablist" aria-label="공고 종류" className="flex gap-1 min-w-0 overflow-x-auto scrollbar-none">{tabButtons(false)}</div>
            <div className="ml-auto shrink-0 hidden 2xl:flex items-center gap-1.5 pb-1.5">
              <div className="relative">
                <IconButton label="키보드 단축키 (?)" onClick={() => setKeysOpen(!keysOpen)}><Keyboard size={17} /></IconButton>
                {keysOpen && (
                  <div className="anim-fade absolute right-0 top-10 z-40 w-56 rounded-xl border border-line bg-surface p-3 shadow-pop text-[13px]">
                    <p className="font-bold mb-2">키보드 단축키</p>
                    {SHORTCUTS.map(([k, l]) => (<div key={k} className="flex justify-between py-1"><span className="text-mute">{l}</span><kbd className="text-[11.5px] border border-line rounded px-1.5 tnum">{k}</kbd></div>))}
                  </div>
                )}
              </div>
              <Segmented value={view} onChange={setView} options={[
                { value: "list", label: <LayoutList size={16} />, title: "목록 보기" },
                { value: "table", label: <Table2 size={16} />, title: "표 보기 (한눈에 많이)" },
                { value: "poster", label: <LayoutGrid size={16} />, title: "포스터 보기" },
              ]} />
            </div>
          </div>

          <div className="mt-3 lg:mt-4">{kwRow}</div>

          {/* 모바일: 수집 상태 + 요약 칩 (가로 스크롤) */}
          <p className="lg:hidden mt-2.5 text-[12px] text-mute flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-brand" /><span className="tnum">{syncText}</span> 수집 · 접수 중 <b className="text-ink tnum">{open.length}</b>건
          </p>
          <div className="lg:hidden mt-2.5 -mx-4 px-4 flex gap-1.5 overflow-x-auto scrollbar-none">
            {shownQuick.map((x) => (
              <button key={x.k} onClick={() => setQuick(quick === x.k ? "all" : x.k)} aria-pressed={quick === x.k}
                className={cx("shrink-0 h-9 pl-3 pr-3.5 rounded-full border text-[13.5px] flex items-center gap-1.5 transition-colors",
                  quick === x.k ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink")}>
                <b className={cx("tnum", quick !== x.k && x.tone)}>{x.n}</b>{x.label}
              </button>
            ))}
          </div>

          {/* PC: 요약 타일 + 도구 모음 */}
          <div className={cx("hidden lg:grid mt-5 gap-2", shownQuick.length === 4 ? "grid-cols-4" : "grid-cols-2")}>
            {shownQuick.map((x) => (
              <button key={x.k} onClick={() => setQuick(quick === x.k ? "all" : x.k)} aria-pressed={quick === x.k}
                className={cx("text-left rounded-xl border px-4 py-3 transition-all", quick === x.k ? "border-ink bg-surface shadow-card" : "border-line bg-surface hover:border-line-strong")}>
                <span className={cx("block text-[24px] font-bold tnum leading-tight", x.tone)}>{x.n}</span>
                <span className="block text-[12.5px] text-mute">{x.label}</span>
              </button>
            ))}
          </div>
          <div className="hidden lg:flex mt-4 flex-wrap items-center gap-2">
            <FilterBar f={f} set={setF} regions={regions} entities={entities} showOverseas={tab === "all" || tab === "grant" || tab === "edu" || tab === "residency"} />
            <div className="ml-auto 2xl:hidden">
              <Segmented value={view} onChange={setView} options={[
                { value: "list", label: <LayoutList size={16} />, title: "목록 보기" },
                { value: "table", label: <Table2 size={16} />, title: "표 보기 (한눈에 많이)" },
                { value: "poster", label: <LayoutGrid size={16} />, title: "포스터 보기" },
              ]} />
            </div>
          </div>

          {live && ready && entities.length === 0 && (
            <Link href="/settings#entities" className="mt-4 flex items-center gap-3 rounded-xl border border-brand/40 bg-brand-soft/60 p-3.5 hover:bg-brand-soft">
              <span className="size-9 rounded-lg bg-brand text-white grid place-items-center shrink-0 dark:text-[#0f1413]"><UserPlus size={18} /></span>
              <span className="flex-1 min-w-0"><b className="text-[14px] block">지원 주체를 먼저 등록해 주세요</b><span className="text-[12.5px] text-mute">개인·단체 정보를 넣으면 공고마다 지원 가능 여부를 판정해요</span></span>
              <span className="text-[13px] font-semibold text-brand-ink shrink-0">등록하기 →</span>
            </Link>
          )}

          {/* 목록 */}
          <div className="mt-4 lg:mt-5">
            {!ready ? (
              <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-xl bg-surface-2 animate-pulse" />)}</div>
            ) : list.length === 0 ? (
              <Empty icon={<Inbox size={30} />} title="조건에 맞는 공고가 없어요" desc="필터를 바꾸거나, 인스타에서 본 공고를 직접 추가해 보세요."
                action={<Button onClick={resetAll}>필터 초기화</Button>} />
            ) : view === "poster" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-x-3 gap-y-5">
                {list.map((n) => <PosterCard key={n.id} n={n} onOpen={() => openNotice(n)} />)}
              </div>
            ) : view === "table" ? (
              <>
                <div className="lg:hidden">{listBody}</div>
                <div className="hidden lg:block"><NoticeTable list={list} selId={selId} onOpen={openNotice} /></div>
              </>
            ) : listBody}
            {ready && list.length > 0 && !f.showClosed && (
              <div className="text-center mt-6">
                <button className="text-[13px] text-mute underline underline-offset-2" onClick={() => setF({ ...f, showClosed: true })}>마감된 공고도 보기</button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 넓은 PC: 오른쪽 상세 패널 */}
      <aside className="hidden xl:block sticky top-0 h-dvh border-l border-line bg-surface">
        {sel ? <NoticeDetail key={sel.id} n={sel} mode="panel" onClose={() => setSelId(null)} /> : (
          <div className="h-full grid place-items-center p-10 text-center">
            <div>
              <div className="mx-auto size-14 rounded-2xl bg-brand-soft grid place-items-center text-brand mb-4"><LayoutList /></div>
              <p className="font-semibold">공고를 선택하면 여기에 자세히 보여요</p>
              <p className="text-[13px] text-mute mt-1">판정, 적합도, 준비할 것까지 한눈에</p>
              <p className="text-[12px] text-faint mt-4"><kbd className="border border-line rounded px-1">j</kbd> <kbd className="border border-line rounded px-1">k</kbd> 로 공고를 넘겨 볼 수 있어요</p>
            </div>
          </div>
        )}
      </aside>

      {/* 휴대폰: 전체 화면 / 태블릿·작은 PC: 오른쪽 서랍 */}
      {sel && (
        <div className="xl:hidden fixed inset-0 z-50">
          <div className="hidden lg:block absolute inset-0 bg-black/25 anim-fade" onClick={() => setSelId(null)} />
          <div className="absolute inset-y-0 right-0 w-full md:w-[560px] bg-surface anim-slide md:border-l md:border-line md:shadow-pop">
            <NoticeDetail key={sel.id} n={sel} mode="page" onClose={() => setSelId(null)} />
          </div>
        </div>
      )}

      {/* 모바일: 공고 추가 버튼 (엄지 닿는 곳) */}
      <button onClick={() => setAdding(true)} aria-label="공고 추가"
        className="lg:hidden fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 h-14 pl-4 pr-5 rounded-2xl bg-brand text-white shadow-pop flex items-center gap-1.5 font-semibold text-[15px] dark:text-[#0f1413]">
        <Plus size={22} /> 추가
      </button>
      <AddNotice open={adding} onClose={() => setAdding(false)} />
      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} f={f} set={setF} regions={regions} entities={entities} resultCount={list.length} />
    </div>
  );
}
