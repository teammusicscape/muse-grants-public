"use client";
import { useState } from "react";
import { ClipboardPaste, Copy, ExternalLink } from "lucide-react";
import { CHAT_URL, usePref, type ChatAI } from "@/lib/prefs";
import { useApp } from "@/lib/store";
import { Button, cx } from "./ui";

async function copy(t: string) { try { await navigator.clipboard.writeText(t); return true; } catch { return false; } }

/**
 * AI 대화 왕복: ① 프롬프트 복사 + 대화창 열기 → ② 답변 붙여넣기 → ③ 적용
 * (API 키 없이 구독 중인 Claude·Gemini·ChatGPT로)
 */
export function AIRoundTrip({ prompt, hint, pasteLabel = "AI 답변 붙여넣기", applyLabel = "적용", onApply, extra }: {
  prompt: () => string; hint?: React.ReactNode; pasteLabel?: string; applyLabel?: string;
  onApply(text: string): string | null | Promise<string | null>; extra?: React.ReactNode;
}) {
  const { toast } = useApp();
  const [ai] = usePref<ChatAI>("mg-chat-ai", "Claude");
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const step = "size-6 rounded-full bg-brand text-white grid place-items-center text-[12px] font-bold shrink-0 dark:text-[#0f1413]";
  return (
    <div className="space-y-5">
      <div className="flex gap-3">
        <span className={step}>1</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[14.5px]">{ai}에게 부탁하기</p>
          {hint && <div className="text-[13px] text-mute mt-1 leading-relaxed">{hint}</div>}
          {extra}
          <div className="flex flex-wrap gap-2 mt-2.5">
            <Button variant="primary" onClick={async () => {
              const ok = await copy(prompt());
              setCopied(ok);
              if (!ok) { toast("복사가 막혀 있어요. 아래 '프롬프트 보기'에서 직접 복사해 주세요"); return; }
              window.open(CHAT_URL[ai], "_blank", "noopener");
              toast(`복사했어요. ${ai} 대화창에 붙여넣으세요`);
            }}><Copy size={15} /> 프롬프트 복사하고 {ai} 열기 <ExternalLink size={13} className="opacity-70" /></Button>
            <Button variant="ghost" onClick={async () => { const ok = await copy(prompt()); setCopied(ok); toast(ok ? "복사했어요 (같은 대화에 이어 붙여넣기)" : "복사가 막혀 있어요"); }}>복사만</Button>
          </div>
          {copied && <p className="text-[12.5px] text-[var(--v-now)] mt-1.5">✓ 복사됨 — 대화창에 붙여넣고, 필요한 파일을 첨부해 보내세요</p>}
          <details className="mt-2 text-[12.5px] text-mute"><summary className="cursor-pointer">프롬프트 보기</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-[12px] leading-relaxed">{prompt()}</pre></details>
        </div>
      </div>
      <div className="flex gap-3">
        <span className={cx(step, !copied && "bg-line-strong")}>2</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[14.5px] flex items-center gap-1.5"><ClipboardPaste size={15} /> {pasteLabel}</p>
          <p className="text-[12.5px] text-mute mt-0.5">답변 전체를 복사해서 그대로 붙여넣으면 돼요.</p>
          <textarea value={text} onChange={(e) => { setText(e.target.value); setErr(null); }} rows={7} placeholder="여기에 붙여넣기"
            className="mt-2 w-full rounded-xl border border-line-strong bg-surface p-3 text-[14px] leading-relaxed focus:outline-none focus:border-brand" />
          {err && <p className="text-[13px] text-seal mt-1">{err}</p>}
          <Button variant="primary" className="mt-2" disabled={!text.trim()} onClick={async () => { const e = await onApply(text); if (e) setErr(e); else setText(""); }}>{applyLabel}</Button>
        </div>
      </div>
    </div>
  );
}
