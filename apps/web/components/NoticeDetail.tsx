"use client";
import { useState } from "react";
import {
  ArrowLeft, PenLine, CalendarClock, CircleAlert, Copy, ExternalLink, MessageSquare, Sparkles, Star, Trash2, X,
} from "lucide-react";
import {
  daysLeft, ddayLabel, DECISIONS, fitTotal, formatKDate, matchedKeywords, mentionsActivityRule, noticePlace, placeLabel, regionFit, urgency, VERDICT_LABEL, type Analysis, type Notice,
} from "@muse/core";
import { useApp } from "@/lib/store";
import { analyzePrompt, draftStarter, parseAIJson } from "@/lib/prompts";
import { CHAT_URL, usePref, type ChatAI } from "@/lib/prefs";
import { Button, cx, GradeBadge, IconButton, KindBadge, Sheet, SourceBadge, Tip, VerdictPill } from "./ui";
import { FilesSection } from "./FilesSection";
import { KeywordChips, KgoBadge, periodText, RegionBadge } from "./NoticeCard";
import { detailRows } from "./meta";

function Section({ title, tip, children }: { title: string; tip?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="py-5 border-t border-line first:border-t-0">
      <h3 className="text-[13px] font-bold text-mute mb-3 flex items-center gap-1">{title}{tip && <Tip>{tip}</Tip>}</h3>
      {children}
    </section>
  );
}

