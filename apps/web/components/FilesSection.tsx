"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Download, ExternalLink, Eye, FileText, FolderDown, Loader2, RefreshCw, Search, Trash2, Upload } from "lucide-react";
import type { Notice, NoticeFile, SavedFile } from "@muse/core";
import { useApp } from "@/lib/store";
import { extOf, sizeLabel } from "@/lib/fileTypes";
import { Button, cx, Tip } from "./ui";

const EXT_TONE: Record<string, string> = { pdf: "text-seal bg-seal-soft", hwp: "text-[var(--k-service)] bg-[var(--k-service-soft)]", hwpx: "text-[var(--k-service)] bg-[var(--k-service-soft)]" };
function ExtIcon({ name }: { name: string }) {
  const e = extOf(name);
  return (
    <span className={cx("size-9 rounded-lg grid place-items-center shrink-0 text-[10px] font-bold uppercase", EXT_TONE[e] ?? "text-mute bg-surface-2")}>
      {e ? e.slice(0, 4) : <FileText size={16} />}
    </span>
  );
}

/** 원문에서 찾은 첨부파일 (공고별로 이 창에서만 기억) */
type Found = { files: NoticeFile[]; hidden: number; blocked: boolean };
const foundCache = new Map<string, Found>();

async function findOnSource(n: Notice): Promise<Found> {
  const urls = [n.url, n.applyUrl].filter((u): u is string => !!u);
  const r = await fetch("/api/files/find", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ urls }) }).catch(() => null);
  const j = r?.ok ? await r.json().catch(() => null) : null;
  return { files: j?.files ?? [], hidden: j?.hidden ?? 0, blocked: !!j?.blocked };
}

const btn = "h-8 px-2.5 rounded-lg text-[12.5px] font-semibold inline-flex items-center gap-1 border border-line hover:border-line-strong text-ink whitespace-nowrap";

