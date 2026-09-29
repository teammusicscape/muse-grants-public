"use client";
import { CalendarClock, MapPin, Star, Trash2 } from "lucide-react";
import { bestRegionFit, ddayLabel, fitTotal, placeLabel, REGION_STATUS_LABEL, urgency, formatKDate, matchedKeywords, shortDateTime, type Notice, type RegionFit, type RegionStatus } from "@muse/core";
import { useApp } from "@/lib/store";
import { cx, GradeBadge, KindBadge, SourceBadge, VerdictPill } from "./ui";
import { keyFacts } from "./meta";

const URG: Record<string, string> = {
  closed: "text-faint", today: "text-seal", urgent: "text-seal", soon: "text-ink", normal: "text-ink", none: "text-mute",
};

function shortDate(n: Notice) {
  if (n.deadline) return formatKDate(n.deadline);
  return n.deadlineLabel === "예정" ? "공고 전" : "";
}

const R_CLASS: Record<RegionStatus, string> = { match: "v-now", activity: "v-indirect", check: "v-prep", unknown: "v-no", mismatch: "v-no" };
const R_SHORT: Record<RegionStatus, string> = { match: "거주 부합", activity: "활동지역 부합", check: "시·군·구 확인", unknown: "지역 조건", mismatch: "지역 다름" };

/** 지역 조건 배지: 📍서울 마포구 · 거주 부합 (걸러내지 않고 표시만) */
export function RegionBadge({ fit, who, long }: { fit: RegionFit; who?: string; long?: boolean }) {
  return (
    <span title={fit.note ?? REGION_STATUS_LABEL[fit.status]}
      className={cx(R_CLASS[fit.status], "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap border border-[color-mix(in_oklab,var(--v)_35%,transparent)] text-[var(--v)]", fit.status === "mismatch" && "line-through decoration-1 decoration-[var(--v)]/60")}>
      <MapPin size={11.5} className="shrink-0" />
      {who && <span className="opacity-80 no-underline">{who}</span>}
      <span>{placeLabel(fit.place)}</span>
      <span className="opacity-70">·</span>
      {long ? REGION_STATUS_LABEL[fit.status] : R_SHORT[fit.status]}
    </span>
  );
}

/** K-arts on the GO 해외 우수 플랫폼 표시 */
export function KgoBadge() {
  return (
    <span title="K-arts on the GO 해외 우수 플랫폼이에요 — 여기 초청받으면 초청 경비 지원을 신청할 수 있어요"
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap bg-amber-soft text-amber">
      ✦ K-GO 플랫폼
    </span>
  );
}

/** PC: 왼쪽 D-day 칸 */
export function DdayBlock({ n }: { n: Notice }) {
  const u = urgency(n);
  return (
    <div className="flex flex-col items-center justify-center text-center shrink-0 w-[72px]">
      <span className={cx("font-bold tnum leading-none", URG[u], n.deadline ? "text-[21px]" : "text-[14px]")}>{ddayLabel(n)}</span>
      <span className="text-[11px] text-faint mt-1 tnum">{shortDate(n).replace(/ \(.\)/, "")}</span>
    </div>
  );
}

/** 모바일: 제목 위 D-day 알약 */
export function DdayPill({ n }: { n: Notice }) {
  const u = urgency(n);
  const hot = u === "urgent" || u === "today";
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-md px-1.5 h-[22px] text-[12px] font-bold tnum",
      hot ? "bg-seal text-white" : u === "closed" ? "bg-surface-2 text-faint" : n.deadline ? "bg-ink text-bg" : "bg-amber-soft text-amber")}>
      {ddayLabel(n)}
      {n.deadline && <span className={cx("font-medium", hot ? "text-white/85" : "opacity-70")}>{+n.deadline.slice(5, 7)}/{+n.deadline.slice(8, 10)}</span>}
    </span>
  );
}

export function Stamp({ d, small }: { d: string; small?: boolean }) {
  const c: Record<string, string> = { 강추: "text-seal", 지원: "text-brand", 보류: "text-amber", 비추: "text-faint" };
  return <span className={cx("stamp inline-grid place-items-center font-bold bg-surface/80", small ? "size-9 text-[11.5px]" : "size-11 text-[13px]", c[d])}>{d}</span>;
}

