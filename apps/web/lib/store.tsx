"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  matchPlatforms, sampleNotices, SAMPLE_ENTITIES, SAMPLE_KEYWORDS, DEFAULT_KEYWORDS, dedupeKey, titleKey,
  SAMPLE_PLATFORMS, type Platform, type NoticeFile, type SavedFile, type Decision, type Entity, type KeywordSet, type Notice, type NoticeKind, type Stage, type UserState,
} from "@muse/core";
import { isLive, rowToNotice, supabase } from "./supabase";
import { storageKey, typeOf } from "./fileTypes";
import { GUEST_ENABLED, SHOWCASE_NAME } from "./showcase";

type Theme = "system" | "light" | "dark";

interface Ctx {
  ready: boolean;
  live: boolean;
  notices: Notice[];
  entities: Entity[];
  keywords: KeywordSet;
  state: UserState;
  lastSync: string | null;
  enabledKinds: NoticeKind[];
  theme: Theme;
  setTheme(t: Theme): void;
  toggleStar(id: string): void;
  setDecision(id: string, d: Decision | undefined): void;
  setStage(id: string, s: Stage | undefined): void;
  hide(id: string, v?: boolean): void;
  /** 공고 삭제 (다시 수집돼도 안 보임) / 복원 */
  remove(id: string): void;
  restore(id: string): void;
  /** 삭제한 공고 목록 (설정에서 복원용) */
  deletedNotices: Notice[];
  /** 해외 우수 플랫폼 디렉토리 (K-GO) */
  platforms: Platform[];
  /** 이 공고와 관련된 K-GO 플랫폼 (해외 공고만) */
  platformsOf(id: string): Platform[];
  /** 내 보관함 */
  savedFiles: SavedFile[];
  saveFile(n: Notice, f: NoticeFile): Promise<boolean>;
  uploadFile(n: Notice, file: File): Promise<boolean>;
  openFile(f: SavedFile, download?: boolean): Promise<void>;
  removeFile(f: SavedFile): Promise<void>;
  markSeen(id: string): void;
  addNotice(n: Notice): void;
  updateNotice(id: string, patch: Partial<Notice>): void;
  setKeywords(k: KeywordSet): void;
  saveEntity(e: Entity): void;
  removeEntity(id: string): void;
  userEmail: string | null;
  signOut(): Promise<void>;
  toggleKind(k: NoticeKind): void;
  toast(msg: string): void;
  toastMsg: string | null;
  needLogin: boolean;
  /** 체험 모드: 로그인 없이 공고를 보고, ★·설정은 이 브라우저에만 저장 */
  guest: boolean;
  enterGuest(): void;
  /** 체험 모드를 끝내고 로그인 화면으로 */
  exitGuest(): void;
  signIn(email: string): Promise<string | null>;
  verifyCode(email: string, code: string): Promise<string | null>;
}

const EMPTY: UserState = { starred: {}, decisions: {}, hidden: {}, seen: {}, stages: {}, deleted: {}, deletedKeys: {} };

/** 예전 설정에 새 탭(레지던시)을 켜 주기 */
function migrateKw(k: KeywordSet): KeywordSet {
  if ((k.v ?? 1) >= 2) return k;
  return { ...k, kinds: k.kinds.includes("residency") ? k.kinds : [...k.kinds, "residency"], v: 2 };
}
const LS = "mg-state-v1";
/** 체험 모드 저장소 (데모 모드와 섞이지 않게 따로) */
const LS_GUEST = "mg-guest-state-v2";
const GUEST_FLAG = "mg-guest";
/** 체험 모드 첫 방문 때 넣어 두는 예시 지원 주체 (설정에서 고치거나 지울 수 있음, 이 브라우저에만 저장) */
const GUEST_ENTITIES: Entity[] = [
  { id: "ex-team", name: SHOWCASE_NAME ? `${SHOWCASE_NAME} (예시)` : "예시 예술단체", short: "예시 단체", type: "예술단체", region: "서울", residence: { sido: "서울" }, foundedAt: "2023-03-01", documents: ["포트폴리오", "단체 소개서"] },
];
const AppCtx = createContext<Ctx | null>(null);

