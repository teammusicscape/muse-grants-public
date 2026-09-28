"use client";
import { useEffect, useState } from "react";
import { ImageIcon, Link as LinkIcon, PenLine } from "lucide-react";
import { classifyKind, extraTags, KIND_LABEL, todayISO, type NoticeKind } from "@muse/core";
import { useApp } from "@/lib/store";
import { Button, cx, Segmented, Sheet, Tip } from "./ui";

type Mode = "link" | "image" | "manual";

export function AddNotice({ open, onClose }: { open: boolean; onClose(): void }) {
  const { addNotice, toast } = useApp();
  const [mode, setMode] = useState<Mode>("link");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [org, setOrg] = useState("");
  const [deadline, setDeadline] = useState("");
  const [kind, setKind] = useState<NoticeKind | "auto">("auto");
  const [img, setImg] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    if (!open) return;
    // 붙여넣기(Ctrl+V)로 링크·이미지 바로 받기
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (file) { setMode("image"); setImg(URL.createObjectURL(file)); return; }
      const t = e.clipboardData?.getData("text") ?? "";
      if (/^https?:\/\//.test(t.trim()) && !(e.target instanceof HTMLInputElement)) { setMode("link"); setUrl(t.trim()); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open]);

  const reset = () => { setUrl(""); setTitle(""); setOrg(""); setDeadline(""); setKind("auto"); setImg(null); };
  const isIG = /instagram\.com/.test(url) || mode === "image";
  const autoKind = classifyKind(title);
  const finalKind = kind === "auto" ? autoKind : kind;

  const submit = () => {
    if (!title.trim()) { toast("제목을 입력해 주세요"); return; }
    addNotice({
      id: "u" + Date.now().toString(36),
      kind: finalKind, title: title.trim(), org: org.trim() || "기관 확인 필요",
      sources: [isIG ? "IG" : "직접 추가"], url: url.trim() || "#",
      fields: [], tags: extraTags(title), overseas: extraTags(title).includes("해외"),
      deadline: deadline || null, deadlineLabel: deadline ? undefined : "확인 필요",
      checkedAt: todayISO(), postedAt: todayISO(), thumb: img ?? undefined, posterColor: "#b8321f",
      needsReview: isIG,
    });
    toast("공고를 추가했어요");
    reset(); onClose();
  };

  const field = "w-full h-11 rounded-xl border border-line-strong bg-surface px-3 text-[14px] focus:outline-none focus:border-brand";

  return (
    <Sheet open={open} onClose={onClose} title="공고 추가">
      <Segmented<Mode> value={mode} onChange={setMode} className="w-full grid grid-cols-3 mb-4"
        options={[
          { value: "link", label: <><LinkIcon size={14} /> 링크</> },
          { value: "image", label: <><ImageIcon size={14} /> 포스터</> },
          { value: "manual", label: <><PenLine size={14} /> 직접 입력</> },
        ]} />

      {mode === "link" && (
        <label className="block mb-3">
          <span className="text-[13px] font-semibold flex items-center gap-1 mb-1.5">공고 링크 <Tip>인스타는 자동 수집이 안 돼요. 게시물 링크를 복사해서 여기에 붙여넣으세요. 앱 어디서든 Ctrl+V를 눌러도 돼요.</Tip></span>
          <input className={field} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.instagram.com/p/… 또는 공고 주소" inputMode="url" />
        </label>
      )}
      {mode === "image" && (
        <div className="mb-3">
          <label
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) setImg(URL.createObjectURL(f)); }}
            className={cx("flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-colors",
              over ? "border-brand bg-brand-soft" : "border-line-strong")}>
            {img ? <img src={img} alt="포스터 미리보기" className="max-h-48 rounded-lg" /> : (
              <>
                <ImageIcon className="text-faint" />
                <span className="text-[14px] font-semibold">포스터 캡처를 끌어다 놓거나 눌러서 선택</span>
                <span className="text-[12.5px] text-mute">휴대폰에서는 사진 앱에서 고를 수 있어요</span>
              </>
            )}
            <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setImg(URL.createObjectURL(f)); }} />
          </label>
          <p className="text-[12.5px] text-mute mt-2">AI가 연결되어 있으면 포스터에서 기관·마감일을 자동으로 읽어요. 지금은 아래 칸을 직접 채워 주세요.</p>
        </div>
      )}

      <div className="space-y-3">
        <label className="block"><span className="text-[13px] font-semibold mb-1.5 block">제목</span>
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예) 2026 미디어아트 레지던시 입주 작가 모집" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-[13px] font-semibold mb-1.5 block">기관</span>
            <input className={field} value={org} onChange={(e) => setOrg(e.target.value)} placeholder="주최·주관" /></label>
          <label className="block"><span className="text-[13px] font-semibold mb-1.5 block">마감일</span>
            <input className={field} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
        </div>
        <div>
          <span className="text-[13px] font-semibold mb-1.5 flex items-center gap-1">종류 <Tip>제목을 보고 자동으로 분류해요. 틀리면 직접 골라 주세요. 다음부터 더 정확해져요.</Tip></span>
          <div className="flex flex-wrap gap-1.5">
            {(["auto", "grant", "service", "edu", "venue", "residency"] as const).map((k) => (
              <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k}
                className={cx("h-8 px-3 rounded-full text-[13px] border", kind === k ? "border-brand bg-brand-soft text-brand-ink font-semibold" : "border-line-strong text-mute")}>
                {k === "auto" ? `자동 (${KIND_LABEL[autoKind]})` : KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="ghost" onClick={onClose}>취소</Button>
        <Button variant="primary" onClick={submit}>추가하기</Button>
      </div>
    </Sheet>
  );
}
