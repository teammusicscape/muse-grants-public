"use client";
import { useEffect } from "react";
import type { Notice } from "@muse/core";
import { NoticeDetail } from "./NoticeDetail";

/** 휴대폰: 전체 화면 / 태블릿·PC: 오른쪽 서랍 */
export function DetailOverlay({ n, onClose }: { n: Notice | null; onClose(): void }) {
  useEffect(() => {
    if (!n) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [n, onClose]);
  if (!n) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="hidden md:block absolute inset-0 bg-black/25 anim-fade" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full md:w-[560px] bg-surface anim-slide md:border-l md:border-line md:shadow-pop">
        <NoticeDetail key={n.id} n={n} mode="page" onClose={onClose} />
      </div>
    </div>
  );
}