function load<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function persist(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장 불가 환경 */ }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [extra, setExtra] = useState<Notice[]>([]);
  const [state, setState] = useState<UserState>(EMPTY);
  const [keywords, setKw] = useState<KeywordSet>(SAMPLE_KEYWORDS);
  const [theme, setThemeS] = useState<Theme>("light");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [toastMsg, setToast] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [guest, setGuest] = useState(false);
  const [entities, setEntities] = useState<Entity[]>(isLive ? [] : SAMPLE_ENTITIES);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [platforms, setPlatforms] = useState<Platform[]>(isLive ? [] : SAMPLE_PLATFORMS);
  const [savedFiles, setSavedFiles] = useState<SavedFile[]>([]);
  /** 데모 모드: 올린 파일은 이 창에서만 (새로고침하면 사라짐) */
  const [demoBlobs] = useState(() => new Map<string, string>());

  useEffect(() => {
    const saved = load<{ state: UserState; extra: Notice[]; keywords: KeywordSet }>(LS, { state: EMPTY, extra: [], keywords: SAMPLE_KEYWORDS });
    if (!isLive) {
      // 데모 모드: 이 브라우저에만 저장
      setState({ ...EMPTY, ...saved.state });
      setExtra(saved.extra ?? []);
      setKw(migrateKw(saved.keywords ?? SAMPLE_KEYWORDS));
    }
    setThemeS((load<string>("mg-theme-pref", "light") as Theme) ?? "light");

    (async () => {
      if (supabase) {
        const { data: sess } = await supabase.auth.getSession();
        // 체험 링크 (…/?try) 로 들어오면 바로 체험 모드
        if (GUEST_ENABLED && !sess.session && new URLSearchParams(window.location.search).has("try")) {
          persist(GUEST_FLAG, true);
          window.history.replaceState(null, "", window.location.pathname);
        }
        if (GUEST_ENABLED && !sess.session && load<boolean>(GUEST_FLAG, false)) {
          // 체험 모드: 공개된 공고만 읽고, 개인 데이터는 이 브라우저에만
          setGuest(true);
          // 예시 계정(0006 SQL에서 지정)의 설정·AI 분석 — 처음 들어온 사람은 이 설정으로 시작
          const { data: sc } = await supabase.rpc("guest_showcase");
          const show = (sc ?? {}) as { keywords?: KeywordSet | null; entities?: Entity[]; analyses?: Record<string, Notice["analysis"]> };
          const showEntities = Array.isArray(show.entities) && show.entities.length ? show.entities : GUEST_ENTITIES;
          const showKeywords = show.keywords ? { ...DEFAULT_KEYWORDS, ...show.keywords } : SAMPLE_KEYWORDS;
          const g = load<{ state: UserState; extra: Notice[]; keywords: KeywordSet; entities: Entity[] } | null>(LS_GUEST, null);
          setState({ ...EMPTY, ...(g?.state ?? {}) });
          setExtra(g?.extra ?? []);
          setKw(migrateKw({ ...DEFAULT_KEYWORDS, ...(g?.keywords ?? showKeywords) }));
          setEntities(Array.isArray(g?.entities) ? g!.entities : showEntities);
          const { data, error } = await supabase.from("notices").select("*").is("created_by", null).order("deadline", { ascending: true, nullsFirst: false }).limit(1000);
          if (error) setToast("공고를 불러오지 못했어요. 잠시 후 다시 열어 주세요");
          else if (data) setNotices(data.map((r) => rowToNotice({ ...r, analysis: show.analyses?.[r.id] })));
          const { data: pf } = await supabase.from("platforms").select("*").limit(2000);
          if (pf) setPlatforms(pf.map((r) => ({ id: r.id, source: r.source, field: r.field, name: r.name, nameEn: r.name_en ?? undefined, type: r.type ?? undefined, genres: r.genres ?? [], continent: r.continent ?? undefined, country: r.country ?? undefined, city: r.city ?? undefined, homepage: r.homepage ?? undefined, tour: r.tour })));
          const { data: run } = await supabase.from("collect_runs").select("finished_at").not("finished_at", "is", null).order("finished_at", { ascending: false }).limit(1);
          setLastSync(run?.[0]?.finished_at ?? null);
          setReady(true);
          supabase.auth.onAuthStateChange((_e, session) => { if (session) { persist(GUEST_FLAG, false); window.location.reload(); } });
          return;
        }
        if (!sess.session) {
          setNeedLogin(true);
          setReady(true);
          supabase.auth.onAuthStateChange((_e, session) => { if (session) window.location.reload(); });
          return;
        }
        setUserEmail(sess.session.user.email ?? null);
        const { data: us } = await supabase.from("user_settings").select("keywords, entities").maybeSingle();
        setKw(migrateKw({ ...DEFAULT_KEYWORDS, ...(us?.keywords ?? {}) }));
        setEntities(Array.isArray(us?.entities) ? us!.entities : []);
        setSettingsLoaded(true);
        const { data: an } = await supabase.from("user_analyses").select("notice_id, analysis");
        const amap = new Map<string, unknown>((an ?? []).map((r) => [r.notice_id, r.analysis]));
        const { data, error } = await supabase.from("notices").select("*").order("deadline", { ascending: true, nullsFirst: false }).limit(1000);
        if (!error && data) setNotices(data.map((r) => rowToNotice({ ...r, analysis: amap.get(r.id) })));
        const { data: st } = await supabase.from("user_notice_state").select("*");
        if (st) {
          const s: UserState = { starred: {}, decisions: {}, hidden: {}, seen: {}, stages: {}, deleted: {}, deletedKeys: {} };
          for (const r of st) {
            if (r.starred) s.starred[r.notice_id] = true;
            if (r.decision) s.decisions[r.notice_id] = r.decision;
            if (r.hidden) s.hidden[r.notice_id] = true;
            if (r.seen) s.seen[r.notice_id] = true;
            if (r.stage) s.stages[r.notice_id] = r.stage;
            if (r.deleted) { s.deleted[r.notice_id] = true; if (r.title_key) s.deletedKeys[r.title_key] = true; }
          }
          setState(s);
        }
        const { data: uf } = await supabase.from("user_files").select("*").order("created_at", { ascending: false });
        if (uf) setSavedFiles(uf.map(rowToFile));
        const { data: pf } = await supabase.from("platforms").select("*").limit(2000);
        if (pf) setPlatforms(pf.map((r) => ({ id: r.id, source: r.source, field: r.field, name: r.name, nameEn: r.name_en ?? undefined, type: r.type ?? undefined, genres: r.genres ?? [], continent: r.continent ?? undefined, country: r.country ?? undefined, city: r.city ?? undefined, homepage: r.homepage ?? undefined, tour: r.tour })));
        const { data: run } = await supabase.from("collect_runs").select("finished_at").order("finished_at", { ascending: false }).limit(1);
        setLastSync(run?.[0]?.finished_at ?? null);
      } else {
        setNotices(sampleNotices());
        const t = new Date(); t.setHours(t.getHours() >= 18 ? 18 : 6, 0, 0, 0);
        setLastSync(t.toISOString());
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => { if (ready && !isLive) persist(LS, { state, extra, keywords }); }, [ready, state, extra, keywords]);
  useEffect(() => { if (ready && guest) persist(LS_GUEST, { state, extra, keywords, entities }); }, [ready, guest, state, extra, keywords, entities]);

  // 클라우드 모드: 키워드·지원 주체를 내 계정에 저장 (잠깐 모았다가 한 번에)
  useEffect(() => {
    if (!supabase || !settingsLoaded) return;
    const t = window.setTimeout(() => {
      void supabase!.from("user_settings").upsert({ keywords, entities, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
        .then(({ error }) => { if (error) { console.error("[MUSE] 설정 저장 실패", error); setToast("설정을 클라우드에 저장하지 못했어요: " + error.message); } });
    }, 700);
    return () => window.clearTimeout(t);
  }, [keywords, entities, settingsLoaded]);

  const allRef = useCallback((id: string) => [...extra, ...notices].find((n) => n.id === id), [extra, notices]);
  const syncRow = useCallback((id: string, next: UserState) => {
    if (!supabase || guest) return;
    const n = allRef(id);
    void supabase.from("user_notice_state").upsert({
      deleted: !!next.deleted[id],
      title_key: n ? titleKey(n) : null,
      notice_id: id,
      starred: !!next.starred[id],
      decision: next.decisions[id] ?? null,
      hidden: !!next.hidden[id],
      seen: !!next.seen[id],
      stage: next.stages[id] ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,notice_id" })
      .then(({ error }) => { if (error) { console.error("[MUSE] 표시 저장 실패", error); setToast("저장하지 못했어요: " + error.message); } });
  }, [allRef, guest]);

  const mutate = useCallback((id: string, fn: (s: UserState) => UserState) => {
    setState((prev) => {
      const next = fn(prev);
      syncRow(id, next);
      return next;
    });
  }, [syncRow]);

  const toast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((m) => (m === msg ? null : m)), 2600);
  }, []);

  const all = useMemo(() => [...extra, ...notices], [extra, notices]);
  const isDeleted = useCallback((n: Notice) => !!state.deleted[n.id] || !!state.deletedKeys[titleKey(n)], [state.deleted, state.deletedKeys]);
  const visible = useMemo(() => all.filter((n) => !isDeleted(n)), [all, isDeleted]);
  const deletedNotices = useMemo(() => all.filter(isDeleted), [all, isDeleted]);
  const platMap = useMemo(() => {
    const m = new Map<string, Platform[]>();
    if (platforms.length) for (const n of visible) if (n.overseas || n.kind === "residency") { const ps = matchPlatforms(n, platforms); if (ps.length) m.set(n.id, ps); }
    return m;
  }, [visible, platforms]);

  /** 개인 데이터를 클라우드에 쓸 수 있는지 (체험 모드면 null → 이 브라우저에서만) */
  const cloud = guest ? null : supabase;

  const value = useMemo<Ctx>(() => ({
    ready, live: isLive, guest,
    notices: visible,
    deletedNotices,
    platforms,
    platformsOf: (id) => platMap.get(id) ?? [],
    savedFiles,
    async saveFile(n, f) {
      if (!cloud) {
        setSavedFiles((l) => [{ id: "d" + Date.now(), noticeId: n.id, noticeTitle: n.title, name: f.name, path: f.url, sourceUrl: f.url, createdAt: new Date().toISOString() }, ...l]);
        toast(guest ? "보관함에 넣었어요 (체험 모드: 이 브라우저에서만)" : "보관함에 넣었어요 (데모: 이 브라우저에서만)");
        return true;
      }
      const { data: s } = await cloud.auth.getSession();
      const r = await fetch("/api/files/save", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${s.session?.access_token ?? ""}` },
        body: JSON.stringify({ noticeId: n.id, noticeTitle: n.title, url: f.url, name: f.name }),
      }).catch(() => null);
      const j = r ? await r.json().catch(() => ({})) : {};
      if (!r?.ok || !j.file) { toast(j.error ?? "저장하지 못했어요. 잠시 후 다시 시도해 주세요"); return false; }
      setSavedFiles((l) => [rowToFile(j.file), ...l]);
      return true;
    },
    async uploadFile(n, file) {
      if (file.size > 50 * 1024 * 1024) { toast("50MB보다 큰 파일은 올릴 수 없어요"); return false; }
      if (!cloud) {
        const u = URL.createObjectURL(file);
        const id = "d" + Date.now();
        demoBlobs.set(id, u);
        setSavedFiles((l) => [{ id, noticeId: n.id, noticeTitle: n.title, name: file.name, path: u, size: file.size, createdAt: new Date().toISOString() }, ...l]);
        return true;
      }
      const { data: s } = await cloud.auth.getSession();
      const uid = s.session?.user.id;
      if (!uid) { toast("로그인이 필요해요"); return false; }
      const path = storageKey(uid, n.id, file.name);
      const up = await cloud.storage.from("grant-files").upload(path, file, { contentType: file.type || typeOf(file.name) });
      if (up.error) { toast("올리지 못했어요: " + up.error.message); return false; }
      const { data, error } = await cloud.from("user_files").insert({ notice_id: n.id, notice_title: n.title, name: file.name, path, size: file.size }).select("*").single();
      if (error || !data) { toast("목록에 기록하지 못했어요"); return false; }
      setSavedFiles((l) => [rowToFile(data), ...l]);
      return true;
    },
    async openFile(f, download) {
      if (!cloud) { window.open(f.path, "_blank", "noopener"); return; }
      // 새 창을 먼저 열어 두고(팝업 차단 방지) 서명된 주소로 이동
      const w = window.open("", "_blank");
      const { data, error } = await cloud.storage.from("grant-files").createSignedUrl(f.path, 60 * 30, download ? { download: f.name } : undefined);
      if (error || !data) { w?.close(); toast("파일을 열지 못했어요"); return; }
      if (w) w.location.href = data.signedUrl; else window.location.href = data.signedUrl;
    },
    async removeFile(f) {
      setSavedFiles((l) => l.filter((x) => x.id !== f.id));
      if (!cloud) return;
      await cloud.storage.from("grant-files").remove([f.path]);
      await cloud.from("user_files").delete().eq("id", f.id);
    },
    entities, userEmail,
    keywords, state, lastSync,
    enabledKinds: keywords.kinds,
    theme,
    setTheme(t) {
      setThemeS(t);
      persist("mg-theme-pref", t);
      try {
        if (t === "system") { delete document.documentElement.dataset.theme; localStorage.setItem("mg-theme", ""); }
        else { document.documentElement.dataset.theme = t; localStorage.setItem("mg-theme", t); }
      } catch { /* noop */ }
    },
    toggleStar: (id) => mutate(id, (s) => ({ ...s, starred: { ...s.starred, [id]: !s.starred[id] }, stages: !s.starred[id] && !s.stages[id] ? { ...s.stages, [id]: "관심" } : s.stages })),
    setDecision: (id, d) => mutate(id, (s) => ({
      ...s,
      decisions: { ...s.decisions, [id]: d },
      starred: d && d !== "비추" ? { ...s.starred, [id]: true } : s.starred,
      stages: d === "지원" && (!s.stages[id] || s.stages[id] === "관심") ? { ...s.stages, [id]: "준비" } : s.stages,
    })),
    setStage: (id, st) => mutate(id, (s) => ({ ...s, stages: { ...s.stages, [id]: st }, starred: st ? { ...s.starred, [id]: true } : s.starred })),
    hide: (id, v = true) => mutate(id, (s) => ({ ...s, hidden: { ...s.hidden, [id]: v } })),
    remove: (id) => {
      const n = all.find((x) => x.id === id);
      const manual = extra.some((x) => x.id === id) || !!n?.manual;
      mutate(id, (s) => ({ ...s, deleted: { ...s.deleted, [id]: true }, deletedKeys: n ? { ...s.deletedKeys, [titleKey(n)]: true } : s.deletedKeys }));
      // 내가 직접 추가한 공고는 클라우드에서도 지움 (수집 공고는 다른 사용자도 볼 수 있어 표시만)
      if (cloud && manual) void cloud.from("notices").delete().eq("id", id).then(() => undefined);
    },
    restore: (id) => {
      const n = all.find((x) => x.id === id);
      const key = n ? titleKey(n) : "";
      // 같은 제목키로 삭제된 다른 공고(재수집본)도 함께 복원
      const ids = all.filter((x) => x.id === id || (key && titleKey(x) === key)).map((x) => x.id);
      setState((prev) => {
        const next = { ...prev, deleted: { ...prev.deleted }, deletedKeys: { ...prev.deletedKeys } };
        ids.forEach((i) => delete next.deleted[i]);
        if (key) delete next.deletedKeys[key];
        ids.forEach((i) => syncRow(i, next));
        return next;
      });
    },
    markSeen: (id) => { if (!state.seen[id]) mutate(id, (s) => ({ ...s, seen: { ...s.seen, [id]: true } })); },
    addNotice: (n) => {
      setExtra((e) => [n, ...e]);
      if (cloud) {
        void cloud.from("notices").insert({
          id: n.id, dedupe_key: `manual|${n.id}|${dedupeKey(n)}`, kind: n.kind, title: n.title, org: n.org, sources: n.sources, url: n.url,
          region: n.region ?? null, fields: n.fields, tags: n.tags, overseas: !!n.overseas, posted_at: n.postedAt ?? null,
          deadline: n.deadline, deadline_label: n.deadlineLabel ?? null, summary: n.summary ?? null,
          thumb: n.thumb?.startsWith("blob:") ? null : n.thumb ?? null, needs_review: !!n.needsReview, details: {},
        }).then(({ error }) => { if (error) toast("공고를 클라우드에 저장하지 못했어요: " + error.message); });
      }
    },
    updateNotice: (id, patch) => {
      if (cloud && patch.analysis) void cloud.from("user_analyses").upsert({ notice_id: id, analysis: patch.analysis, updated_at: new Date().toISOString() }, { onConflict: "user_id,notice_id" })
        .then(({ error }) => { if (error) { console.error("[MUSE] 분석 저장 실패", error); toast("분석을 클라우드에 저장하지 못했어요: " + error.message); } });
      setExtra((e) => e.map((n) => (n.id === id ? { ...n, ...patch } : n)));
      setNotices((e) => e.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    },
    setKeywords: setKw,
    saveEntity: (e) => setEntities((list) => (list.some((x) => x.id === e.id) ? list.map((x) => (x.id === e.id ? e : x)) : [...list, e])),
    removeEntity: (id) => setEntities((list) => list.filter((x) => x.id !== id)),
    async signOut() { if (guest) { persist(GUEST_FLAG, false); window.location.reload(); return; } if (supabase) { await supabase.auth.signOut(); window.location.reload(); } },
    enterGuest() { persist(GUEST_FLAG, true); window.location.reload(); },
    exitGuest() { persist(GUEST_FLAG, false); window.location.reload(); },
    toggleKind: (k) => setKw((kw) => {
      const has = kw.kinds.includes(k);
      if (has && kw.kinds.length === 1) return kw;
      return { ...kw, kinds: has ? kw.kinds.filter((x) => x !== k) : [...kw.kinds, k] };
    }),
    toast, toastMsg, needLogin,
    async signIn(email) {
      if (!supabase) return "클라우드가 연결되지 않았어요";
      // 새 가입은 막고, 등록된 사용자만 로그인 (Supabase → Authentication → Users에서 초대)
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/`, shouldCreateUser: false } });
      if (!error) return null;
      if (/signups? not allowed|not found|user not/i.test(error.message)) return "등록된 사용자만 이용할 수 있어요. 앱 관리자에게 초대를 요청해 주세요.";
      if (/rate limit/i.test(error.message)) return "메일을 너무 자주 요청했어요. 잠시 후 다시 시도해 주세요.";
      return error.message;
    },
    async verifyCode(email, code) {
      if (!supabase) return "클라우드가 연결되지 않았어요";
      const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "email" });
      if (error) return /expired|invalid/i.test(error.message) ? "코드가 틀렸거나 만료됐어요. 새 메일을 받아 다시 시도해 주세요." : error.message;
      window.location.reload();
      return null;
    },
  }), [ready, guest, cloud, extra, visible, deletedNotices, platforms, platMap, savedFiles, demoBlobs, all, notices, keywords, state, lastSync, theme, mutate, toast, toastMsg, needLogin, entities, userEmail]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToFile(r: any): SavedFile {
  return { id: r.id, noticeId: r.notice_id, noticeTitle: r.notice_title ?? undefined, name: r.name, path: r.path, size: r.size ?? undefined, sourceUrl: r.source_url ?? undefined, createdAt: r.created_at };
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error("AppProvider 밖에서 useApp을 호출했습니다");
  return c;
}
