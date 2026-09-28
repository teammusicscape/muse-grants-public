"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown, ArrowLeft, ArrowUp, Check, ChevronDown, CircleAlert, ClipboardList, Copy, Download, ExternalLink, FileText, History,
  ListTree, MoreHorizontal, PenLine, Plus, Sparkles, Trash2, Undo2, X,
} from "lucide-react";
import {
  charCount, ddayLabel, DEFAULT_OUTLINE, newSections, RESIDENCY_OUTLINE, splitDraft, todoItems, uid,
  type Draft, type DraftSection, type DraftVersion, type Entity, type Notice,
} from "@muse/core";
import { useApp } from "@/lib/store";
import { listVersions, saveVersion, useDraft } from "@/lib/drafts";
import { setGuestMode } from "@/lib/drafts";
import { fullDraftPrompt, outlinePrompt, parseAIJson, SECTION_ASK, sectionPrompt, type SectionAsk } from "@/lib/prompts";
import { draftText, exportDocx } from "@/lib/exportDocx";
import { AIRoundTrip } from "@/components/AIRoundTrip";
import { periodText } from "@/components/NoticeCard";
import { Button, cx, Empty, KindBadge, Sheet, Tip } from "@/components/ui";

type SetDraft = (d: Draft, immediate?: boolean) => void;

/* ─────────── 시작 화면: 주체·목차 고르기 ─────────── */
function Setup({ n, onCreate }: { n: Notice; onCreate(d: Draft, openOutline: boolean): void }) {
  const { entities } = useApp();
  const residency = n.kind === "residency" || /레지던|residen/i.test(n.title);
  const [ent, setEnt] = useState(() => n.analysis?.verdicts.find((v) => v.status === "now")?.entityId ?? entities[0]?.id ?? "");
  const [outline, setOutline] = useState<"default" | "residency" | "form">(n.files?.length ? "form" : residency ? "residency" : "default");
  const [memo, setMemo] = useState("");
  const opt = (k: typeof outline, t: string, d: string) => (
    <button onClick={() => setOutline(k)} aria-pressed={outline === k}
      className={cx("text-left rounded-xl border p-3.5 transition-colors", outline === k ? "border-brand bg-brand-soft/50" : "border-line hover:border-line-strong")}>
      <p className="font-semibold text-[14.5px]">{t}</p><p className="text-[12.5px] text-mute mt-0.5">{d}</p>
    </button>
  );
  const create = () => {
    const now = new Date().toISOString();
    const gaps = n.analysis?.verdicts.find((v) => v.entityId === ent)?.gaps ?? [];
    onCreate({
      id: uid() + uid(), noticeId: n.id, noticeTitle: n.title, entityId: ent,
      sections: newSections(outline === "residency" ? RESIDENCY_OUTLINE : DEFAULT_OUTLINE),
      criteria: [], checklist: gaps.map((g) => ({ id: uid(), text: `${g.item} — ${g.how}` })),
      memo, createdAt: now, updatedAt: now,
    }, outline === "form");
  };
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <p className="text-[13px] font-bold text-mute mb-2">① 누구 이름으로 내나요?</p>
        {entities.length ? (
          <div className="flex flex-wrap gap-2">{entities.map((e) => (
            <button key={e.id} onClick={() => setEnt(e.id)} className={cx("h-10 px-4 rounded-full border text-[14px] font-semibold", ent === e.id ? "border-brand bg-brand-soft text-brand-ink" : "border-line-strong text-mute")}>{e.name}</button>
          ))}</div>
        ) : <p className="text-[13.5px] text-mute">설정에서 지원 주체를 먼저 추가해 주세요.</p>}
        {entities.find((e) => e.id === ent) && !entities.find((e) => e.id === ent)!.profile?.works?.length && (
          <p className="mt-2 text-[13px] rounded-lg bg-amber-soft text-amber p-2.5">프로필(대표 작업·경력)이 비어 있어요. <Link className="font-bold underline" href={`/profile?e=${ent}`}>프로필을 먼저 채우면</Link> 초안이 훨씬 구체적이에요.</p>
        )}
      </div>
      <div>
        <p className="text-[13px] font-bold text-mute mb-2">② 목차</p>
        <div className="grid gap-2">
          {opt("form", "양식에서 목차 가져오기 (추천)", n.files?.length ? "첨부된 공고문·신청서 양식을 AI에게 보여주고 작성 항목·글자 수·심사 기준을 뽑아요. 기본 목차로 시작한 뒤 바로 가져오기 화면이 열려요." : "공고 원문에서 양식을 받아 AI에게 보여주면 작성 항목을 뽑아요.")}
          {opt("residency", "레지던시·교류 기본 목차", "신청자 소개 · 참가 동기 · 활동 계획 · 현지 연계 · 기대효과 · 예산")}
          {opt("default", "지원사업 기본 목차", "사업 개요 · 역량 · 배경 · 목표 · 추진 내용 · 일정 · 예산 · 기대효과 · 지속 계획")}
        </div>
      </div>
      <div>
        <p className="text-[13px] font-bold text-mute mb-2">③ 방향 메모 <span className="font-normal">(선택)</span></p>
        <textarea rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예) 해외 공연 경험을 중심으로, 네트워킹 후 공동 제작으로 잇는 계획"
          className="w-full rounded-xl border border-line-strong bg-surface p-3 text-[14px] focus:outline-none focus:border-brand" />
      </div>
      <Button variant="primary" className="w-full h-12" disabled={!ent} onClick={create}><PenLine size={17} /> 초안 시작하기</Button>
    </div>
  );
}

