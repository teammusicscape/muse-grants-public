"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Draft, DraftVersion, Profile } from "@muse/core";
import { supabase as sb } from "./supabase";

/** 데모 모드: 이 브라우저에만 저장 */
function ls<T>(k: string, fb: T): T { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } }
function lsSet(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* noop */ } }
/** 체험 모드(로그인 없음)면 클라우드 대신 이 브라우저에 저장 */
let guestMode = false;
/** 화면에서 useApp().guest 값을 알려 줌 */
export function setGuestMode(v: boolean) { guestMode = v; }
function cloud() { return guestMode ? null : sb; }
const LS_D = "mg-drafts", LS_V = "mg-draft-versions", LS_P = "mg-profile-versions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowToDraft = (r: any): Draft => ({
  id: r.id, noticeId: r.notice_id, noticeTitle: r.notice_title ?? "", entityId: r.entity_id ?? "",
  sections: r.sections ?? [], criteria: r.criteria ?? [], checklist: r.checklist ?? [], memo: r.memo ?? "", createdAt: r.created_at, updatedAt: r.updated_at,
});
const draftToRow = (d: Draft) => ({
  id: d.id, notice_id: d.noticeId, notice_title: d.noticeTitle, entity_id: d.entityId || null,
  sections: d.sections, criteria: d.criteria, checklist: d.checklist, memo: d.memo ?? null, updated_at: new Date().toISOString(),
});

export async function loadDraft(noticeId: string): Promise<Draft | null> {
  const db = cloud();
  if (!db) return ls<Draft[]>(LS_D, []).find((d) => d.noticeId === noticeId) ?? null;
  const { data } = await db.from("drafts").select("*").eq("notice_id", noticeId).maybeSingle();
  return data ? rowToDraft(data) : null;
}

export async function listDrafts(): Promise<Pick<Draft, "id" | "noticeId" | "noticeTitle" | "updatedAt">[]> {
  const db = cloud();
  if (!db) return ls<Draft[]>(LS_D, []);
  const { data } = await db.from("drafts").select("id, notice_id, notice_title, updated_at").order("updated_at", { ascending: false });
  return (data ?? []).map((r) => ({ id: r.id, noticeId: r.notice_id, noticeTitle: r.notice_title ?? "", updatedAt: r.updated_at }));
}

export async function saveDraftNow(d: Draft): Promise<string | null> {
  const db = cloud();
  if (!db) {
    const all = ls<Draft[]>(LS_D, []).filter((x) => x.id !== d.id);
    lsSet(LS_D, [{ ...d, updatedAt: new Date().toISOString() }, ...all]);
    return null;
  }
  const { error } = await db.from("drafts").upsert(draftToRow(d), { onConflict: "id" });
  return error?.message ?? null;
}

export async function deleteDraft(d: Draft) {
  const db = cloud();
  if (!db) { lsSet(LS_D, ls<Draft[]>(LS_D, []).filter((x) => x.id !== d.id)); return; }
  await db.from("drafts").delete().eq("id", d.id);
}

export async function saveVersion(d: Draft, note: string) {
  const db = cloud();
  const v: DraftVersion = { id: Math.random().toString(36).slice(2), draftId: d.id, note, sections: d.sections, createdAt: new Date().toISOString() };
  if (!db) { lsSet(LS_V, [v, ...ls<DraftVersion[]>(LS_V, [])].slice(0, 200)); return; }
  await saveDraftNow(d); // 외래키: 초안이 먼저 있어야 함
  await db.from("draft_versions").insert({ draft_id: d.id, note, sections: d.sections });
}

export async function listVersions(draftId: string): Promise<DraftVersion[]> {
  const db = cloud();
  if (!db) return ls<DraftVersion[]>(LS_V, []).filter((v) => v.draftId === draftId);
  const { data } = await db.from("draft_versions").select("*").eq("draft_id", draftId).order("created_at", { ascending: false }).limit(50);
  return (data ?? []).map((r) => ({ id: r.id, draftId: r.draft_id, note: r.note ?? "", sections: r.sections, createdAt: r.created_at }));
}

export interface ProfileVersion { id: string; entityId: string; note: string; profile: Profile; createdAt: string }
export async function saveProfileVersion(entityId: string, profile: Profile, note: string) {
  const db = cloud();
  if (!db) { lsSet(LS_P, [{ id: Math.random().toString(36).slice(2), entityId, note, profile, createdAt: new Date().toISOString() }, ...ls<ProfileVersion[]>(LS_P, [])].slice(0, 100)); return; }
  await db.from("profile_versions").insert({ entity_id: entityId, note, profile });
}
export async function listProfileVersions(entityId: string): Promise<ProfileVersion[]> {
  const db = cloud();
  if (!db) return ls<ProfileVersion[]>(LS_P, []).filter((v) => v.entityId === entityId);
  const { data } = await db.from("profile_versions").select("*").eq("entity_id", entityId).order("created_at", { ascending: false }).limit(30);
  return (data ?? []).map((r) => ({ id: r.id, entityId: r.entity_id, note: r.note ?? "", profile: r.profile, createdAt: r.created_at }));
}

/** 초안 편집 상태 + 자동 저장 (입력 멈추고 1초 뒤) */
export function useDraft(noticeId: string | null) {
  const [draft, setDraftS] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"saved" | "saving" | "dirty" | "error">("saved");
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef<Draft | null>(null);

  useEffect(() => {
    if (!noticeId) return;
    setLoading(true);
    loadDraft(noticeId).then((d) => { setDraftS(d); latest.current = d; setLoading(false); });
  }, [noticeId]);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (!latest.current) return;
    setStatus("saving");
    const err = await saveDraftNow(latest.current);
    setStatus(err ? "error" : "saved");
  }, []);

  const setDraft = useCallback((d: Draft, immediate = false) => {
    setDraftS(d);
    latest.current = d;
    setStatus("dirty");
    window.clearTimeout(timer.current);
    if (immediate) void flush(); else timer.current = window.setTimeout(() => void flush(), 1000);
  }, [flush]);

  // 창을 닫기 전에 저장
  useEffect(() => {
    const h = () => { if (latest.current && status !== "saved") void saveDraftNow(latest.current); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [status]);

  return { draft, setDraft, loading, status, flush };
}
