"use client";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarClock } from "lucide-react";
import { ALL_KINDS, ddayLabel, KIND_LABEL, todayISO, type Notice, type NoticeKind } from "@muse/core";
import { useApp } from "@/lib/store";
import { DetailOverlay } from "@/components/DetailOverlay";
import { cx, KindBadge, PageTitle, Segmented } from "@/components/ui";

const pad = (n: number) => String(n).padStart(2, "0");

export default function CalendarPage() {
  const { notices, state, enabledKinds, markSeen } = useApp();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [only, setOnly] = useState<"all" | "saved">("all");
  const [sel, setSel] = useState<Notice | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const today = todayISO();

  const items = useMemo(() => notices.filter((n) => enabledKinds.includes(n.kind) && !state.hidden[n.id] && (only === "all" || state.starred[n.id])), [notices, enabledKinds, state, only]);
  const byDate = useMemo(() => {
    const m = new Map<string, Notice[]>();
    items.forEach((n) => { if (n.deadline) m.set(n.deadline, [...(m.get(n.deadline) ?? []), n]); });
    return m;
  }, [items]);
  const expected = items.filter((n) => n.deadlineLabel === "예정");

  const first = new Date(ym.y, ym.m, 1);
  const startPad = first.getDay();
  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells = [...Array(startPad).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const key = (d: number) => `${ym.y}-${pad(ym.m + 1)}-${pad(d)}`;
  const monthItems = [...byDate.entries()].filter(([k]) => k.startsWith(`${ym.y}-${pad(ym.m + 1)}`)).sort(([a], [b]) => a.localeCompare(b));
  const agenda = day ? monthItems.filter(([k]) => k === day) : monthItems;
  const move = (d: number) => { setDay(null); setYm(({ y, m }) => { const t = new Date(y, m + d, 1); return { y: t.getFullYear(), m: t.getMonth() }; }); };
  const open = (n: Notice) => { setSel(n); markSeen(n.id); };

  return (
    <main className="px-4 sm:px-6 lg:px-10 pt-5 lg:pt-9 pb-10 max-w-[1200px]">
      <PageTitle title="캘린더" sub="마감일과 교육·대관 일정을 한눈에" right={
        <Segmented<"all" | "saved"> value={only} onChange={setOnly} options={[{ value: "all", label: "전체" }, { value: "saved", label: "★ 저장" }]} />
      } />

      <div className="flex items-center gap-2 mb-3">
        <button aria-label="이전 달" onClick={() => move(-1)} className="size-9 grid place-items-center rounded-lg hover:bg-surface-2"><ChevronLeft size={19} /></button>
        <h2 className="text-lg font-bold tnum w-32 text-center">{ym.y}년 {ym.m + 1}월</h2>
        <button aria-label="다음 달" onClick={() => move(1)} className="size-9 grid place-items-center rounded-lg hover:bg-surface-2"><ChevronRight size={19} /></button>
        <button onClick={() => setYm({ y: now.getFullYear(), m: now.getMonth() })} className="ml-1 h-8 px-3 rounded-lg border border-line text-[13px] font-medium hover:border-ink">오늘</button>
        <div className="ml-auto hidden md:flex items-center gap-3 text-[12px] text-mute">
          {ALL_KINDS.filter((k) => enabledKinds.includes(k)).map((k) => (
            <span key={k} className={cx(`k-${k}`, "flex items-center gap-1")}><span className="size-2 rounded-full bg-[var(--k)]" />{KIND_LABEL[k]}</span>
          ))}
        </div>
      </div>

      {/* PC: 달력 */}
      <div className="hidden md:block rounded-2xl border border-line bg-surface overflow-hidden shadow-card">
        <div className="grid grid-cols-7 text-[12px] font-semibold text-mute border-b border-line">
          {"일월화수목금토".split("").map((w, i) => <div key={w} className={cx("px-3 py-2", i === 0 && "text-seal")}>{w}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const k = d ? key(d) : "";
            const list = d ? byDate.get(k) ?? [] : [];
            return (
              <div key={i} className={cx("min-h-[112px] border-b border-r border-line p-1.5 [&:nth-child(7n)]:border-r-0", !d && "bg-surface-2/50")}>
                {d && (
                  <>
                    <span className={cx("inline-grid place-items-center size-6 rounded-full text-[12.5px] tnum mb-1", k === today ? "bg-ink text-bg font-bold" : i % 7 === 0 ? "text-seal" : "text-mute")}>{d}</span>
                    <div className="space-y-1">
                      {list.slice(0, 3).map((n) => (
                        <button key={n.id} onClick={() => open(n)}
                          className={cx(`k-${n.kind}`, "w-full text-left truncate rounded-md px-1.5 py-1 text-[11.5px] font-medium bg-[var(--ks)] text-[var(--k)] hover:brightness-95", state.starred[n.id] && "ring-1 ring-[var(--k)]")}>
                          {state.starred[n.id] && "★ "}{n.title}
                        </button>
                      ))}
                      {list.length > 3 && <span className="block text-[11px] text-faint px-1">+{list.length - 3}건 더</span>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 모바일: 점 달력 + 선택한 날 목록 */}
      <div className="md:hidden">
        <div className="rounded-2xl border border-line bg-surface p-2 shadow-card">
          <div className="grid grid-cols-7 text-center text-[11.5px] font-semibold text-mute pb-1">
            {"일월화수목금토".split("").map((w, i) => <span key={w} className={cx(i === 0 && "text-seal")}>{w}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((d, i) => {
              if (!d) return <span key={i} />;
              const k = key(d);
              const list = byDate.get(k) ?? [];
              const on = day === k;
              return (
                <button key={i} onClick={() => setDay(on ? null : k)} aria-pressed={on} aria-label={`${d}일 ${list.length}건`}
                  className={cx("h-12 rounded-xl flex flex-col items-center justify-center gap-1", on ? "bg-ink text-bg" : k === today ? "bg-brand-soft" : "")}>
                  <span className={cx("text-[14px] tnum leading-none", k === today && !on && "font-bold text-brand-ink", i % 7 === 0 && !on && "text-seal")}>{d}</span>
                  <span className="flex gap-0.5 h-1.5">
                    {list.slice(0, 3).map((n) => <span key={n.id} className={cx(`k-${n.kind}`, "size-1.5 rounded-full", on ? "bg-bg" : "bg-[var(--k)]")} />)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center justify-between mt-5 mb-2.5">
          <h3 className="text-[14px] font-bold">{day ? `${+day.slice(5, 7)}월 ${+day.slice(8)}일` : `${ym.m + 1}월 전체`}</h3>
          {day && <button className="text-[13px] text-mute" onClick={() => setDay(null)}>이 달 전체 보기</button>}
        </div>
        <div className="space-y-2">
          {agenda.length === 0 && <p className="text-sm text-mute py-8 text-center">마감되는 공고가 없어요</p>}
          {agenda.map(([date, list]) => list.map((n) => (
            <button key={n.id} onClick={() => open(n)} className={cx(`k-${n.kind}`, "w-full text-left rounded-xl border border-line bg-surface p-3 flex gap-3 items-center")}>
              <span className="w-10 shrink-0 text-center">
                <span className="block text-[17px] font-bold tnum leading-none">{+date.slice(8)}</span>
                <span className="block text-[11px] text-mute mt-0.5">{"일월화수목금토"[new Date(date).getDay()]}</span>
              </span>
              <span className="w-1 self-stretch rounded-full bg-[var(--k)]" />
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5 mb-0.5"><KindBadge kind={n.kind} />{state.starred[n.id] && <span className="text-amber text-[12px]">★</span>}</span>
                <span className="block text-[14px] font-semibold leading-snug line-clamp-2">{n.title}</span>
              </span>
            </button>
          )))}
        </div>
      </div>

      {/* 예정 공고 */}
      {expected.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[15px] font-bold flex items-center gap-2 mb-3"><CalendarClock size={17} className="text-amber" /> 연간 공모 · 예정</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {expected.map((n) => (
              <button key={n.id} onClick={() => open(n)} className="text-left rounded-xl border border-dashed border-amber/50 bg-amber-soft/40 p-4 hover:bg-amber-soft/70">
                <span className="text-[12px] font-bold text-amber">{ddayLabel(n)} · {n.lastYear}</span>
                <span className="block font-semibold mt-1">{n.title}</span>
                <span className="block text-[13px] text-mute">{n.org}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <DetailOverlay n={sel} onClose={() => setSel(null)} />
    </main>
  );
}