/* ─────────── 항목 하나 ─────────── */
function SectionEditor({ s, i, total, onChange, onMove, onRemove, onAsk }: {
  s: DraftSection; i: number; total: number; onChange(p: Partial<DraftSection>): void; onMove(d: -1 | 1): void; onRemove(): void; onAsk(a: SectionAsk): void;
}) {
  const [menu, setMenu] = useState<"ai" | "more" | null>(null);
  const [prev, setPrev] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const c = charCount(s.content);
  const todos = todoItems(s.content);
  const over = !!s.limit && c.withSpace > s.limit;
  useEffect(() => { const t = ref.current; if (t) { t.style.height = "auto"; t.style.height = Math.max(140, t.scrollHeight + 2) + "px"; } }, [s.content]);
  // 바깥(AI 붙여넣기)에서 내용이 바뀌면 되돌리기 한 단계 기억
  const last = useRef(s.content);
  useEffect(() => { if (document.activeElement !== ref.current && last.current !== s.content && last.current.trim()) setPrev(last.current); last.current = s.content; }, [s.content]);

  return (
    <section id={`sec-${s.id}`} className="scroll-mt-24 rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex items-start gap-2 px-4 pt-3.5">
        <span className="tnum text-[13px] font-bold text-faint mt-1.5 w-5 shrink-0">{i + 1}</span>
        <div className="flex-1 min-w-0">
          <input value={s.title} onChange={(e) => onChange({ title: e.target.value })} aria-label="항목 제목"
            className="w-full bg-transparent text-[16px] font-bold focus:outline-none focus:bg-surface-2 rounded px-1 -mx-1" />
          {s.guide && <p className="text-[12.5px] text-mute mt-0.5">{s.guide}</p>}
        </div>
        <div className="relative flex items-center gap-1 shrink-0">
          <button onClick={() => setMenu(menu === "ai" ? null : "ai")} className="h-8 px-2.5 rounded-lg text-[12.5px] font-semibold inline-flex items-center gap-1 bg-brand-soft text-brand-ink hover:brightness-95"><Sparkles size={14} />AI<ChevronDown size={13} /></button>
          <button onClick={() => setMenu(menu === "more" ? null : "more")} aria-label="항목 메뉴" className="size-8 grid place-items-center rounded-lg text-mute hover:bg-surface-2"><MoreHorizontal size={17} /></button>
          {menu && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenu(null)} />
              <div className="absolute right-0 top-9 z-30 w-52 rounded-xl border border-line bg-surface shadow-pop p-1.5 text-[13.5px]">
                {menu === "ai" ? SECTION_ASK.map(([k, l]) => (
                  <button key={k} className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-surface-2" onClick={() => { setMenu(null); onAsk(k); }}>{l}</button>
                )) : (
                  <>
                    <label className="flex items-center gap-2 px-2.5 py-1.5">글자 수 제한
                      <input type="number" min={0} step={50} value={s.limit ?? ""} onChange={(e) => onChange({ limit: e.target.value ? +e.target.value : undefined })} className="w-20 h-8 rounded-md border border-line-strong px-2 text-[13px] bg-surface" /></label>
                    <button className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-surface-2" onClick={() => { const g = window.prompt("항목 안내 (무엇을 쓰는 칸인지)", s.guide ?? ""); if (g !== null) onChange({ guide: g }); setMenu(null); }}>안내 문구 고치기</button>
                    <button disabled={i === 0} className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-surface-2 disabled:opacity-40 flex items-center gap-2" onClick={() => { onMove(-1); setMenu(null); }}><ArrowUp size={14} />위로</button>
                    <button disabled={i === total - 1} className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-surface-2 disabled:opacity-40 flex items-center gap-2" onClick={() => { onMove(1); setMenu(null); }}><ArrowDown size={14} />아래로</button>
                    <button className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-seal-soft text-seal flex items-center gap-2" onClick={() => { if (!s.content.trim() || confirm(`'${s.title}' 항목을 지울까요?`)) onRemove(); setMenu(null); }}><Trash2 size={14} />항목 삭제</button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="px-4 pt-2 pb-3">
        <textarea ref={ref} value={s.content} onChange={(e) => onChange({ content: e.target.value })} placeholder="직접 쓰거나, 위의 ✦ AI 로 쓰기를 부탁하세요"
          className="w-full resize-none rounded-xl border border-line bg-bg/40 p-3.5 text-[15px] leading-[1.75] focus:outline-none focus:border-brand focus:bg-surface" />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[12px]">
          <span className={cx("tnum font-semibold", over ? "text-seal" : "text-mute")}>{c.withSpace.toLocaleString()}{s.limit ? ` / ${s.limit.toLocaleString()}자` : "자"}</span>
          <span className="tnum text-faint">공백 제외 {c.noSpace.toLocaleString()}</span>
          {s.limit ? <span className="flex-1 max-w-40 h-1.5 rounded-full bg-surface-2 overflow-hidden"><span className={cx("block h-full rounded-full", over ? "bg-seal" : "bg-brand")} style={{ width: `${Math.min(100, (c.withSpace / s.limit) * 100)}%` }} /></span> : null}
          {todos.length > 0 && <span className="text-amber font-semibold flex items-center gap-1"><CircleAlert size={13} />확인 필요 {todos.length}</span>}
          {prev !== null && <button className="ml-auto text-mute hover:text-ink inline-flex items-center gap-1" onClick={() => { onChange({ content: prev }); setPrev(null); }}><Undo2 size={13} />이전 내용으로</button>}
        </div>
      </div>
    </section>
  );
}

/* ─────────── 오른쪽: 자료 · 할 일 ─────────── */
function SidePanel({ n, d, set }: { n: Notice; d: Draft; set: SetDraft }) {
  const { savedFiles } = useApp();
  const mine = savedFiles.filter((f) => f.noticeId === n.id);
  const todos = d.sections.flatMap((s) => todoItems(s.content).map((t) => ({ s, t })));
  const [newCheck, setNewCheck] = useState("");
  const [newCrit, setNewCrit] = useState("");
  const H = ({ children, tip }: { children: React.ReactNode; tip?: string }) => <h3 className="text-[12.5px] font-bold text-mute mb-2 flex items-center gap-1">{children}{tip && <Tip>{tip}</Tip>}</h3>;
  return (
    <div className="space-y-6 text-[13.5px]">
      <div>
        <H>공고</H>
        <div className="rounded-xl border border-line p-3">
          <div className="flex items-center gap-2"><KindBadge kind={n.kind} /><span className="font-bold tnum text-seal">{ddayLabel(n)}</span></div>
          <p className="font-semibold mt-1.5 leading-snug">{n.title}</p>
          <p className="text-mute text-[12.5px] mt-0.5">{n.org} · 접수 {periodText(n)}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[12.5px] font-semibold text-brand-ink">
            {n.url && <a href={n.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">원문 <ExternalLink size={12} /></a>}
            {n.applyUrl && <a href={n.applyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">신청 사이트 <ExternalLink size={12} /></a>}
          </div>
        </div>
      </div>
      {(n.files?.length || mine.length) ? (
        <div>
          <H tip="AI에게 초안을 부탁할 때 이 파일들을 대화창에 함께 첨부하면 양식·심사 기준을 반영해요.">공고문 · 양식</H>
          <ul className="space-y-1">
            {(n.files ?? []).map((f) => <li key={f.url}><a href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:underline"><FileText size={14} className="text-faint shrink-0" /><span className="truncate">{f.name}</span></a></li>)}
            {mine.map((f) => <li key={f.id} className="flex items-center gap-1.5 text-mute"><FileText size={14} className="text-faint shrink-0" /><span className="truncate">{f.name}</span><span className="text-[11px] shrink-0">보관함</span></li>)}
          </ul>
        </div>
      ) : null}
      <div>
        <H tip="양식에서 뽑거나 직접 적어 두면 AI 초안에 반영돼요.">심사 기준</H>
        {d.criteria.length > 0 && <ul className="space-y-1 mb-2">{d.criteria.map((c, i) => (
          <li key={i} className="flex items-start gap-1.5 group"><span className="text-faint">·</span><span className="flex-1">{c}</span>
            <button className="opacity-0 group-hover:opacity-100 text-faint hover:text-seal" aria-label="삭제" onClick={() => set({ ...d, criteria: d.criteria.filter((_, j) => j !== i) })}><X size={13} /></button></li>
        ))}</ul>}
        <input value={newCrit} onChange={(e) => setNewCrit(e.target.value)} placeholder="+ 심사 기준 추가 (Enter)"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && newCrit.trim()) { set({ ...d, criteria: [...d.criteria, newCrit.trim()] }); setNewCrit(""); } }}
          className="w-full h-9 rounded-lg border border-dashed border-line-strong bg-transparent px-2.5 text-[13px] focus:outline-none focus:border-brand" />
      </div>
      <div>
        <H tip="초안 속 [확인 필요: …] 표시를 모았어요. 눌러서 그 항목으로 이동해요.">채워야 할 정보 {todos.length > 0 && <span className="tnum text-amber">{todos.length}</span>}</H>
        {todos.length ? <ul className="space-y-1">{todos.map(({ s, t }, i) => (
          <li key={i}><button className="text-left w-full rounded-lg px-2 py-1.5 bg-amber-soft/60 hover:bg-amber-soft" onClick={() => document.getElementById(`sec-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            <span className="font-medium">{t}</span> <span className="text-[11.5px] text-mute">· {s.title}</span></button></li>
        ))}</ul> : <p className="text-mute text-[13px]">없어요 👍</p>}
      </div>
      <div>
        <H>제출 서류 체크리스트</H>
        <ul className="space-y-1 mb-2">{d.checklist.map((c) => (
          <li key={c.id} className="flex items-start gap-2 group">
            <input type="checkbox" checked={!!c.done} onChange={() => set({ ...d, checklist: d.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) })} className="mt-1 accent-[var(--brand)]" />
            <span className={cx("flex-1", c.done && "line-through text-faint")}>{c.text}</span>
            <button className="opacity-0 group-hover:opacity-100 text-faint hover:text-seal" aria-label="삭제" onClick={() => set({ ...d, checklist: d.checklist.filter((x) => x.id !== c.id) })}><X size={13} /></button>
          </li>
        ))}</ul>
        <input value={newCheck} onChange={(e) => setNewCheck(e.target.value)} placeholder="+ 서류 추가 (Enter)"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && newCheck.trim()) { set({ ...d, checklist: [...d.checklist, { id: uid(), text: newCheck.trim() }] }); setNewCheck(""); } }}
          className="w-full h-9 rounded-lg border border-dashed border-line-strong bg-transparent px-2.5 text-[13px] focus:outline-none focus:border-brand" />
      </div>
      <div>
        <H tip="AI에게 매번 함께 전달돼요.">방향 메모</H>
        <textarea rows={3} value={d.memo ?? ""} onChange={(e) => set({ ...d, memo: e.target.value })} className="w-full rounded-lg border border-line bg-surface p-2.5 text-[13px] focus:outline-none focus:border-brand" placeholder="강조할 점, 피할 표현…" />
      </div>
    </div>
  );
}

/* ─────────── AI 전체 초안 → 항목별로 나눠 넣기 ─────────── */
function FullDraftSheet({ open, onClose, n, e, d, set }: { open: boolean; onClose(): void; n: Notice; e?: Entity; d: Draft; set: SetDraft }) {
  const { toast } = useApp();
  const [blocks, setBlocks] = useState<{ sectionId: string | null; title: string; content: string; use: boolean }[] | null>(null);
  useEffect(() => { if (!open) setBlocks(null); }, [open]);
  const apply = async () => {
    if (!blocks) return;
    await saveVersion(d, "AI 초안 넣기 전");
    let secs = [...d.sections];
    for (const b of blocks.filter((x) => x.use && x.content.trim())) {
      if (b.sectionId) secs = secs.map((s) => (s.id === b.sectionId ? { ...s, content: b.content } : s));
      else if (/채워야\s*할\s*정보/.test(b.title)) continue; // 앱이 [확인 필요]로 따로 모음
      else secs.push({ id: uid(), title: b.title, content: b.content });
    }
    set({ ...d, sections: secs }, true);
    toast("초안을 항목별로 넣었어요 · 이전 내용은 '버전'에 있어요");
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="AI와 전체 초안 쓰기" wide>
      {!blocks ? (
        <AIRoundTrip
          prompt={() => fullDraftPrompt(n, e, d)}
          hint={<>대화창에 <b>공고문·신청서 양식</b>을 첨부하면 더 정확해요{n.files?.length ? <> — {n.files.map((f, i) => <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" className="underline font-semibold">{i ? ", " : ""}{f.name.slice(0, 24)}</a>)}</> : null}. 이미 쓴 내용은 살려서 다듬어 달라고 함께 보내요.</>}
          pasteLabel="AI가 쓴 초안 붙여넣기" applyLabel="항목별로 나눠 보기"
          onApply={(t) => {
            const r = splitDraft(t, d.sections);
            if (!r.length) return "나눌 내용을 찾지 못했어요. 답변 전체를 붙여넣었는지 확인해 주세요.";
            setBlocks(r.map((b) => ({ ...b, use: !!b.sectionId || (!!b.title && b.title !== "(제목 없음)" && !/채워야\s*할\s*정보/.test(b.title)) })));
            return null;
          }}
        />
      ) : (
        <div>
          <p className="text-[13.5px] text-mute mb-3">나눈 결과예요. 넣을 칸을 확인하고 적용하세요. <b>지금 내용은 버전으로 저장</b>된 뒤 바뀌어요.</p>
          <ul className="space-y-2">
            {blocks.map((b, i) => (
              <li key={i} className={cx("rounded-xl border p-3", b.use ? "border-line" : "border-line opacity-50")}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={b.use} onChange={() => setBlocks(blocks.map((x, j) => (j === i ? { ...x, use: !x.use } : x)))} className="accent-[var(--brand)]" />
                  <span className="text-[12.5px] text-mute truncate flex-1">{b.title}</span>
                  <select value={b.sectionId ?? ""} onChange={(x) => setBlocks(blocks.map((y, j) => (j === i ? { ...y, sectionId: x.target.value || null } : y)))}
                    className="h-8 max-w-[45%] rounded-md border border-line-strong bg-surface px-1.5 text-[12.5px]">
                    <option value="">→ 새 항목으로</option>
                    {d.sections.map((s, k) => <option key={s.id} value={s.id}>→ {k + 1}. {s.title}</option>)}
                  </select>
                </div>
                <p className="text-[13px] mt-1.5 line-clamp-3 whitespace-pre-line">{b.content || "(내용 없음)"}</p>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 mt-4 sticky bottom-0 bg-surface pt-2">
            <Button variant="ghost" onClick={() => setBlocks(null)}>다시 붙여넣기</Button>
            <div className="flex-1" />
            <Button variant="primary" onClick={apply}><Check size={16} /> {blocks.filter((b) => b.use).length}개 적용</Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/* ─────────── 편집기 ─────────── */
function Editor({ n, d, set, status, flush, startOutline }: { n: Notice; d: Draft; set: SetDraft; status: string; flush(): Promise<void>; startOutline?: boolean }) {
  const { entities, toast, setStage, state } = useApp();
  const e = entities.find((x) => x.id === d.entityId);
  const [full, setFull] = useState(false);
  const [outline, setOutline] = useState(!!startOutline);
  const [ask, setAsk] = useState<{ s: DraftSection; a: SectionAsk } | null>(null);
  const [custom, setCustom] = useState("");
  const [vers, setVers] = useState<DraftVersion[] | null>(null);
  const [exp, setExp] = useState(false);
  const [tab, setTab] = useState<"write" | "side">("write");
  const upd = (id: string, p: Partial<DraftSection>) => set({ ...d, sections: d.sections.map((s) => (s.id === id ? { ...s, ...p } : s)) });
  const total = useMemo(() => d.sections.reduce((a, s) => a + charCount(s.content).withSpace, 0), [d.sections]);
  const todoN = useMemo(() => d.sections.reduce((a, s) => a + todoItems(s.content).length, 0), [d.sections]);
  const doneN = d.sections.filter((s) => s.content.trim()).length;

  useEffect(() => { if (!state.stages[n.id] || state.stages[n.id] === "관심" || state.stages[n.id] === "준비") setStage(n.id, "초안"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const statusText = { saved: "저장됨", saving: "저장 중…", dirty: "입력 중", error: "저장 실패" }[status] ?? "";
  const toc = (
    <nav className="space-y-0.5 text-[13.5px]">
      {d.sections.map((s, i) => {
        const c = charCount(s.content).withSpace;
        const t = todoItems(s.content).length;
        return (
          <button key={s.id} onClick={() => document.getElementById(`sec-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-surface-2 flex items-center gap-2">
            <span className={cx("size-2 rounded-full shrink-0", !c ? "bg-line-strong" : s.limit && c > s.limit ? "bg-seal" : t ? "bg-amber" : "bg-[var(--v-now)]")} />
            <span className="flex-1 truncate">{i + 1}. {s.title}</span>
            <span className="tnum text-[11.5px] text-faint">{c ? c.toLocaleString() : ""}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="lg:grid lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_320px] min-h-dvh">
      {/* 목차 (PC) */}
      <aside className="hidden lg:block sticky top-0 h-dvh overflow-y-auto border-r border-line px-3 py-5">
        <p className="px-2.5 text-[12px] font-bold text-mute mb-2">목차 · {doneN}/{d.sections.length}</p>
        {toc}
        <div className="px-2.5 mt-4 space-y-2">
          <Button size="sm" variant="ghost" className="w-full justify-start" onClick={() => setOutline(true)}><ListTree size={15} /> 양식에서 목차 가져오기</Button>
          <Button size="sm" variant="ghost" className="w-full justify-start" onClick={() => set({ ...d, sections: [...d.sections, { id: uid(), title: "새 항목", content: "" }] })}><Plus size={15} /> 항목 추가</Button>
        </div>
      </aside>

      <main className="min-w-0">
        {/* 상단 막대 */}
        <header className="sticky top-0 z-30 bg-bg/92 backdrop-blur-md border-b border-line/70">
          <div className="flex items-center gap-2 px-3 lg:px-6 h-14">
            <Link href={`/?n=${n.id}`} onClick={() => void flush()} className="size-10 grid place-items-center rounded-lg hover:bg-surface-2 shrink-0" aria-label="공고로"><ArrowLeft size={20} /></Link>
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-bold truncate">{d.noticeTitle}</p>
              <p className="text-[12px] text-mute truncate tnum">{e?.name ?? "주체 미선택"} · {ddayLabel(n)} · 총 {total.toLocaleString()}자{todoN ? ` · 확인 필요 ${todoN}` : ""} · <span className={status === "error" ? "text-seal font-semibold" : ""}>{statusText}</span></p>
            </div>
            <Button size="sm" variant="ghost" className="hidden sm:inline-flex" onClick={async () => setVers(await listVersions(d.id))}><History size={15} /> 버전</Button>
            <div className="relative">
              <Button size="sm" variant="ghost" onClick={() => setExp(!exp)}><Download size={15} /><span className="hidden sm:inline"> 내보내기</span></Button>
              {exp && (<>
                <div className="fixed inset-0 z-20" onClick={() => setExp(false)} />
                <div className="absolute right-0 top-10 z-30 w-56 rounded-xl border border-line bg-surface shadow-pop p-1.5 text-[13.5px]">
                  <button className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-surface-2 flex items-center gap-2" onClick={async () => { setExp(false); await exportDocx(d, e?.name ?? ""); }}><FileText size={15} /> Word(.docx)로 받기</button>
                  <button className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-surface-2 flex items-center gap-2" onClick={async () => { setExp(false); try { await navigator.clipboard.writeText(draftText(d)); toast("전체 초안을 복사했어요 (한글 양식에 붙여넣기)"); } catch { toast("복사가 막혀 있어요"); } }}><Copy size={15} /> 전체 텍스트 복사</button>
                  <button className="sm:hidden w-full text-left px-2.5 py-2 rounded-lg hover:bg-surface-2 flex items-center gap-2" onClick={async () => { setExp(false); setVers(await listVersions(d.id)); }}><History size={15} /> 버전 기록</button>
                  <button className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-surface-2 flex items-center gap-2" onClick={async () => { const note = window.prompt("버전 메모", "직접 저장"); setExp(false); if (note === null) return; await saveVersion(d, note || "직접 저장"); toast("버전을 저장했어요"); }}><Check size={15} /> 지금 버전 저장</button>
                </div>
              </>)}
            </div>
            <Button size="sm" variant="primary" onClick={() => setFull(true)}><Sparkles size={15} /><span className="hidden sm:inline"> AI와 전체 초안</span><span className="sm:hidden"> AI</span></Button>
          </div>
          <div className="xl:hidden flex gap-1 px-3 pb-2">
            {([["write", "작성"], ["side", `자료 · 할 일${todoN ? ` ${todoN}` : ""}`]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={cx("h-8 px-3.5 rounded-full text-[13px] font-semibold", tab === k ? "bg-ink text-bg" : "text-mute")}>{l}</button>
            ))}
          </div>
        </header>

        <div className="px-3 lg:px-6 py-5 max-w-3xl mx-auto">
          {tab === "side" ? (
            <div className="xl:hidden"><SidePanel n={n} d={d} set={set} /></div>
          ) : (
            <div className="space-y-4">
              {!d.sections.some((s) => s.content.trim()) && (
                <div className="rounded-2xl border border-brand/30 bg-brand-soft/50 p-4 text-[13.5px]">
                  <p className="font-bold text-[14.5px] mb-1">시작하는 법</p>
                  <ol className="list-decimal pl-5 space-y-0.5 text-mute">
                    <li><button className="font-semibold text-brand-ink underline" onClick={() => setOutline(true)}>양식에서 목차 가져오기</button> — 공고 양식의 작성 항목·글자 수로 칸을 맞춰요</li>
                    <li><button className="font-semibold text-brand-ink underline" onClick={() => setFull(true)}>AI와 전체 초안</button> — 답변을 붙여넣으면 항목별로 나눠 들어가요</li>
                    <li>항목마다 <b>✦ AI</b>로 다시 쓰기·줄이기, 직접 고치기 → Word로 내보내기</li>
                  </ol>
                </div>
              )}
              {d.sections.map((s, i) => (
                <SectionEditor key={s.id} s={s} i={i} total={d.sections.length}
                  onChange={(p) => upd(s.id, p)}
                  onMove={(dir) => { const a = [...d.sections]; const j = i + dir; [a[i], a[j]] = [a[j], a[i]]; set({ ...d, sections: a }); }}
                  onRemove={() => set({ ...d, sections: d.sections.filter((x) => x.id !== s.id) })}
                  onAsk={(a) => { setCustom(""); setAsk({ s, a }); }} />
              ))}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => set({ ...d, sections: [...d.sections, { id: uid(), title: "새 항목", content: "" }] })}><Plus size={15} /> 항목 추가</Button>
                <Button variant="ghost" className="lg:hidden" onClick={() => setOutline(true)}><ListTree size={15} /> 양식에서 목차 가져오기</Button>
              </div>
            </div>
          )}
        </div>
      </main>

      <aside className="hidden xl:block sticky top-0 h-dvh overflow-y-auto border-l border-line bg-surface px-4 py-5"><SidePanel n={n} d={d} set={set} /></aside>

      <FullDraftSheet open={full} onClose={() => setFull(false)} n={n} e={e} d={d} set={set} />

      <Sheet open={outline} onClose={() => setOutline(false)} title="양식에서 목차 가져오기" wide>
        <AIRoundTrip
          prompt={() => outlinePrompt(n)}
          hint={<>대화창에 <b>신청서 양식·공고문 파일</b>을 첨부해 주세요{n.files?.length ? <> ({n.files.map((f, i) => <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" className="underline font-semibold">{i ? ", " : ""}{f.name.slice(0, 26)}</a>)})</> : null}. 작성 항목·글자 수·심사 기준·제출 서류를 뽑아 와요.</>}
          applyLabel="목차 바꾸기"
          onApply={async (t) => {
            try {
              const j = parseAIJson(t) as { sections?: { title: string; guide?: string; limit?: number }[]; criteria?: string[]; checklist?: string[] };
              if (!j.sections?.length) return "작성 항목(sections)을 찾지 못했어요.";
              if (d.sections.some((s) => s.content.trim())) await saveVersion(d, "목차 바꾸기 전");
              // 제목이 같은 칸은 쓴 내용을 이어받음
              const secs = j.sections.map((x) => {
                const same = d.sections.find((s) => s.title.replace(/\s/g, "") === x.title.replace(/\s/g, ""));
                return { id: same?.id ?? uid(), title: x.title, guide: x.guide || undefined, limit: x.limit || undefined, content: same?.content ?? "" };
              });
              const leftover = d.sections.filter((s) => s.content.trim() && !secs.some((x) => x.id === s.id));
              set({
                ...d,
                sections: [...secs, ...leftover.map((s) => ({ ...s, title: `(이전) ${s.title}` }))],
                criteria: [...new Set([...d.criteria, ...(j.criteria ?? [])])],
                checklist: [...d.checklist, ...(j.checklist ?? []).filter((c) => !d.checklist.some((x) => x.text === c)).map((c) => ({ id: uid(), text: c }))],
              }, true);
              setOutline(false);
              toast(`목차 ${secs.length}개로 맞췄어요${leftover.length ? ` · 쓴 내용이 있던 ${leftover.length}개는 '(이전)'으로 남겨 뒀어요` : ""}`);
              return null;
            } catch (x) { return (x as Error).message; }
          }}
        />
      </Sheet>

      <Sheet open={!!ask} onClose={() => setAsk(null)} title={ask ? `${ask.s.title} · ${SECTION_ASK.find(([k]) => k === ask.a)?.[1]}` : ""} wide>
        {ask && (
          <AIRoundTrip
            prompt={() => sectionPrompt(n, e, d, d.sections.find((x) => x.id === ask.s.id) ?? ask.s, ask.a, custom)}
            hint={<>같은 대화창에 이어서 붙여넣어도 되고, 새 대화에서 해도 돼요.</>}
            extra={ask.a === "custom" ? <input value={custom} onChange={(x) => setCustom(x.target.value)} placeholder="예) 지역 연계 부분을 강조하고 표로 정리해 줘"
              className="mt-2 w-full h-10 rounded-lg border border-line-strong bg-surface px-3 text-[14px] focus:outline-none focus:border-brand" /> : undefined}
            pasteLabel="AI가 쓴 내용 붙여넣기" applyLabel="이 항목에 넣기"
            onApply={(t) => {
              const clean = t.trim().replace(/^#{1,4}\s.*\n+/, "");
              upd(ask.s.id, { content: clean });
              setAsk(null);
              toast("넣었어요 · 항목 아래 '이전 내용으로'로 되돌릴 수 있어요");
              return null;
            }}
          />
        )}
      </Sheet>

      <Sheet open={!!vers} onClose={() => setVers(null)} title="초안 버전">
        {vers?.length ? (
          <ul className="divide-y divide-line">
            {vers.map((v) => (
              <li key={v.id} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[14px] truncate">{v.note || "버전"}</p>
                  <p className="text-[12px] text-faint tnum">{new Date(v.createdAt).toLocaleString("ko-KR")} · {v.sections.reduce((a, s) => a + charCount(s.content).withSpace, 0).toLocaleString()}자</p>
                </div>
                <Button size="sm" onClick={async () => { await saveVersion(d, "되돌리기 전"); set({ ...d, sections: v.sections }, true); setVers(null); toast("그 버전으로 되돌렸어요"); }}>되돌리기</Button>
              </li>
            ))}
          </ul>
        ) : <p className="text-[14px] text-mute py-6 text-center">아직 저장된 버전이 없어요. AI 초안을 넣거나 목차를 바꾸면 자동으로 저장돼요.</p>}
      </Sheet>
    </div>
  );
}

function DraftPage() {
  const q = useSearchParams();
  const router = useRouter();
  const id = q.get("n");
  const { notices, ready, guest } = useApp();
  setGuestMode(guest);
  const n = notices.find((x) => x.id === id);
  const { draft, setDraft, loading, status, flush } = useDraft(ready ? id : null);
  const [startOutline, setStartOutline] = useState(false);
  const notice: Notice | undefined = n ?? (draft ? { id: draft.noticeId, kind: "grant", title: draft.noticeTitle, org: "", sources: [], url: "", fields: [], tags: [], deadline: null, checkedAt: "" } : undefined);

  if (!ready || loading) return <div className="p-10 text-center text-mute text-[14px]">불러오는 중…</div>;
  if (!notice) return <div className="max-w-xl mx-auto p-6"><Empty icon={<ClipboardList size={28} />} title="공고를 찾지 못했어요" desc="삭제됐거나 목록에서 정리된 공고예요." action={<Button onClick={() => router.push("/")}>공고로</Button>} /></div>;
  if (!draft) {
    return (
      <div className="px-4 py-6 lg:py-10">
        <div className="max-w-xl mx-auto mb-6 flex items-start gap-2">
          <Link href={`/?n=${notice.id}`} className="size-10 grid place-items-center rounded-lg hover:bg-surface-2 shrink-0" aria-label="공고로"><ArrowLeft size={20} /></Link>
          <div><p className="text-[13px] text-mute">초안 시작</p><h1 className="text-[19px] font-bold leading-snug">{notice.title}</h1></div>
        </div>
        <Setup n={notice} onCreate={(d, o) => { setStartOutline(o); setDraft(d, true); }} />
      </div>
    );
  }
  return <Editor n={notice} d={draft} set={setDraft} status={status} flush={flush} startOutline={startOutline} />;
}

export default function Page() {
  return <Suspense><DraftPage /></Suspense>;
}
