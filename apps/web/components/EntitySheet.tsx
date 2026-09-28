"use client";
import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { careerLabel, residenceOf, SIDO, SIGUNGU, type ActivityRegion, type Entity, type EntityType, type Place } from "@muse/core";
import { useApp } from "@/lib/store";
import { Button, cx, Sheet, Tip } from "./ui";

const TYPES: EntityType[] = ["개인 예술가", "예술단체", "개인사업자", "법인"];
const DOCS = ["예술활동증명", "고유번호증", "사업자등록증", "법인등기부등본", "포트폴리오", "단체 소개서", "공연기획업 등록", "결과보고서"];
const fieldBase = "h-11 rounded-xl border border-line-strong bg-surface px-3 text-[15px] focus:outline-none focus:border-brand";
const field = "w-full " + fieldBase;
const small = "h-10 rounded-lg border border-line-strong bg-surface px-2.5 text-[14px] focus:outline-none focus:border-brand min-w-0";

/** 시·도 + 시·군·구 선택 */
function PlacePicker({ value, onChange, className }: { value?: Place; onChange(p: Place | undefined): void; className?: string }) {
  const sido = value?.sido ?? "";
  const list = sido ? SIGUNGU[sido] ?? [] : [];
  return (
    <div className={cx("grid grid-cols-2 gap-2", className)}>
      <select className={small} value={sido} aria-label="시·도" onChange={(x) => onChange(x.target.value ? { sido: x.target.value } : undefined)}>
        <option value="">시·도 선택</option>
        {SIDO.map((s) => <option key={s}>{s}</option>)}
      </select>
      <select className={small} value={value?.sigungu ?? ""} aria-label="시·군·구" disabled={!list.length} onChange={(x) => onChange({ sido, sigungu: x.target.value || undefined })}>
        <option value="">{list.length ? "시·군·구 (선택)" : "—"}</option>
        {list.map((g) => <option key={g}>{g}</option>)}
      </select>
    </div>
  );
}

