"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useApp } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { cx } from "./ui";

type Phase = "idle" | "starting" | "running" | "done";

/**
 * [지금 수집] — 정해진 시간(06:00·18:00)을 기다리지 않고 바로 한 번 공고를 모음.
 * 키워드를 바꾼 뒤 바로 그 키워드로 찾아보고 싶을 때 써요. 서버에 GITHUB_TOKEN이 없으면 버튼이 안 보여요.
 */
export function CollectNow({ className }: { className?: string }) {
  const { live, guest, toast } = useApp();
  const [enabled, setEnabled] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };
  const poll = useCallback(() => {
    stopPoll();
    timer.current = setInterval(async () => {
      const s = await fetch("/api/collect", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      if (s && !s.running) {
        stopPoll();
        setPhase("done");
        toast(s.conclusion === "success" ? "수집이 끝났어요. [새 공고 불러오기]를 눌러 주세요" : "수집이 끝났지만 일부 사이트에서 문제가 있었어요");
      }
    }, 20_000);
  }, [toast]);

  useEffect(() => {
    if (!live || guest) return;
    fetch("/api/collect", { cache: "no-store" }).then((r) => r.json()).then((s) => {
      setEnabled(!!s.enabled);
      if (s.running) { setPhase("running"); poll(); }
    }).catch(() => undefined);
    return stopPoll;
  }, [live, guest, poll]);

  if (!enabled) return null;

  const start = async () => {
    if (phase === "done") { window.location.reload(); return; }
    if (phase !== "idle" || !supabase) return;
    setPhase("starting");
    const { data } = await supabase.auth.getSession();
    const r = await fetch("/api/collect", { method: "POST", headers: { authorization: `Bearer ${data.session?.access_token ?? ""}` } }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) { setPhase("idle"); toast(j.error ?? "수집을 시작하지 못했어요"); return; }
    setPhase("running");
    toast(j.already ? "이미 수집 중이에요. 끝나면 알려 드릴게요" : "수집을 시작했어요. 5~10분쯤 걸려요. 끝나면 알려 드릴게요");
    poll();
  };

  const label = phase === "starting" ? "시작하는 중…" : phase === "running" ? "수집 중…" : phase === "done" ? "새 공고 불러오기" : "지금 수집";
  return (
    <button onClick={start} disabled={phase === "starting" || phase === "running"}
      title="정해진 시간을 기다리지 않고 지금 바로 공고를 모아요 (키워드를 바꾼 뒤 쓰면 좋아요)"
      className={cx("inline-flex items-center gap-1 rounded-full border border-line px-2 h-6 text-[12px] font-medium transition-colors",
        phase === "done" ? "bg-brand-soft text-brand-ink border-transparent" : "text-mute hover:text-ink hover:bg-surface disabled:opacity-70", className)}>
      <RefreshCw size={12} className={phase === "starting" || phase === "running" ? "animate-spin" : ""} />
      {label}
    </button>
  );
}