/** 접수기간 표시: "9.22(월) 09:00 ~ 9.28(일) 18:00" */
export function periodText(n: Notice): string {
  if (n.applyStart || n.applyEnd) return `${shortDateTime(n.applyStart) || "?"} ~ ${shortDateTime(n.applyEnd ?? n.deadline) || "?"}`;
  if (n.deadline) return `~ ${shortDateTime(n.deadline)}`;
  return n.lastYear ?? n.deadlineLabel ?? "확인 필요";
}

export function KeywordChips({ words, active, onPick }: { words: string[]; active?: string[]; onPick?(w: string): void }) {
  if (!words.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {words.map((w) => (
        <span key={w} onClick={onPick ? (e) => { e.stopPropagation(); onPick(w); } : undefined}
          className={cx("rounded-md px-1.5 py-0.5 text-[12px] font-semibold", active?.includes(w) ? "bg-brand text-white dark:text-[#0f1413]" : "bg-brand-soft text-brand-ink", onPick && "cursor-pointer")}>#{w}</span>
      ))}
    </span>
  );
}

export function NoticeCard({ n, active, onOpen, activeKeywords, onPickKeyword }: { n: Notice; active?: boolean; onOpen(): void; activeKeywords?: string[]; onPickKeyword?(w: string): void }) {
  const { state, toggleStar, remove, toast, entities, keywords, platformsOf } = useApp();
  const plats = platformsOf(n.id);
  const starred = !!state.starred[n.id];
  const decision = state.decisions[n.id];
  const fresh = !state.seen[n.id];
  const closed = urgency(n) === "closed";
  const facts = keyFacts(n);
  const fit = fitTotal(n);
  const kws = matchedKeywords(n, keywords.include);
  const rfit = bestRegionFit(n, entities);

  return (
    <article
      data-notice={n.id}
      className={cx(`k-${n.kind}`,
        "group relative flex rounded-xl border bg-surface transition-all cursor-pointer overflow-hidden scroll-mt-40",
        active ? "border-brand ring-1 ring-brand" : "border-line hover:border-line-strong md:hover:shadow-card",
        (closed || decision === "비추") && "opacity-60")}
      onClick={onOpen}
    >
      <span className="w-1 shrink-0 bg-[var(--k)]" aria-hidden />
      <div className="flex flex-1 min-w-0 py-3.5 pl-3.5 pr-1 md:py-4 md:pl-0 md:pr-2">
        <div className="hidden md:flex"><DdayBlock n={n} /></div>
        <div className="flex-1 min-w-0 pr-1">
          {/* ① 제목 */}
          <h3 className="font-bold text-[16px] leading-snug line-clamp-2">
            {fresh && !closed && <span className="inline-block size-1.5 rounded-full bg-seal mr-1.5 align-middle -mt-0.5" aria-label="새 공고" />}
            {n.title}
          </h3>
          {/* ② 기관 · 종류 · 출처 */}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-1 text-[13px] text-mute">
            <span className="truncate max-w-[60%]">{n.org}{n.region && n.region !== "전국" && !n.overseas ? ` · ${n.region}` : ""}</span>
            <KindBadge kind={n.kind} />
            {n.overseas && n.kind !== "residency" && <span className="text-[11px] font-medium">해외</span>}
            {n.tags.includes("창업") && <span className="text-[11px] font-semibold text-[var(--k-service)]">창업</span>}
            <span className="hidden md:contents">{n.sources.map((s) => <SourceBadge key={s} s={s} />)}</span>
            <span className="md:hidden">{n.sources.includes("IG") && <SourceBadge s="IG" />}</span>
            {n.needsReview && <span className="text-[11px] font-semibold text-amber">확인 필요</span>}
          </div>
          {/* ③ 게시일 · 접수기간(시간까지) */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-[13px]">
            <span className="md:hidden"><DdayPill n={n} /></span>
            <span className="inline-flex items-center gap-1 text-ink/90 tnum">
              <CalendarClock size={14} className="text-faint shrink-0" />
              <span className="text-mute">접수</span> {periodText(n)}
            </span>
            {n.postedAt && <span className="text-faint tnum">게시 {shortDateTime(n.postedAt)}</span>}
          </div>
          {facts.length > 0 && (
            <p className="text-[13px] mt-1 text-mute line-clamp-1">
              {facts.map((f, i) => (<span key={i}>{i > 0 && <span className="text-faint mx-1.5">·</span>}{f}</span>))}
            </p>
          )}
          {/* ④ 내 키워드 · 판정 */}
          {(kws.length > 0 || n.analysis || rfit || plats.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              <KeywordChips words={kws} active={activeKeywords} onPick={onPickKeyword} />
              {plats.length > 0 && <KgoBadge />}
              {rfit && <RegionBadge fit={rfit} />}
              {n.analysis?.verdicts.map((v) => (
                <VerdictPill key={v.entityId} status={v.status} who={entities.find((e) => e.id === v.entityId)?.short} />
              ))}
              {fit !== undefined && <span className="tnum text-[12px] font-bold">{fit}점</span>}
              {n.analysis?.grade && <GradeBadge grade={n.analysis.grade} />}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end justify-between shrink-0">
          <div className="flex items-center">
            <button aria-label="삭제" title="삭제 (x) — 다시 수집돼도 안 보여요"
              onClick={(e) => { e.stopPropagation(); remove(n.id); toast("삭제했어요. 설정 → 삭제한 공고에서 복원할 수 있어요"); }}
              className="hidden lg:group-hover:grid size-9 place-items-center rounded-lg text-faint hover:text-seal hover:bg-surface-2">
              <Trash2 size={17} />
            </button>
            <button
              aria-label={starred ? "저장 취소" : "저장"} aria-pressed={starred} title="저장 (s)"
              onClick={(e) => { e.stopPropagation(); toggleStar(n.id); }}
              className={cx("size-10 md:size-9 grid place-items-center rounded-lg transition-colors", starred ? "text-amber" : "text-faint hover:text-ink hover:bg-surface-2")}
            >
              <Star size={19} fill={starred ? "currentColor" : "none"} />
            </button>
          </div>
          {decision && <div className="mr-1 mb-0.5"><Stamp d={decision} small /></div>}
        </div>
      </div>
    </article>
  );
}

/** PC 전용: 표 보기 (한 화면에 많이) */
export function NoticeTable({ list, selId, onOpen }: { list: Notice[]; selId: string | null; onOpen(n: Notice): void }) {
  const { state, toggleStar, entities } = useApp();
  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden shadow-card">
      <table className="w-full text-[13.5px]">
        <thead className="bg-surface-2 text-[12px] text-mute text-left sticky top-0">
          <tr>
            <th className="font-semibold py-2.5 pl-4 w-[76px]">마감</th>
            <th className="font-semibold py-2.5 w-[84px]">종류</th>
            <th className="font-semibold py-2.5">공고</th>
            <th className="font-semibold py-2.5 w-[190px]">접수기간</th>
            <th className="font-semibold py-2.5 w-[120px]">판정</th>
            <th className="font-semibold py-2.5 w-[56px] text-right">적합도</th>
            <th className="w-[48px]" />
          </tr>
        </thead>
        <tbody>
          {list.map((n) => {
            const u = urgency(n);
            const fit = fitTotal(n);
            const starred = !!state.starred[n.id];
            const d = state.decisions[n.id];
            return (
              <tr key={n.id} data-notice={n.id} onClick={() => onOpen(n)}
                className={cx(`k-${n.kind}`, "border-t border-line cursor-pointer transition-colors scroll-mt-40",
                  selId === n.id ? "bg-brand-soft/60" : "hover:bg-surface-2/70", (u === "closed" || d === "비추") && "opacity-60")}>
                <td className="py-2.5 pl-4">
                  <span className={cx("font-bold tnum", URG[u])}>{ddayLabel(n)}</span>
                  <span className="block text-[11px] text-faint tnum">{n.deadline?.slice(5).replace("-", ".")}</span>
                </td>
                <td className="py-2.5"><KindBadge kind={n.kind} /></td>
                <td className="py-2.5 pr-3 min-w-0">
                  <span className="font-semibold line-clamp-1">
                    {!state.seen[n.id] && u !== "closed" && <span className="inline-block size-1.5 rounded-full bg-seal mr-1.5 align-middle" />}
                    {n.title}
                  </span>
                  <span className="block text-[12px] text-mute truncate">{n.org}{n.region && n.region !== "전국" ? ` · ${n.region}` : ""}{d ? ` · 내 결정: ${d}` : ""}</span>
                </td>
                <td className="py-2.5 pr-3 text-[12px] text-ink/80 tnum"><span className="line-clamp-2">{periodText(n)}</span></td>
                <td className="py-2.5">
                  <span className="flex gap-1">
                    {n.analysis?.verdicts.map((v) => (
                      <span key={v.entityId} title={`${entities.find((e) => e.id === v.entityId)?.name}`}
                        className={cx(`v-${v.status}`, "rounded px-1.5 py-0.5 text-[11px] font-semibold bg-[var(--vs)] text-[var(--v)]")}>
                        {entities.find((e) => e.id === v.entityId)?.short}
                      </span>
                    )) ?? <span className="text-faint text-[12px]">—</span>}
                  </span>
                </td>
                <td className="py-2.5 text-right tnum font-bold">{fit ?? <span className="text-faint font-normal">—</span>}</td>
                <td className="py-2.5 pr-2 text-right">
                  <button aria-label={starred ? "저장 취소" : "저장"} onClick={(e) => { e.stopPropagation(); toggleStar(n.id); }}
                    className={cx("size-8 inline-grid place-items-center rounded-md", starred ? "text-amber" : "text-faint hover:text-ink")}>
                    <Star size={16} fill={starred ? "currentColor" : "none"} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PosterCard({ n, onOpen }: { n: Notice; onOpen(): void }) {
  const { state, toggleStar } = useApp();
  const starred = !!state.starred[n.id];
  const decision = state.decisions[n.id];
  const u = urgency(n);
  return (
    <article data-notice={n.id} className={cx(`k-${n.kind}`, "group relative cursor-pointer", u === "closed" && "opacity-60")} onClick={onOpen}>
      <div className="relative aspect-[3/4] rounded-xl overflow-hidden border border-line shadow-card transition-transform md:group-hover:-translate-y-0.5"
        style={{ background: n.thumb ? undefined : `linear-gradient(160deg, ${n.posterColor ?? "#2d6e66"}, color-mix(in oklab, ${n.posterColor ?? "#2d6e66"} 55%, #000))` }}>
        {n.thumb ? (
          <img src={n.thumb} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="absolute inset-0 p-3 md:p-3.5 flex flex-col text-white">
            <svg className="absolute right-0 top-0 w-2/3 opacity-20" viewBox="0 0 100 100" aria-hidden>
              <circle cx="70" cy="30" r="28" fill="none" stroke="white" strokeWidth="1.2" />
              <circle cx="70" cy="30" r="18" fill="none" stroke="white" strokeWidth="1.2" />
              <circle cx="70" cy="30" r="8" fill="white" />
            </svg>
            <span className="text-[10.5px] font-semibold tracking-wide opacity-85 mt-8 truncate">{n.org}</span>
            <span className="font-serif font-bold text-[14px] md:text-[16px] leading-snug mt-1.5 line-clamp-5">{n.title}</span>
            <span className="mt-auto text-[10.5px] opacity-80 tnum">{n.deadline ? `~ ${n.deadline.replaceAll("-", ".")}` : n.deadlineLabel}</span>
          </div>
        )}
        <span className={cx("absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[12px] font-bold tnum shadow-card",
          u === "urgent" || u === "today" ? "bg-seal text-white" : "bg-white/95 text-[#1b2322]")}>{ddayLabel(n)}</span>
        <button aria-label={starred ? "저장 취소" : "저장"} aria-pressed={starred}
          onClick={(e) => { e.stopPropagation(); toggleStar(n.id); }}
          className={cx("absolute right-1.5 top-1.5 size-9 grid place-items-center rounded-full bg-black/25 backdrop-blur-sm", starred ? "text-amber-300" : "text-white")}>
          <Star size={16} fill={starred ? "currentColor" : "none"} />
        </button>
        {decision && <div className="absolute right-2 bottom-2"><Stamp d={decision} small /></div>}
      </div>
      <div className="mt-2 px-0.5">
        <div className="flex items-center gap-1.5"><KindBadge kind={n.kind} />{n.sources.includes("IG") && <SourceBadge s="IG" />}</div>
        <p className="text-[13px] font-semibold leading-snug mt-1 line-clamp-2">{n.title}</p>
      </div>
    </article>
  );
}