export function EntitySheet({ entity, onClose }: { entity: Entity | null; onClose(): void }) {
  const { saveEntity, removeEntity, entities, toast } = useApp();
  const [e, setE] = useState<Entity | null>(entity);
  useEffect(() => setE(entity ? { ...entity, residence: residenceOf(entity) } : null), [entity]);
  if (!e) return null;
  const isNew = !entities.some((x) => x.id === e.id);
  const person = e.type === "개인 예술가";
  const chip = (on: boolean) => cx("h-9 px-3.5 rounded-full text-[13.5px] border", on ? "border-brand bg-brand-soft text-brand-ink font-semibold" : "border-line-strong text-mute");
  const acts = e.activityRegions ?? [];
  const setAct = (i: number, a: ActivityRegion | null) => setE({ ...e, activityRegions: a ? acts.map((x, j) => (j === i ? a : x)) : acts.filter((_, j) => j !== i) });
  const year = new Date().getFullYear();
  const save = () => {
    if (!e.name.trim()) { toast("이름을 입력해 주세요"); return; }
    const short = e.short.trim() || (person ? "개인" : e.type === "예술단체" ? "단체" : e.type === "법인" ? "법인" : "사업자");
    const activityRegions = acts.filter((a) => a.sido);
    saveEntity({
      ...e, name: e.name.trim(), short, activityRegions,
      region: e.residence?.sido ?? e.region ?? "",
      // 개인은 활동 시작 연도, 단체·사업자는 설립일만 저장
      foundedAt: person ? undefined : e.foundedAt,
      activityStartYear: person ? e.activityStartYear : undefined,
    });
    toast(isNew ? "지원 주체를 추가했어요" : "저장했어요");
    onClose();
  };
  const career = careerLabel(e);
  return (
    <Sheet open={!!entity} onClose={onClose} title={isNew ? "지원 주체 추가" : "지원 주체 수정"}>
      <div className="space-y-5">
        <label className="block"><span className="text-[13px] font-semibold mb-1.5 block">이름</span>
          <input className={field} value={e.name} onChange={(x) => setE({ ...e, name: x.target.value })} placeholder="예) 홍길동 (개인) / ○○ 예술단체" /></label>
        <div>
          <span className="text-[13px] font-semibold mb-1.5 block">유형</span>
          <div className="flex flex-wrap gap-1.5">{TYPES.map((t) => <button key={t} className={chip(e.type === t)} onClick={() => setE({ ...e, type: t })}>{t}</button>)}</div>
        </div>

        {person ? (
          <div>
            <span className="text-[13px] font-semibold mb-1.5 flex items-center gap-1">활동 시작 연도 <Tip>첫 발표·공연·전시를 한 해예요. &lsquo;활동 N년 이내 신진&rsquo;, &lsquo;10년 이상 중견&rsquo; 같은 조건 판정에 써요.</Tip></span>
            <div className="flex items-center gap-2">
              <select className={cx(fieldBase, "w-36 shrink-0")} value={e.activityStartYear ?? ""} onChange={(x) => setE({ ...e, activityStartYear: x.target.value ? +x.target.value : undefined })}>
                <option value="">선택</option>
                {Array.from({ length: 50 }, (_, i) => year - i).map((y) => <option key={y} value={y}>{y}년</option>)}
              </select>
              {career && <span className="text-[14px] font-semibold text-brand-ink whitespace-nowrap">{career}</span>}
            </div>
          </div>
        ) : (
          <label className="block"><span className="text-[13px] font-semibold mb-1.5 flex items-center gap-1">설립·개업일 <Tip>업력 조건(예: 설립 3년 이내) 판정에 써요.</Tip></span>
            <div className="flex items-center gap-2">
              <input type="date" className={cx(fieldBase, "w-48 shrink-0")} value={e.foundedAt ?? ""} onChange={(x) => setE({ ...e, foundedAt: x.target.value || undefined })} />
              {career && <span className="text-[14px] font-semibold text-brand-ink whitespace-nowrap">{career}</span>}
            </div>
          </label>
        )}

        <div>
          <span className="text-[13px] font-semibold mb-1.5 flex items-center gap-1">{person ? "주거지 (주민등록 주소지)" : "소재지 (등록 주소)"} <Tip>지역문화재단 공고의 &lsquo;OO 거주자&rsquo; 조건과 비교해 부합 여부를 표시해요. 맞지 않아도 공고는 숨기지 않아요.</Tip></span>
          <PlacePicker value={e.residence} onChange={(p) => setE({ ...e, residence: p })} />
        </div>

        <div>
          <span className="text-[13px] font-semibold mb-1 flex items-center gap-1">활동지역 <Tip>살지 않아도 &lsquo;그 지역에서 N년 이상·N회 이상 활동&rsquo;하면 지원할 수 있는 사업이 있어요. 활동한 지역과 기간·횟수를 적어 두면 함께 확인해요.</Tip></span>
          <p className="text-[12.5px] text-mute mb-2">주거지 말고도 꾸준히 활동해 온 지역이 있으면 추가하세요.</p>
          <div className="space-y-2">
            {acts.map((a, i) => (
              <div key={i} className="rounded-xl border border-line p-2.5 bg-surface-2/50">
                <div className="flex items-start gap-2">
                  <PlacePicker className="flex-1" value={a.sido ? a : undefined} onChange={(p) => setAct(i, { ...a, sido: p?.sido ?? "", sigungu: p?.sigungu })} />
                  <button aria-label="활동지역 삭제" className="size-10 grid place-items-center rounded-lg text-faint hover:text-seal hover:bg-surface shrink-0" onClick={() => setAct(i, null)}><X size={16} /></button>
                </div>
                <div className="flex items-center gap-2 mt-2 text-[13.5px] text-mute">
                  <input type="number" min={0} max={60} inputMode="numeric" className={cx(small, "w-20")} value={a.years ?? ""} onChange={(x) => setAct(i, { ...a, years: x.target.value ? +x.target.value : undefined })} aria-label="활동 기간(년)" />년 동안
                  <input type="number" min={0} max={999} inputMode="numeric" className={cx(small, "w-20 ml-1")} value={a.count ?? ""} onChange={(x) => setAct(i, { ...a, count: x.target.value ? +x.target.value : undefined })} aria-label="활동 횟수" />회 활동
                </div>
              </div>
            ))}
            <Button size="sm" variant="soft" onClick={() => setE({ ...e, activityRegions: [...acts, { sido: "" }] })}><Plus size={15} /> 활동지역 추가</Button>
          </div>
        </div>

        <label className="block"><span className="text-[13px] font-semibold mb-1.5 flex items-center gap-1">카드에 표시할 짧은 이름 <Tip>공고 카드의 판정 표시에 쓰여요. 예) 개인, 단체</Tip></span>
          <input className={field} value={e.short} onChange={(x) => setE({ ...e, short: x.target.value })} placeholder="비우면 유형으로 자동" maxLength={6} /></label>
        <div>
          <span className="text-[13px] font-semibold mb-1.5 block">보유 서류</span>
          <div className="flex flex-wrap gap-1.5">
            {DOCS.map((d) => {
              const on = e.documents.includes(d);
              return <button key={d} className={chip(on)} onClick={() => setE({ ...e, documents: on ? e.documents.filter((x) => x !== d) : [...e.documents, d] })}>{d}</button>;
            })}
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-6">
        {!isNew && <Button variant="ghost" className="text-seal" onClick={() => { removeEntity(e.id); toast("삭제했어요"); onClose(); }}>삭제</Button>}
        <div className="flex-1" />
        <Button variant="ghost" onClick={onClose}>취소</Button>
        <Button variant="primary" onClick={save}>{isNew ? "추가" : "저장"}</Button>
      </div>
    </Sheet>
  );
}
