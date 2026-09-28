"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, History, Plus, Sparkles, Trash2, X } from "lucide-react";
import { charCount, mergeProfile, uid, type Entity, type Profile, type ProfileItem } from "@muse/core";
import { useApp } from "@/lib/store";
import { parseAIJson, profilePrompt } from "@/lib/prompts";
import { listProfileVersions, saveProfileVersion, type ProfileVersion } from "@/lib/drafts";
import { setGuestMode } from "@/lib/drafts";
import { AIRoundTrip } from "@/components/AIRoundTrip";
import { Button, cx, Empty, Sheet, Tip } from "@/components/ui";

const LISTS: { key: "works" | "career" | "awards" | "residencies" | "education"; label: string; ph: string; tip: string }[] = [
  { key: "works", label: "대표 작업", ph: "작업·공연·전시명", tip: "지원서 '역량' 항목의 핵심이에요. 최신순, 장소·역할을 함께 적어 두세요." },
  { key: "awards", label: "수상 · 선정 · 지원 이력", ph: "사업·상 이름", tip: "선정된 지원사업은 '수행 역량'의 근거가 돼요." },
  { key: "residencies", label: "레지던시 · 국제 교류", ph: "레지던시·페스티벌", tip: "해외 레지던시·교류 공모에서 특히 중요해요." },
  { key: "career", label: "경력 · 직책", ph: "직함·기관", tip: "강의·음악감독·대표 등" },
  { key: "education", label: "학력", ph: "학교·학위", tip: "" },
];

const inp = "h-10 rounded-lg border border-line-strong bg-surface px-2.5 text-[14px] focus:outline-none focus:border-brand min-w-0";

function ItemList({ items, onChange, ph }: { items: ProfileItem[]; onChange(x: ProfileItem[]): void; ph: string }) {
  const set = (i: number, p: Partial<ProfileItem>) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <div className="space-y-2">
      {items.map((x, i) => (
        <div key={x.id} className="grid grid-cols-[88px_1fr_auto] sm:grid-cols-[96px_1fr_1fr_auto] gap-1.5 items-start">
          <input className={inp} value={x.year ?? ""} onChange={(e) => set(i, { year: e.target.value })} placeholder="연도" aria-label="연도" />
          <input className={inp} value={x.title} onChange={(e) => set(i, { title: e.target.value })} placeholder={ph} aria-label="제목" />
          <input className={cx(inp, "col-span-3 sm:col-span-1 row-start-2 sm:row-start-auto col-start-1 sm:col-start-auto")} value={x.detail ?? ""} onChange={(e) => set(i, { detail: e.target.value })} placeholder="장소·역할·기관 (선택)" aria-label="설명" />
          <button className="size-10 grid place-items-center rounded-lg text-faint hover:text-seal hover:bg-surface-2 row-start-1 col-start-3 sm:col-start-4" aria-label="삭제" onClick={() => onChange(items.filter((_, j) => j !== i))}><X size={16} /></button>
        </div>
      ))}
      <button className="h-9 px-3 rounded-lg border border-dashed border-line-strong text-[13px] text-mute hover:text-ink hover:border-ink inline-flex items-center gap-1"
        onClick={() => onChange([{ id: uid(), title: "" }, ...items])}><Plus size={14} /> 추가</button>
    </div>
  );
}

function Card({ title, tip, right, children }: { title: string; tip?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-card">
      <div className="flex items-center gap-1 mb-3"><h2 className="text-[15px] font-bold">{title}</h2>{tip && <Tip>{tip}</Tip>}<div className="ml-auto">{right}</div></div>
      {children}
    </section>
  );
}

