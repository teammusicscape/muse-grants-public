import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * [지금 수집] 버튼 — GitHub Actions의 "공고 수집" 일꾼을 바로 한 번 돌림
 * - GET: 버튼을 보여 줄지, 지금 수집 중인지
 * - POST: 로그인한 사용자만 실행. 이미 돌고 있거나 방금(10분 안) 돌았으면 다시 돌리지 않음
 * - 필요한 Vercel 환경변수(서버 전용, 브라우저에 안 보임):
 *   GITHUB_TOKEN    저장소의 Actions 권한(Read and write)만 있는 fine-grained 토큰
 *   GITHUB_REPO     (선택) 예: 내아이디/muse-grants-public. 비우면 Vercel이 연결된 저장소를 자동으로 씀
 *   GITHUB_WORKFLOW (선택) 기본 collect.yml
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOLDOWN_MIN = 10;

function gh() {
  const token = process.env.GITHUB_TOKEN;
  const vercelRepo = process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG
    ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}` : "";
  const repo = process.env.GITHUB_REPO || vercelRepo;
  const wf = process.env.GITHUB_WORKFLOW || "collect.yml";
  if (!token || !repo) return null;
  const base = `https://api.github.com/repos/${repo}/actions/workflows/${wf}`;
  const headers = { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "muse-grants" };
  return { base, headers };
}

type Run = { status: string; created_at: string; updated_at: string; conclusion: string | null };

async function latestRun(g: NonNullable<ReturnType<typeof gh>>): Promise<Run | null> {
  const r = await fetch(`${g.base}/runs?per_page=1`, { headers: g.headers, cache: "no-store" });
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  const j = (await r.json()) as { workflow_runs?: Run[] };
  return j.workflow_runs?.[0] ?? null;
}

const isRunning = (run: Run | null) => !!run && run.status !== "completed";

export async function GET() {
  const g = gh();
  if (!g) return NextResponse.json({ enabled: false });
  try {
    const run = await latestRun(g);
    return NextResponse.json({ enabled: true, running: isRunning(run), startedAt: run?.created_at ?? null, conclusion: run?.conclusion ?? null });
  } catch {
    return NextResponse.json({ enabled: true, running: false, error: "수집 상태를 확인하지 못했어요" });
  }
}

export async function POST(req: Request) {
  const g = gh();
  if (!g) return NextResponse.json({ error: "바로 수집 기능이 아직 설정되지 않았어요" }, { status: 501 });

  // 로그인한 사용자인지 확인 (체험 모드·외부 요청 막기)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anon || !token) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
  const sb = createClient(url, anon, { auth: { persistSession: false } });
  const { data: u, error: ue } = await sb.auth.getUser(token);
  if (ue || !u.user) return NextResponse.json({ error: "로그인이 만료됐어요. 다시 로그인해 주세요" }, { status: 401 });

  try {
    const run = await latestRun(g);
    if (isRunning(run)) return NextResponse.json({ ok: true, already: true, startedAt: run!.created_at });
    if (run && Date.now() - new Date(run.created_at).getTime() < COOLDOWN_MIN * 60_000)
      return NextResponse.json({ error: `방금 수집했어요. ${COOLDOWN_MIN}분쯤 뒤에 다시 눌러 주세요` }, { status: 429 });
    const r = await fetch(`${g.base}/dispatches`, { method: "POST", headers: { ...g.headers, "content-type": "application/json" }, body: JSON.stringify({ ref: "main" }) });
    if (!r.ok) return NextResponse.json({ error: `수집을 시작하지 못했어요 (GitHub ${r.status})` }, { status: 502 });
    return NextResponse.json({ ok: true, startedAt: new Date().toISOString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    const hint = /401/.test(msg) ? "토큰이 틀렸거나 만료됐어요" : /40[34]/.test(msg) ? "토큰에 이 저장소의 Actions 권한이 없어요" : "잠시 뒤 다시 눌러 주세요";
    return NextResponse.json({ error: `GitHub에 연결하지 못했어요 (${msg || "연결 실패"}) — ${hint}` }, { status: 502 });
  }
}
