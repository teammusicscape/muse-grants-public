"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, SquareKanban } from "lucide-react";
import { ddayLabel, EDU_STAGES, STAGES, urgency, type Notice, type Stage } from "@muse/core";
import { useApp } from "@/lib/store";
import { Button, cx, Empty, KindBadge, PageTitle } from "@/components/ui";
import { DetailOverlay } from "@/components/DetailOverlay";
import Link from "next/link";

const COLS: Stage[] = ["관심", "준비", "초안", "제출"];

function Item({ n, stage }: { n: Notice; stage: Stage }) {
  const { setStage, savedFiles } = useApp();
  const nFiles = savedFiles.filter((f) => f.noticeId === n.id).length;
  const i = STAGES.indexOf(stage);
  const u = urgency(n);
  const label = (s: Stage) => (n.kind === "edu" ? EDU_STAGES[s] : s);
  return (
    <div className={cx(`k-${n.kind}`, "rounded-xl border border-line bg-surface p-3 shadow-card")}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <KindBadge kind={n.kind} />
        <span className={cx("tnum text-[12.5px] font-bold", (u === "urgent" || u === "today") && "text-seal")}>{ddayLabel(n)}</span>
      </div>
      <p className="text-[14px] font-semibold leading-snug line-clamp-2" data-open={n.id}>{n.title}</p>
      <p className="text-[12.5px] text-mute mt-0.5 truncate">{n.org}{nFiles > 0 && <span className="ml-1.5 text-brand-ink font-semibold">📎 {nFiles}</span>}</p>
      {(n.kind === "grant" || n.kind === "residency" || n.kind === "service") && i >= 1 && i <= 3 && (
        <Link href={`/draft?n=${encodeURIComponent(n.id)}`} className="mt-2 inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-brand-soft text-brand-ink text-[12.5px] font-semibold">✎ 초안 {stage === "준비" ? "시작" : "열기"}</Link>
      )}
      <div className="flex items-center justify-between mt-2.5 -mx-1">
        <button aria-label="이전 단계" disabled={i <= 0} onClick={() => setStage(n.id, STAGES[i - 1])} className="size-7 grid place-items-center rounded-md text-mute hover:bg-surface-2 disabled:opacity-30"><ChevronLeft size={16} /></button>
        <select aria-label="단계" value={stage} onChange={(e) => setStage(n.id, e.target.value as Stage)} className="h-7 rounded-md bg-surface-2 px-1.5 text-[12.5px] font-medium">
          {STAGES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        <button aria-label="다음 단계" disabled={i >= 3} onClick={() => setStage(n.id, STAGES[i + 1])} className="size-7 grid place-items-center rounded-md text-mute hover:bg-surface-2 disabled:opacity-30"><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

export default function ApplicationsPage() {
  const { notices, state } = useApp();
  const [mobileCol, setMobileCol] = useState<Stage>("준비");
  const [sel, setSel] = useState<Notice | null>(null);
  const withStage = notices.map((n) => [n, state.stages[n.id]] as const).filter(([, s]) => s) as [Notice, Stage][];
  const col = (s: Stage) => withStage.filter(([, x]) => x === s).map(([n]) => n);
  const won = col("선정").length, lost = col("탈락").length, submitted = col("제출").length + won + lost;
  const stats = [
    { label: "진행 중", v: COLS.reduce((a, s) => a + col(s).length, 0) },
    { label: "제출", v: submitted },
    { label: "선정", v: won },
    { label: "선정률", v: won + lost ? `${Math.round((won / (won + lost)) * 100)}%` : "-" },
  ];
  const onClick = (e: React.MouseEvent) => {
    const id = (e.target as HTMLElement).closest("[data-open]")?.getAttribute("data-open");
    if (id) setSel(notices.find((n) => n.id === id) ?? null);
  };

  return (
    <main className="px-4 sm:px-6 lg:px-10 pt-5 lg:pt-9 pb-10" onClick={onClick}>
      <PageTitle title="지원 관리" sub="관심 → 준비 → 초안 → 제출 → 결과" />
      <div className="grid grid-cols-4 gap-2 mb-6 max-w-2xl">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-line bg-surface px-3 py-2.5">
            <div className="font-serif text-[22px] font-bold tnum leading-tight">{s.v}</div>
            <div className="text-[12px] text-mute">{s.label}</div>
          </div>
        ))}
      </div>

      {withStage.length === 0 ? (
        <Empty icon={<SquareKanban size={30} />} title="아직 진행 중인 지원이 없어요" desc="공고에서 ★를 누르거나 '지원' 도장을 찍으면 여기에 모여요."
          action={<Link href="/"><Button variant="primary">공고 보러 가기</Button></Link>} />
      ) : (
        <>
          {/* 모바일: 단계 탭 */}
          <div className="lg:hidden">
            <div className="flex gap-1 overflow-x-auto scrollbar-none mb-3">
              {[...COLS, "선정" as Stage, "탈락" as Stage].map((s) => (
                <button key={s} onClick={() => setMobileCol(s)} aria-pressed={mobileCol === s}
                  className={cx("shrink-0 h-9 px-3.5 rounded-full text-[13.5px] font-semibold", mobileCol === s ? "bg-ink text-bg" : "bg-surface-2 text-mute")}>
                  {s} <span className="tnum opacity-70">{col(s).length}</span>
                </button>
              ))}
            </div>
            <div className="space-y-2.5">
              {col(mobileCol).map((n) => <Item key={n.id} n={n} stage={mobileCol} />)}
              {col(mobileCol).length === 0 && <p className="text-sm text-mute text-center py-10">이 단계에 있는 공고가 없어요</p>}
            </div>
          </div>
          {/* PC: 칸반 */}
          <div className="hidden lg:grid grid-cols-5 gap-3 items-start">
            {COLS.map((s) => (
              <section key={s} className="rounded-2xl bg-surface-2/70 p-2.5 min-h-40">
                <h2 className="px-1.5 pb-2 text-[13px] font-bold flex items-center justify-between">{s}<span className="tnum text-faint font-medium">{col(s).length}</span></h2>
                <div className="space-y-2">{col(s).map((n) => <Item key={n.id} n={n} stage={s} />)}</div>
              </section>
            ))}
            <section className="rounded-2xl bg-surface-2/70 p-2.5 min-h-40">
              <h2 className="px-1.5 pb-2 text-[13px] font-bold flex items-center justify-between">결과<span className="tnum text-faint font-medium">{won + lost}</span></h2>
              <div className="space-y-2">
                {col("선정").map((n) => <Item key={n.id} n={n} stage="선정" />)}
                {col("탈락").map((n) => <Item key={n.id} n={n} stage="탈락" />)}
              </div>
            </section>
          </div>
        </>
      )}
      <DetailOverlay n={sel} onClose={() => setSel(null)} />
    </main>
  );
}
