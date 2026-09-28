"use client";
import type { Entity } from "@muse/core";
import { Button, cx, Sheet } from "./ui";

export type Sort = "deadline" | "fit" | "recent";
export interface Filters {
  region: string;
  entity: string;
  overseas: boolean;
  /** 국내만 */
  domestic?: boolean;
  /** 지역 조건(주거지·활동지역)이 맞지 않는 공고 빼고 보기 — 기본은 모두 보기 */
  regionOk?: boolean;
  saved: boolean;
  showClosed: boolean;
  sort: Sort;
}
export const DEFAULT_FILTERS: Filters = { region: "all", entity: "all", overseas: false, domestic: false, regionOk: false, saved: false, showClosed: false, sort: "deadline" };
export const activeCount = (f: Filters) =>
  (f.region !== "all" ? 1 : 0) + (f.entity !== "all" ? 1 : 0) + (f.overseas ? 1 : 0) + (f.domestic ? 1 : 0) + (f.regionOk ? 1 : 0) + (f.saved ? 1 : 0) + (f.showClosed ? 1 : 0);

const SORTS: [Sort, string][] = [["deadline", "마감 임박순"], ["fit", "적합도순"], ["recent", "최신순"]];

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick(): void }) {
  return (
    <button onClick={onClick} aria-pressed={on}
      className={cx("h-10 px-4 rounded-full text-[14px] border transition-colors", on ? "border-brand bg-brand-soft text-brand-ink font-semibold" : "border-line-strong text-mute")}>
      {children}
    </button>
  );
}

/** 모바일: 바텀시트로 모든 필터 */
export function FilterSheet({ open, onClose, f, set, regions, entities, resultCount }: {
  open: boolean; onClose(): void; f: Filters; set(f: Filters): void; regions: string[]; entities: Entity[]; resultCount: number;
}) {
  const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="py-3.5 border-b border-line last:border-0">
      <h3 className="text-[13px] font-bold text-mute mb-2.5">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
  return (
    <Sheet open={open} onClose={onClose} title="필터와 정렬">
      <Group title="정렬">
        {SORTS.map(([k, l]) => <Chip key={k} on={f.sort === k} onClick={() => set({ ...f, sort: k })}>{l}</Chip>)}
      </Group>
      <Group title="지원 주체">
        <Chip on={f.entity === "all"} onClick={() => set({ ...f, entity: "all" })}>모두</Chip>
        {entities.map((e) => <Chip key={e.id} on={f.entity === e.id} onClick={() => set({ ...f, entity: e.id })}>{e.name}</Chip>)}
      </Group>
      <Group title="지역">
        <Chip on={f.region === "all"} onClick={() => set({ ...f, region: "all" })}>전체</Chip>
        {regions.map((r) => <Chip key={r} on={f.region === r} onClick={() => set({ ...f, region: r })}>{r}</Chip>)}
      </Group>
      <Group title="더 보기">
        <Chip on={f.saved} onClick={() => set({ ...f, saved: !f.saved })}>★ 저장한 것만</Chip>
        <Chip on={!!f.domestic} onClick={() => set({ ...f, domestic: !f.domestic, overseas: false })}>국내만</Chip>
        <Chip on={f.overseas} onClick={() => set({ ...f, overseas: !f.overseas, domestic: false })}>해외만</Chip>
        <Chip on={!!f.regionOk} onClick={() => set({ ...f, regionOk: !f.regionOk })}>📍 지역 조건 맞는 것만</Chip>
        <Chip on={f.showClosed} onClick={() => set({ ...f, showClosed: !f.showClosed })}>마감된 공고 포함</Chip>
      </Group>
      <div className="sticky bottom-0 -mx-5 px-5 pt-3 pb-2 bg-surface flex gap-2">
        <Button className="flex-1 h-12" onClick={() => set(DEFAULT_FILTERS)}>초기화</Button>
        <Button variant="primary" className="flex-[2] h-12" onClick={onClose}>{resultCount}건 보기</Button>
      </div>
    </Sheet>
  );
}

/** PC: 도구 모음에 펼쳐 놓는 필터 */
export function FilterBar({ f, set, regions, entities, showOverseas }: { f: Filters; set(f: Filters): void; regions: string[]; entities: Entity[]; showOverseas: boolean }) {
  const select = "h-9 rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink focus:outline-none focus:border-brand";
  const tog = (on: boolean) => cx("h-9 px-3 rounded-lg border text-[13px] font-medium", on ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-surface text-mute hover:text-ink");
  return (
    <>
      <select aria-label="지역" className={select} value={f.region} onChange={(e) => set({ ...f, region: e.target.value })}>
        <option value="all">전체 지역</option>
        {regions.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <select aria-label="지원 주체" className={select} value={f.entity} onChange={(e) => set({ ...f, entity: e.target.value })}>
        <option value="all">모든 주체</option>
        {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
      {showOverseas && <button aria-pressed={!!f.domestic} className={tog(!!f.domestic)} onClick={() => set({ ...f, domestic: !f.domestic, overseas: false })}>국내</button>}
      {showOverseas && <button aria-pressed={f.overseas} className={tog(f.overseas)} onClick={() => set({ ...f, overseas: !f.overseas, domestic: false })}>해외</button>}
      <button aria-pressed={!!f.regionOk} title="내 주거지·활동지역 조건이 맞지 않는 공고를 잠시 빼고 봐요" className={tog(!!f.regionOk)} onClick={() => set({ ...f, regionOk: !f.regionOk })}>📍 지역 맞음</button>
      <button aria-pressed={f.saved} className={cx(tog(f.saved), f.saved && "!border-amber !bg-amber-soft !text-amber")} onClick={() => set({ ...f, saved: !f.saved })}>★ 저장한 것</button>
      <select aria-label="정렬" className={select} value={f.sort} onChange={(e) => set({ ...f, sort: e.target.value as Sort })}>
        {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    </>
  );
}
