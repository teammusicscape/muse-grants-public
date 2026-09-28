"use client";
import { useEffect, useState } from "react";

export type ChatAI = "Claude" | "Gemini" | "ChatGPT";
export const CHAT_URL: Record<ChatAI, string> = {
  Claude: "https://claude.ai/new",
  Gemini: "https://gemini.google.com/app",
  ChatGPT: "https://chatgpt.com/",
};

export function usePref<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(initial);
  useEffect(() => {
    try { const s = localStorage.getItem(key); if (s) setV(JSON.parse(s)); } catch { /* noop */ }
  }, [key]);
  const set = (nv: T) => {
    setV(nv);
    try { localStorage.setItem(key, JSON.stringify(nv)); } catch { /* noop */ }
  };
  return [v, set];
}