/** 공고 상세: 첨부파일(공고문·양식) + 내 보관함 */
export function FilesSection({ n, Section }: { n: Notice; Section: (p: { title: string; tip?: React.ReactNode; children: React.ReactNode }) => React.ReactElement }) {
  const { savedFiles, saveFile, uploadFile, openFile, removeFile, toast, live } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const mine = savedFiles.filter((f) => f.noticeId === n.id);
  const [found, setFound] = useState<Found | null>(() => foundCache.get(n.id) ?? null);
  const [finding, setFinding] = useState(false);
  const find = async () => {
    setFinding(true);
    const r = await findOnSource(n);
    foundCache.set(n.id, r);
    setFound(r);
    setFinding(false);
  };
  // 수집할 때 첨부파일을 못 가져온 공고는 열 때 원문에서 자동으로 찾아봄
  const collected = n.files ?? [];
  useEffect(() => {
    if (!collected.length && n.url && !foundCache.has(n.id)) void find();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n.id]);
  const files = collected.length ? collected : found?.files ?? [];
  const isSaved = (f: NoticeFile) => mine.some((m) => m.sourceUrl === f.url);
  const unsaved = files.filter((f) => !isSaved(f));

  const save = async (f: NoticeFile) => {
    setBusy(f.url);
    const ok = await saveFile(n, f);
    setBusy(null);
    if (ok && live) toast(`보관함에 저장했어요 · ${f.name}`);
  };
  const saveAll = async () => {
    setBusy("all");
    let ok = 0;
    for (const f of unsaved) { setBusy(f.url); if (await saveFile(n, f)) ok++; }
    setBusy(null);
    if (live && ok) toast(`${ok}개 파일을 보관함에 가져왔어요`);
  };

  return (
    <Section title="공고문 · 첨부파일" tip={<>원문 사이트의 첨부파일(공고문·신청서 양식)이에요. <b>미리보기</b>는 HWP도 브라우저에서 열려요.<br /><b>보관함에 저장</b>하면 내 저장공간에 복사돼서, 원문 글이 내려가도 계속 열 수 있어요.</>}>
      {finding && files.length === 0 && (
        <p className="text-[13px] text-mute flex items-center gap-2"><Loader2 size={14} className="animate-spin" />원문 페이지에서 첨부파일을 찾고 있어요…</p>
      )}
      {!finding && files.length === 0 && (
        <div className="rounded-xl bg-surface-2 p-3 text-[13px] text-mute space-y-2">
          <p>
            {found ? "원문 페이지에서 첨부파일을 찾지 못했어요." : "수집된 첨부파일이 없어요."}
            {found?.hidden ? ` 다운로드 버튼이 특수한 방식이라 자동으로 못 가져오는 파일이 ${found.hidden}개 있어요.` : ""}
            {found?.blocked ? " 해외·민간 사이트는 자동으로 찾지 않아요." : ""}
            {" "}원문에서 받아 아래 <b>내 파일 올리기</b>로 올려 주세요.
          </p>
          <span className="flex flex-wrap gap-1.5">
            {n.url && <a className={btn} href={n.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} />원문 열기</a>}
            {n.url && <button className={btn} onClick={() => void find()}>{found ? <RefreshCw size={14} /> : <Search size={14} />}{found ? "다시 찾기" : "원문에서 찾기"}</button>}
          </span>
        </div>
      )}
      {!collected.length && files.length > 0 && (
        <p className="text-[12px] text-faint mb-2">원문 페이지에서 찾은 첨부파일이에요{found?.hidden ? ` (자동으로 못 가져오는 파일 ${found.hidden}개는 원문에서 받아 주세요)` : ""}.</p>
      )}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f) => {
            const saved = isSaved(f);
            return (
              <li key={f.url} className="rounded-xl border border-line p-2.5 flex flex-wrap items-center gap-2">
                <ExtIcon name={f.name} />
                <span className="flex-1 min-w-[160px] text-[13.5px] font-medium leading-snug break-keep">{f.name}</span>
                <span className="flex gap-1.5 ml-auto">
                  {f.preview && <a className={btn} href={`/api/files/preview?seNo=${f.preview.seNo}&fileSn=${f.preview.fileSn}`} target="_blank" rel="noopener noreferrer"><Eye size={14} />미리보기</a>}
                  <a className={btn} href={f.url} target="_blank" rel="noopener noreferrer"><Download size={14} />받기</a>
                  {saved ? (
                    <span className={cx(btn, "border-transparent text-[var(--v-now)] bg-[var(--v-now-soft)]")}><Check size={14} />보관됨</span>
                  ) : (
                    <button className={cx(btn, "border-brand/40 text-brand-ink bg-brand-soft")} disabled={!!busy} onClick={() => save(f)}>
                      {busy === f.url ? <Loader2 size={14} className="animate-spin" /> : <FolderDown size={14} />}보관
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {unsaved.length > 0 && files.length > 0 && (
        <Button size="sm" variant="soft" className="mt-2" disabled={!!busy} onClick={saveAll}>
          {busy && unsaved.some((f) => f.url === busy) ? <Loader2 size={15} className="animate-spin" /> : <FolderDown size={15} />}
          {unsaved.length === files.length ? `첨부파일 ${files.length}개 모두 보관함에 가져오기` : `남은 ${unsaved.length}개 보관함에 가져오기`}
        </Button>
      )}

      <div className="mt-4">
        <p className="text-[12.5px] font-bold text-mute mb-2 flex items-center gap-1">내 보관함 {mine.length > 0 && <span className="tnum font-normal">{mine.length}</span>}
          <Tip>이 공고에 저장한 파일이에요. 내가 쓴 지원서·포트폴리오도 올려 두면 공고와 함께 모아 볼 수 있어요.</Tip></p>
        {mine.length > 0 && (
          <ul className="divide-y divide-line border-y border-line mb-2">
            {mine.map((f: SavedFile) => (
              <li key={f.id} className="flex items-center gap-2 py-2">
                <ExtIcon name={f.name} />
                <button className="flex-1 min-w-0 text-left" onClick={() => openFile(f)}>
                  <span className="block text-[13.5px] font-medium truncate hover:underline">{f.name}</span>
                  <span className="text-[11.5px] text-faint tnum">{[sizeLabel(f.size), new Date(f.createdAt).toLocaleDateString("ko-KR"), f.sourceUrl ? "공고 첨부" : "내가 올림"].filter(Boolean).join(" · ")}</span>
                </button>
                <button className={btn} onClick={() => openFile(f, true)} aria-label="내려받기"><Download size={14} /></button>
                <button className={cx(btn, "text-faint hover:text-seal")} aria-label="보관함에서 삭제" onClick={() => { if (confirm(`'${f.name}'을(를) 보관함에서 지울까요?`)) { void removeFile(f); toast("보관함에서 지웠어요"); } }}><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        )}
        <input ref={input} type="file" hidden multiple onChange={async (e) => {
          const list = [...(e.target.files ?? [])];
          e.target.value = "";
          for (const file of list) { setBusy(file.name); await uploadFile(n, file); }
          setBusy(null);
          if (list.length) toast(`${list.length}개 파일을 보관함에 올렸어요`);
        }} />
        <Button size="sm" disabled={!!busy} onClick={() => input.current?.click()}>
          {busy && !files.some((f) => f.url === busy) ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} 내 파일 올리기
        </Button>
      </div>
    </Section>
  );
}