function ProfileEditor({ e }: { e: Entity }) {
  const { saveEntity, toast } = useApp();
  const [p, setP] = useState<Profile>(e.profile ?? {});
  const [fill, setFill] = useState(false);
  const [pasted, setPasted] = useState("");
  const [vers, setVers] = useState<ProfileVersion[] | null>(null);
  useEffect(() => setP(e.profile ?? {}), [e.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // 고칠 때마다 계정 설정에 저장 (설정 저장이 0.7초 모아서 올림)
  const upd = (np: Profile) => { setP(np); saveEntity({ ...e, profile: { ...np, updatedAt: new Date().toISOString() } }); };
  const person = e.type === "개인 예술가";
  const filled = useMemo(() => {
    const checks = [p.headline, p.bio, p.genres?.length, p.works?.length, p.awards?.length || p.residencies?.length, p.career?.length || p.education?.length];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [p]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-brand/30 bg-brand-soft/50 p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px]">
          <p className="font-bold text-[15px] flex items-center gap-1.5"><Sparkles size={16} className="text-brand" /> 문서·웹사이트로 자동 채우기</p>
          <p className="text-[13px] text-mute mt-0.5">소개서·이전 지원서·포트폴리오를 AI 대화창에 올리거나 홈페이지 글을 붙여넣으면, 빈칸을 채워요. 있는 내용은 지우지 않아요.</p>
        </div>
        <Button variant="primary" onClick={() => setFill(true)}><Sparkles size={15} /> 자동 채우기</Button>
      </div>

      <div className="flex items-center gap-3 text-[13px] text-mute">
        <span className="flex-1 h-2 rounded-full bg-surface-2 overflow-hidden"><span className="block h-full bg-brand rounded-full transition-all" style={{ width: `${filled}%` }} /></span>
        <span className="tnum shrink-0">채움 {filled}%</span>
        <Button size="sm" variant="ghost" onClick={async () => { const note = window.prompt("이번 버전 메모 (예: 2026 하반기 작업 추가)", ""); if (note === null) return; await saveProfileVersion(e.id, p, note || "수동 저장"); toast("버전을 저장했어요"); }}>버전 저장</Button>
        <Button size="sm" variant="ghost" onClick={async () => setVers(await listProfileVersions(e.id))}><History size={14} /> 기록</Button>
      </div>

      <Card title="소개" tip="지원서 '신청자 소개' 칸의 바탕이 돼요. 3인칭으로 쓰면 여러 공고에 바로 쓰기 좋아요.">
        <label className="block text-[13px] font-semibold mb-1.5">한 줄 소개</label>
        <input className={cx(inp, "w-full h-11 text-[15px]")} value={p.headline ?? ""} onChange={(x) => upd({ ...p, headline: x.target.value })} placeholder="예) 사운드스케이프 기반 공연을 만드는 작곡가·음악감독" />
        <label className="block text-[13px] font-semibold mt-4 mb-1.5">분야 · 매체</label>
        <div className="flex flex-wrap gap-1.5 items-center">
          {(p.genres ?? []).map((g) => (
            <span key={g} className="inline-flex items-center gap-1 h-8 pl-3 pr-1.5 rounded-full bg-brand-soft text-brand-ink text-[13px] font-medium">{g}
              <button aria-label={`${g} 삭제`} className="size-5 grid place-items-center rounded-full hover:bg-black/10" onClick={() => upd({ ...p, genres: p.genres!.filter((x) => x !== g) })}><X size={12} /></button></span>
          ))}
          <input className="h-8 w-40 rounded-full border border-dashed border-line-strong px-3 text-[13px] bg-transparent focus:outline-none focus:border-brand" placeholder="+ 추가 후 Enter"
            onKeyDown={(x) => { const t = x.currentTarget.value.trim(); if (x.key === "Enter" && !x.nativeEvent.isComposing && t) { x.preventDefault(); upd({ ...p, genres: [...new Set([...(p.genres ?? []), t])] }); x.currentTarget.value = ""; } }} />
        </div>
        <label className="block text-[13px] font-semibold mt-4 mb-1.5">소개문 <span className="font-normal text-faint tnum ml-1">{charCount(p.bio ?? "").withSpace}자</span></label>
        <textarea rows={6} className="w-full rounded-xl border border-line-strong bg-surface p-3 text-[14.5px] leading-relaxed focus:outline-none focus:border-brand" value={p.bio ?? ""} onChange={(x) => upd({ ...p, bio: x.target.value })} placeholder="300~600자 소개문" />
      </Card>

      {LISTS.map((l) => (
        <Card key={l.key} title={l.label} tip={l.tip || undefined} right={<span className="text-[12.5px] text-faint tnum">{p[l.key]?.length ?? 0}</span>}>
          <ItemList items={p[l.key] ?? []} ph={l.ph} onChange={(x) => upd({ ...p, [l.key]: x })} />
        </Card>
      ))}

      {!person && (
        <Card title="구성원 · 역할" tip="단체 지원서의 '수행 인력' 칸에 쓰여요.">
          <textarea rows={4} className="w-full rounded-xl border border-line-strong bg-surface p-3 text-[14px] focus:outline-none focus:border-brand" value={p.members ?? ""} onChange={(x) => upd({ ...p, members: x.target.value })} placeholder="예) 홍길동 — 대표·음악감독 / ○○○ — 영상" />
        </Card>
      )}

      <Card title="링크" tip="홈페이지·포트폴리오·영상 링크. 지원서의 참고자료 칸에 넣기 좋아요.">
        <div className="space-y-2">
          {(p.links ?? []).map((l, i) => (
            <div key={i} className="grid grid-cols-[110px_1fr_auto] gap-1.5">
              <input className={inp} value={l.label} onChange={(x) => upd({ ...p, links: p.links!.map((y, j) => (j === i ? { ...y, label: x.target.value } : y)) })} placeholder="이름" />
              <input className={inp} value={l.url} onChange={(x) => upd({ ...p, links: p.links!.map((y, j) => (j === i ? { ...y, url: x.target.value } : y)) })} placeholder="https://" />
              <button className="size-10 grid place-items-center rounded-lg text-faint hover:text-seal" aria-label="삭제" onClick={() => upd({ ...p, links: p.links!.filter((_, j) => j !== i) })}><Trash2 size={15} /></button>
            </div>
          ))}
          <button className="h-9 px-3 rounded-lg border border-dashed border-line-strong text-[13px] text-mute hover:text-ink inline-flex items-center gap-1" onClick={() => upd({ ...p, links: [...(p.links ?? []), { label: "", url: "" }] })}><Plus size={14} /> 링크 추가</button>
        </div>
      </Card>

      <Card title="AI에게 알려 둘 점" tip="초안을 쓸 때마다 함께 전달돼요. 강조하고 싶은 정체성, 피하고 싶은 표현, 문체 등.">
        <textarea rows={3} className="w-full rounded-xl border border-line-strong bg-surface p-3 text-[14px] focus:outline-none focus:border-brand" value={p.notes ?? ""} onChange={(x) => upd({ ...p, notes: x.target.value })} placeholder="예) '융복합'보다 '사운드스케이프·공간 청취'라는 말을 써 주세요. 과장 없이 담백하게." />
      </Card>

      <Sheet open={fill} onClose={() => setFill(false)} title={`${e.short || e.name} 프로필 자동 채우기`} wide>
        <AIRoundTrip
          prompt={() => profilePrompt({ ...e, profile: p }, pasted)}
          hint={<>대화창에 <b>소개서·이력서·이전 지원서·포트폴리오</b> 파일을 첨부해서 보내세요. 홈페이지 글은 아래에 붙여넣으면 프롬프트에 함께 들어가요.</>}
          extra={<textarea value={pasted} onChange={(x) => setPasted(x.target.value)} rows={4} placeholder="(선택) 홈페이지 소개·이력 글 붙여넣기"
            className="mt-2 w-full rounded-xl border border-line bg-surface-2/60 p-3 text-[13.5px] focus:outline-none focus:border-brand" />}
          applyLabel="프로필에 합치기"
          onApply={async (t) => {
            try {
              const add = parseAIJson(t) as Profile;
              await saveProfileVersion(e.id, p, "자동 채우기 전");
              const { merged, added, kept } = mergeProfile(p, add);
              upd(merged);
              setFill(false);
              toast(`${added}개 항목을 채웠어요${kept.length ? ` · 이미 쓴 ${kept.map((k) => ({ headline: "한 줄 소개", bio: "소개문", members: "구성원", notes: "메모" } as Record<string, string>)[k]).join("·")}은 그대로 뒀어요` : ""}`);
              return null;
            } catch (x) { return (x as Error).message; }
          }}
        />
      </Sheet>

      <Sheet open={!!vers} onClose={() => setVers(null)} title="프로필 기록">
        {vers?.length ? (
          <ul className="divide-y divide-line">
            {vers.map((v) => (
              <li key={v.id} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0"><p className="font-semibold text-[14px] truncate">{v.note || "버전"}</p><p className="text-[12px] text-faint">{new Date(v.createdAt).toLocaleString("ko-KR")}</p></div>
                <Button size="sm" onClick={async () => { await saveProfileVersion(e.id, p, "되돌리기 전"); upd(v.profile); setVers(null); toast("그 버전으로 되돌렸어요"); }}>되돌리기</Button>
              </li>
            ))}
          </ul>
        ) : <p className="text-[14px] text-mute py-6 text-center">아직 저장한 버전이 없어요.</p>}
      </Sheet>
    </div>
  );
}

function ProfilePage() {
  const q = useSearchParams();
  const { entities, ready, guest } = useApp();
  setGuestMode(guest);
  const [sel, setSel] = useState<string | null>(q.get("e"));
  const e = entities.find((x) => x.id === sel) ?? entities[0];
  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-8 py-5 lg:py-8 pb-28">
      <div className="flex items-center gap-2 mb-4">
        <Link href="/settings#entities" className="size-10 grid place-items-center rounded-lg hover:bg-surface-2" aria-label="설정으로"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-[22px] font-bold leading-tight">프로필</h1>
          <p className="text-[13px] text-mute">지원서 초안의 재료예요. 한 번 채워 두면 모든 공고에 쓰여요.</p>
        </div>
      </div>
      {entities.length > 1 && (
        <div className="flex gap-1.5 mb-4 overflow-x-auto scrollbar-none">
          {entities.map((x) => (
            <button key={x.id} onClick={() => setSel(x.id)} className={cx("h-9 px-3.5 rounded-full text-[14px] font-semibold shrink-0 border", e?.id === x.id ? "bg-ink text-bg border-ink" : "border-line text-mute bg-surface")}>{x.name}</button>
          ))}
        </div>
      )}
      {!ready ? null : e ? <ProfileEditor key={e.id} e={e} /> : (
        <Empty icon={<Sparkles size={28} />} title="먼저 지원 주체를 추가해 주세요" desc="설정 → 지원 주체에서 개인·단체를 등록하면 프로필을 채울 수 있어요." />
      )}
    </div>
  );
}

export default function Page() {
  return <Suspense><ProfilePage /></Suspense>;
}