const FIT_ROWS: [keyof NonNullable<Analysis["fit"]>, string, number][] = [
  ["eligibility", "지원 자격 충족", 40], ["purpose", "사업 목적 일치", 30], ["capacity", "역량·실적", 20], ["scale", "지원 규모 적정성", 10],
];

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export function NoticeDetail({ n, onClose, mode }: { n: Notice; onClose(): void; mode: "panel" | "page" }) {
  const { platformsOf, state, toggleStar, setDecision, remove, entities, toast, updateNotice, notices, setStage, keywords } = useApp();
  const kws = matchedKeywords(n, keywords.include);
  const [ai] = usePref<ChatAI>("mg-chat-ai", "Claude");
  const [manual, setManual] = useState(false);
  const starred = !!state.starred[n.id];
  const decision = state.decisions[n.id];
  const u = urgency(n);
  const left = daysLeft(n.deadline);
  const fit = fitTotal(n);
  const rows = detailRows(n).filter(([, v]) => v);
  const place = noticePlace(n);
  const rfits = place && place !== "전국" ? entities.map((e) => ({ e, f: regionFit(n, e, place) })).filter((x) => x.f) : [];
  const support = n.venue?.supportLink ? notices.find((x) => x.id === n.venue!.supportLink) : undefined;

  const startDraft = async () => {
    const ok = await copy(draftStarter(n, entities, ai));
    toast(ok ? `시작 문장을 복사했어요. ${ai}에 붙여넣으세요` : "복사가 막혀 있어요. 브라우저 권한을 확인해 주세요");
    if (!state.stages[n.id] || state.stages[n.id] === "관심") setStage(n.id, "초안");
    if (ok) window.open(CHAT_URL[ai], "_blank", "noopener");
  };

  // 초안을 시작하면 ★ 저장 (마감 뒤 자동 정리에서 빠지도록)
  const toggleStarIfNeeded = () => { if (!state.starred[n.id]) toggleStar(n.id); };
  void startDraft; // 예전 '대화로 쓰기' (초안 편집기 안의 AI 왕복으로 대체)
  const primary: { label: string; icon: React.ReactNode; run(): void } | null =
    (n.kind === "grant" || n.kind === "residency" || n.kind === "service") && n.deadlineLabel !== "예정" ? { label: "초안 쓰기", icon: <PenLine size={16} />, run: () => { toggleStarIfNeeded(); window.location.href = `/draft?n=${encodeURIComponent(n.id)}`; } }
    : n.kind === "grant" ? { label: "미리 준비", icon: <CalendarClock size={16} />, run: () => { setStage(n.id, "준비"); toast("미리 준비 목록에 넣었어요"); } }
    : n.kind === "edu" ? { label: "신청하러 가기", icon: <ExternalLink size={16} />, run: () => { setStage(n.id, "준비"); window.open(n.url, "_blank", "noopener"); } }
    : n.kind === "venue" ? { label: "대관 신청 페이지", icon: <ExternalLink size={16} />, run: () => { setStage(n.id, "준비"); window.open(n.url, "_blank", "noopener"); } }
    : { label: "제안 준비 시작", icon: <Sparkles size={16} />, run: () => { setStage(n.id, "준비"); toast("지원 관리에 '준비'로 넣었어요"); } };

  return (
    <div className={cx(`k-${n.kind}`, "relative flex flex-col h-full")}>
      {/* 헤더 */}
      <div className={cx("sticky top-0 z-10 bg-surface/95 backdrop-blur flex items-center gap-1 px-2 h-14 border-b border-line", mode === "panel" && "lg:px-4")}>
        {mode === "page" ? (
          <IconButton label="뒤로" onClick={onClose}><ArrowLeft size={20} /></IconButton>
        ) : null}
        <div className="flex items-center gap-1.5 flex-1 min-w-0 px-1">
          <KindBadge kind={n.kind} />
          {n.sources.map((s) => <SourceBadge key={s} s={s} />)}
        </div>
        {mode === "panel" && (
          <IconButton label={starred ? "저장 취소" : "저장"} onClick={() => toggleStar(n.id)} className={starred ? "text-amber" : ""}>
            <Star size={19} fill={starred ? "currentColor" : "none"} />
          </IconButton>
        )}
        <IconButton label="이 공고 삭제 (다시 수집돼도 안 보임)" className="hover:text-seal" onClick={() => { remove(n.id); toast("삭제했어요. 설정 → 삭제한 공고에서 복원할 수 있어요"); onClose(); }}><Trash2 size={18} /></IconButton>
        {mode === "panel" && <IconButton label="닫기" onClick={onClose}><X size={19} /></IconButton>}
      </div>

      <div className={cx("flex-1 overflow-y-auto px-5 lg:px-6", mode === "page" ? "pb-32" : "pb-10")}>
        {/* 제목 */}
        <div className="pt-5 pb-4">
          <h2 className="text-[20px] lg:text-[22px] font-bold leading-snug">{n.title}</h2>
          <p className="text-[14px] text-mute mt-1.5">{n.org}{n.region && !n.overseas ? ` · ${n.region}` : ""}</p>
          <div className="mt-4 flex items-stretch gap-3">
            <div className={cx("rounded-xl px-4 py-2.5 border", u === "urgent" || u === "today" ? "border-seal/40 bg-seal-soft" : "border-line bg-surface-2")}>
              <div className={cx("text-[22px] font-bold tnum leading-none", (u === "urgent" || u === "today") && "text-seal")}>{ddayLabel(n)}</div>
              <div className="text-[12px] text-mute mt-1">{n.deadline ? `${formatKDate(n.deadline)} 마감` : n.lastYear ?? n.deadlineLabel}</div>
            </div>
            <div className="flex-1 min-w-0 rounded-xl border border-line px-4 py-2.5 text-[12.5px] text-mute flex flex-col justify-center gap-0.5">
              <span className="text-ink font-medium tnum">접수 {periodText(n)}</span>
              {n.postedAt && <span className="tnum">게시 {formatKDate(n.postedAt)}</span>}
              <span className="tnum">확인 {formatKDate(n.checkedAt)}</span>
            </div>
          </div>
        </div>

        {n.needsReview && (
          <div className="mb-4 rounded-xl bg-amber-soft text-amber p-3.5 text-[13px] flex gap-2.5">
            <CircleAlert size={17} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <b>포스터에서 뽑은 정보예요.</b> 기관·마감일이 맞는지 한 번 확인해 주세요.
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="default" onClick={() => { updateNotice(n.id, { needsReview: false }); toast("확인했어요"); }}>맞아요</Button>
                <Button size="sm" variant="ghost" onClick={() => toast("수정 기능은 PC 앱에서 제공돼요")}>수정할게요</Button>
              </div>
            </div>
          </div>
        )}

        {/* 주요 행동 — PC 패널에서는 위에, 휴대폰에서는 아래 고정 막대 */}
        {mode === "panel" && (
          <div className="flex flex-wrap gap-2 mb-2">
            {primary && <Button variant="primary" onClick={primary.run}>{primary.icon} {primary.label}</Button>}
            <a href={n.url} target="_blank" rel="noopener noreferrer"><Button><ExternalLink size={16} /> 원문 열기</Button></a>
            {n.applyUrl && n.applyUrl !== n.url && <a href={n.applyUrl} target="_blank" rel="noopener noreferrer"><Button><ExternalLink size={16} /> 신청 사이트</Button></a>}
          </div>
        )}
        {kws.length > 0 && <div className="mt-3 flex items-center gap-2"><span className="text-[12.5px] text-mute whitespace-nowrap">내 키워드</span><KeywordChips words={kws} /></div>}

        {/* 결정 도장 */}
        <div className="flex items-center gap-2 mt-4 mb-1">
          <span className="text-[12.5px] text-mute shrink-0 flex items-center gap-0.5">내 결정 <Tip>AI 추천과 별개로 내가 찍는 도장이에요. 도장을 찍으면 자동으로 저장되고, 쓸수록 추천이 나에게 맞춰져요.</Tip></span>
          <div className="flex gap-1.5 flex-wrap">
            {DECISIONS.map((d) => (
              <button key={d} aria-pressed={decision === d} onClick={() => setDecision(n.id, decision === d ? undefined : d)}
                className={cx("h-8 px-3 rounded-full text-[13px] font-semibold border transition-colors",
                  decision === d
                    ? d === "강추" ? "bg-seal text-white border-seal" : d === "지원" ? "bg-brand text-white border-brand dark:text-[#0f1413]" : d === "보류" ? "bg-amber text-white border-amber dark:text-[#0f1413]" : "bg-faint text-white border-faint"
                    : "border-line-strong text-mute hover:text-ink hover:border-ink")}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {n.summary && <Section title="요약"><p className="text-[14.5px] leading-relaxed">{n.summary}</p></Section>}

        {rows.length > 0 && (
          <Section title="핵심 정보">
            <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2.5 text-[14px]">
              {rows.map(([k, v]) => (<div key={k} className="contents"><dt className="text-mute">{k}</dt><dd className="font-medium">{v}</dd></div>))}
            </dl>
          </Section>
        )}

        <FilesSection n={n} Section={Section} />

        {rfits.length > 0 && place && place !== "전국" && (
          <Section title="지역 조건" tip={<>지역문화재단 공고는 &lsquo;OO 거주자&rsquo; 조건이 많아요. 조건이 달라도 숨기지 않고 표시만 해요 — 이사를 고려할 때 참고하세요.<br />거주하지 않아도 &lsquo;N년 이상·N회 이상 활동&rsquo;이면 가능한 사업도 있으니 원문 자격 요건을 꼭 확인하세요.</>}>
            <p className="text-[13px] text-mute mb-2.5">이 공고의 지역: <b className="text-ink">{placeLabel(place)}</b>{mentionsActivityRule(n) && <span> · 본문에 <b className="text-ink">활동 이력</b> 조건이 언급돼요</span>}</p>
            <div className="space-y-2">
              {rfits.map(({ e, f }) => (
                <div key={e.id} className="rounded-xl border border-line p-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold text-[14px] flex-1 min-w-0 truncate">{e.name}</span>
                  <RegionBadge fit={f!} long />
                  {f!.note && <p className="basis-full text-[12.5px] text-mute">{f!.note}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {platformsOf(n.id).length > 0 && (
          <Section title="K-arts on the GO 플랫폼" tip="한국국제문화교류진흥원이 선정한 해외 우수 플랫폼(페스티벌·극장·미술관) 디렉토리예요. 이 플랫폼에 초청받으면 K-GO 공모로 초청 공연·전시 경비 지원을 신청할 수 있어요. 지원 조건과 일정은 K-GO 공고에서 확인하세요.">
            <div className="space-y-2">
              {platformsOf(n.id).map((p) => (
                <div key={p.id} className="rounded-xl border border-line p-3 text-[13.5px]">
                  <div className="flex items-center gap-2"><KgoBadge /><b className="truncate">{p.name}</b></div>
                  <p className="text-mute mt-1">{[p.nameEn, p.type, [p.country, p.city].filter(Boolean).join(" "), p.field + "예술"].filter(Boolean).join(" · ")}</p>
                  <div className="flex gap-3 mt-1.5 text-[13px] font-semibold text-brand-ink">
                    {p.homepage && <a href={p.homepage} target="_blank" rel="noopener noreferrer">플랫폼 홈페이지 ↗</a>}
                    <a href="https://www.k-go.or.kr/notice" target="_blank" rel="noopener noreferrer">K-GO 공모 보기 ↗</a>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {support && (
          <Section title="이 대관에 쓸 수 있는 지원">
            <div className="rounded-xl border border-line p-3.5 flex items-center gap-3">
              <KindBadge kind={support.kind} />
              <div className="flex-1 min-w-0"><p className="font-semibold text-[14px] truncate">{support.title}</p><p className="text-[12.5px] text-mute">{support.grant?.amount} · {ddayLabel(support)}</p></div>
            </div>
          </Section>
        )}

        {/* 판정 */}
        {n.analysis ? (
          <>
            <Section title="주체별 판정" tip={<>🟢 지금 지원 가능 · 🟡 준비하면 가능 · 🔵 간접 참여(파트너·협력으로 참여) · 🔴 불가.<br />부족한 서류는 준비 기간을 함께 보여드려요.</>}>
              <div className="space-y-3">
                {n.analysis.verdicts.map((v) => {
                  const e = entities.find((x) => x.id === v.entityId);
                  return (
                    <div key={v.entityId} className="rounded-xl border border-line p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[14px]">{e?.name ?? v.entityId}</span>
                        <VerdictPill status={v.status} long />
                      </div>
                      {v.reason && <p className="text-[13px] text-mute mt-1.5">{v.reason}</p>}
                      {v.gaps && v.gaps.length > 0 && (
                        <ul className="mt-2.5 space-y-1.5">
                          {v.gaps.map((g, i) => {
                            const late = g.days !== undefined && left !== null && g.days > left;
                            return (
                              <li key={i} className="flex items-start gap-2 text-[13px]">
                                <input type="checkbox" className="mt-0.5 accent-[var(--brand)]" aria-label={g.item} />
                                <span className="flex-1"><b className="font-semibold">{g.item}</b> <span className="text-mute">— {g.how}</span></span>
                                {g.days !== undefined && <span className={cx("tnum text-[12px] shrink-0", late ? "text-seal font-bold" : "text-mute")}>약 {g.days}일{late && " · 마감보다 김"}</span>}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>

            {n.analysis.fit && fit !== undefined && (
              <Section title="적합도" tip="자격 40 · 목적 일치 30 · 역량·실적 20 · 지원 규모 10점으로 채점해요. 자격이 안 되면 30점 이하예요.">
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-[30px] font-bold tnum leading-none">{fit}</span><span className="text-mute text-sm">/ 100</span>
                  {n.analysis.grade && <span className="ml-1"><GradeBadge grade={n.analysis.grade} /></span>}
                </div>
                <div className="space-y-2">
                  {FIT_ROWS.map(([k, label, max]) => (
                    <div key={k} className="grid grid-cols-[104px_1fr_48px] items-center gap-2 text-[13px]">
                      <span className="text-mute">{label}</span>
                      <span className="h-2 rounded-full bg-surface-2 overflow-hidden"><span className="block h-full rounded-full bg-brand" style={{ width: `${(n.analysis!.fit![k] / max) * 100}%` }} /></span>
                      <span className="tnum text-right font-semibold">{n.analysis!.fit![k]}<span className="text-faint font-normal">/{max}</span></span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {(n.analysis.pros?.length || n.analysis.cons?.length || n.analysis.opinion) && (
              <Section title="의견">
                {n.analysis.opinion && <p className="text-[14.5px] leading-relaxed rounded-xl bg-brand-soft/60 p-3.5 mb-3">{n.analysis.opinion}</p>}
                <div className="grid sm:grid-cols-2 gap-3">
                  {!!n.analysis.pros?.length && (
                    <div><p className="text-[12.5px] font-bold text-brand mb-1.5">맞는 점</p>
                      <ul className="space-y-1 text-[13.5px] list-disc pl-4 marker:text-brand">{n.analysis.pros.map((p, i) => <li key={i}>{p}</li>)}</ul></div>
                  )}
                  {!!n.analysis.cons?.length && (
                    <div><p className="text-[12.5px] font-bold text-amber mb-1.5">주의할 점</p>
                      <ul className="space-y-1 text-[13.5px] list-disc pl-4 marker:text-amber">{n.analysis.cons.map((p, i) => <li key={i}>{p}</li>)}</ul></div>
                  )}
                </div>
                <p className="text-[12px] text-faint mt-3">{n.analysis.by === "api" ? "API로 분석" : n.analysis.by === "manual" ? "대화로 분석 (결과 붙여넣기)" : "규칙으로 판정"} · AI는 틀릴 수 있어요. 지원 전 원문을 꼭 확인하세요.</p>
              </Section>
            )}
            {n.analysis.by === "rule" && n.kind === "grant" && (
              <div className="pt-1"><Button size="sm" variant="soft" onClick={() => setManual(true)}><Sparkles size={14} /> 적합도까지 자세히 분석</Button></div>
            )}
          </>
        ) : n.kind === "grant" && n.deadlineLabel !== "예정" ? (
          <Section title="판정">
            <div className="rounded-xl border border-dashed border-line-strong p-4 text-center">
              <p className="text-[14px] font-semibold">아직 분석 전이에요</p>
              <p className="text-[13px] text-mute mt-1">자격 판정과 적합도 점수를 받아볼 수 있어요.</p>
              <div className="mt-3 flex justify-center gap-2 flex-wrap">
                <Button size="sm" variant="primary" onClick={() => setManual(true)}><Sparkles size={14} /> 분석하기</Button>
              </div>
            </div>
          </Section>
        ) : null}

        <p className="text-[12px] text-faint pt-6">출처: {n.sources.join(", ")} · <a className="underline" href={n.url} target="_blank" rel="noopener noreferrer">{n.url.replace(/^https?:\/\//, "")}</a></p>
      </div>
      {mode === "page" && (
        <div className="absolute inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 backdrop-blur px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] flex gap-2">
          <button aria-label={starred ? "저장 취소" : "저장"} aria-pressed={starred} onClick={() => toggleStar(n.id)}
            className={cx("size-12 shrink-0 rounded-xl border grid place-items-center", starred ? "border-amber bg-amber-soft text-amber" : "border-line-strong text-mute")}>
            <Star size={21} fill={starred ? "currentColor" : "none"} />
          </button>
          <a href={n.url} target="_blank" rel="noopener noreferrer" className="shrink-0"><Button className="h-12 px-4"><ExternalLink size={17} /> 원문</Button></a>
          {primary && <Button variant="primary" className="h-12 flex-1 text-[15px]" onClick={primary.run}>{primary.icon} {primary.label}</Button>}
        </div>
      )}
      <ManualAnalyze open={manual} onClose={() => setManual(false)} n={n} ai={ai} />
    </div>
  );
}

function ManualAnalyze({ open, onClose, n, ai }: { open: boolean; onClose(): void; n: Notice; ai: ChatAI }) {
  const { entities, updateNotice, toast } = useApp();
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const prompt = analyzePrompt(n, entities);
  return (
    <Sheet open={open} onClose={onClose} title="대화로 분석하기 (무료)" wide>
      <ol className="space-y-4 text-[14px]">
        <li>
          <p className="font-semibold mb-2">① 분석 요청문을 복사해서 {ai}에 붙여넣으세요</p>
          <pre className="max-h-40 overflow-auto rounded-xl bg-surface-2 p-3 text-[12px] whitespace-pre-wrap text-mute">{prompt}</pre>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={async () => toast((await copy(prompt)) ? "복사했어요" : "복사가 막혀 있어요")}><Copy size={14} /> 복사</Button>
            <a href={CHAT_URL[ai]} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="ghost"><ExternalLink size={14} /> {ai} 열기</Button></a>
          </div>
        </li>
        <li>
          <p className="font-semibold mb-2 flex items-center gap-1">② 답변 전체를 복사해서 여기에 붙여넣으세요 <Tip>답변을 통째로 붙여넣어도 앱이 결과 부분만 찾아서 카드에 넣어요.</Tip></p>
          <textarea value={text} onChange={(e) => { setText(e.target.value); setErr(null); }} rows={6} placeholder="AI 답변 붙여넣기"
            className="w-full rounded-xl border border-line-strong bg-surface p-3 text-[13px] focus:outline-none focus:border-brand" />
          {err && <p className="text-[13px] text-seal mt-1.5">{err}</p>}
        </li>
      </ol>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="ghost" onClick={onClose}>취소</Button>
        <Button variant="primary" disabled={!text.trim()} onClick={() => {
          try {
            const r = parseAIJson(text);
            if (!Array.isArray(r.verdicts)) throw new Error("판정(verdicts)이 없어요. 요청문을 그대로 붙여넣었는지 확인해 주세요.");
            updateNotice(n.id, { analysis: { ...r, by: "manual", analyzedAt: new Date().toISOString().slice(0, 10) } });
            toast("분석 결과를 반영했어요"); setText(""); onClose();
          } catch (e) { setErr((e as Error).message); }
        }}>결과 반영</Button>
      </div>
    </Sheet>
  );
}

export { VERDICT_LABEL };
