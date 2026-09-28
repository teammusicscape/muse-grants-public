"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Cloud, House, Laptop, Moon, Settings, SquareKanban, Sun, Monitor } from "lucide-react";
import { isOpen } from "@muse/core";
import { useApp } from "@/lib/store";
import { GUEST_ENABLED, showcaseLabel } from "@/lib/showcase";
import { Button, cx, Toast } from "./ui";
import { useState } from "react";

function Login() {
  const { signIn, verifyCode, enterGuest } = useApp();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // 메일 링크가 오류로 돌아왔을 때 (#error_description=...)
  const [linkErr] = useState(() => {
    if (typeof window === "undefined") return null;
    const h = new URLSearchParams(window.location.hash.slice(1) || window.location.search.slice(1));
    return h.get("error_description");
  });
  const field = "w-full h-12 rounded-xl border border-line-strong bg-surface px-3 text-[16px] focus:outline-none focus:border-brand";
  return (
    <div className="min-h-dvh grid place-items-center px-5">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-7 shadow-card">
        <img src="/icon.svg" alt="" className="size-11 rounded-xl" />
        <h1 className="font-serif text-2xl font-bold mt-4">MUSE Grants</h1>
        <p className="text-sm text-mute mt-1">이메일로 로그인 코드를 보내드려요. 비밀번호는 필요 없어요.</p>
        {linkErr && !sent && (
          <p className="mt-4 rounded-xl bg-seal-soft text-seal p-3 text-[13px]">메일 링크로 로그인하지 못했어요 ({linkErr}). 아래에서 다시 받아 <b>6자리 코드</b>로 로그인해 주세요.</p>
        )}
        {!sent ? (
          <form className="mt-5 space-y-2.5" onSubmit={async (e) => { e.preventDefault(); setBusy(true); const r = await signIn(email); setBusy(false); if (r) setErr(r); else { setErr(null); setSent(true); } }}>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" className={field} />
            {err && <p className="text-[13px] text-seal">{err}</p>}
            <Button variant="primary" className="w-full h-12" disabled={busy}>{busy ? "보내는 중…" : "로그인 메일 받기"}</Button>
          </form>
        ) : (
          <form className="mt-5 space-y-2.5" onSubmit={async (e) => { e.preventDefault(); setBusy(true); const r = await verifyCode(email, code); setBusy(false); if (r) setErr(r); }}>
            <p className="rounded-xl bg-brand-soft text-brand-ink p-3.5 text-[13.5px]"><b>{email}</b>로 메일을 보냈어요.<br />메일의 <b>6자리 코드</b>를 입력하거나, 이 기기에서 메일의 링크를 누르세요.</p>
            <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456" className={field + " tracking-[0.4em] text-center font-bold tnum"} />
            {err && <p className="text-[13px] text-seal">{err}</p>}
            <Button variant="primary" className="w-full h-12" disabled={busy || code.length < 6}>{busy ? "확인 중…" : "로그인"}</Button>
            <button type="button" className="w-full text-[13px] text-mute py-1" onClick={() => { setSent(false); setCode(""); setErr(null); }}>다른 이메일로 / 다시 보내기</button>
          </form>
        )}
        {!sent && (
          <>
            <p className="text-[12px] text-faint mt-4 leading-relaxed">초대받은 이메일만 로그인할 수 있어요. 사용하고 싶다면 앱 관리자에게 초대를 요청하거나, 직접 설치해서 쓸 수 있어요.</p>
            {GUEST_ENABLED && (
              <div className="mt-5 pt-5 border-t border-line">
                <Button className="w-full h-12" onClick={() => enterGuest()}>로그인 없이 둘러보기</Button>
                <p className="text-[12px] text-faint mt-2 leading-relaxed text-center">★·지원 주체·메모는 이 브라우저에만 저장돼요.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const NAV = [
  { href: "/", label: "공고", icon: House },
  { href: "/calendar", label: "캘린더", icon: CalendarDays },
  { href: "/applications", label: "지원 관리", icon: SquareKanban },
  { href: "/settings", label: "설정", icon: Settings },
];

function timeLabel(iso: string | null) {
  if (!iso) return "기록 없음";
  const d = new Date(iso);
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return same ? `오늘 ${hm}` : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { notices, state, live, guest, exitGuest, lastSync, theme, setTheme, toastMsg, enabledKinds, needLogin } = useApp();
  const fresh = notices.filter((n) => enabledKinds.includes(n.kind) && !state.seen[n.id] && !state.hidden[n.id] && isOpen(n)).length;
  const active = Object.values(state.stages).filter((s) => s && s !== "선정" && s !== "탈락").length;
  const badge: Record<string, number> = { "/": fresh, "/applications": active };

  if (needLogin) return <Login />;
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      {/* PC 사이드바 */}
      <aside className="hidden lg:flex flex-col sticky top-0 h-dvh border-r border-line bg-surface-2/60 px-4 py-6">
        <Link href="/" className="flex items-center gap-2.5 px-2 mb-8">
          <img src="/icon.svg" alt="" className="size-8 rounded-lg" />
          <span className="leading-tight">
            <span className="block font-serif text-lg font-bold">MUSE Grants</span>
            <span className="block text-[11.5px] text-mute">모으고, 고르고, 준비해요</span>
          </span>
        </Link>
        <nav className="flex flex-col gap-0.5" aria-label="메뉴">
          {NAV.map(({ href, label, icon: I }) => {
            const on = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={on ? "page" : undefined}
                className={cx("flex items-center gap-3 rounded-lg px-3 h-10 text-[14.5px] transition-colors",
                  on ? "bg-surface text-ink font-semibold shadow-card" : "text-mute hover:text-ink hover:bg-surface")}>
                <I size={18} className={on ? "text-brand" : ""} />
                <span className="flex-1">{label}</span>
                {!!badge[href] && <span className="tnum text-[11.5px] font-bold rounded-full bg-brand-soft text-brand-ink px-1.5 min-w-5 text-center">{badge[href]}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="rounded-xl border border-line bg-surface p-3 text-[12.5px]">
            <div className="flex items-center gap-2 font-semibold">
              {live && !guest ? <Cloud size={14} className="text-brand" /> : <Laptop size={14} className="text-amber" />}
              {guest ? "체험 모드" : live ? "클라우드 동기화" : "데모 모드"}
            </div>
            <p className="text-mute mt-1">마지막 수집 <span className="tnum text-ink">{timeLabel(lastSync)}</span></p>
            {!live && <p className="text-faint mt-1">샘플 데이터로 보여주고 있어요</p>}
            {guest && <p className="text-faint mt-1">내 표시는 이 브라우저에만 저장돼요</p>}
          </div>
          <div className="flex items-center justify-between px-1">
            <span className="text-[12px] text-faint">화면 테마</span>
            <div className="flex">
              {([["light", Sun, "밝게"], ["system", Monitor, "시스템"], ["dark", Moon, "어둡게"]] as const).map(([v, I, l]) => (
                <button key={v} onClick={() => setTheme(v)} aria-label={l} title={l}
                  className={cx("size-7 grid place-items-center rounded-md", theme === v ? "bg-surface text-ink shadow-card" : "text-faint hover:text-ink")}>
                  <I size={14} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 pb-24 lg:pb-0">
        {guest && (
          <div className="bg-amber-soft text-amber text-[12.5px] text-center px-4 py-1.5">
            체험 모드 · <span className="hidden sm:inline">{showcaseLabel}예요. ★·설정은 </span>이 브라우저에만 저장돼요 · <button className="font-bold underline underline-offset-2" onClick={() => exitGuest()}>로그인</button>
          </div>
        )}
        {!live && (
          <div className="bg-amber-soft text-amber text-[12.5px] text-center px-4 py-1.5">
            데모 모드 · <b>샘플 데이터</b>예요<span className="hidden sm:inline">. 설정에서 클라우드를 연결하면 실제 공고가 들어와요</span>
          </div>
        )}
        {children}
      </div>

      {/* 모바일 하단 탭바 */}
      <nav aria-label="메뉴" className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-surface/95 backdrop-blur pb-safe">
        <div className="grid grid-cols-4">
          {NAV.map(({ href, label, icon: I }) => {
            const on = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={on ? "page" : undefined}
                className={cx("relative flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px]", on ? "text-brand font-semibold" : "text-mute")}>
                <I size={21} strokeWidth={on ? 2.3 : 1.8} />
                {label}
                {!!badge[href] && <span className="absolute top-1 left-1/2 ml-2 tnum text-[10px] font-bold rounded-full bg-seal text-white px-1 min-w-4 text-center leading-4">{badge[href]}</span>}
              </Link>
            );
          })}
        </div>
      </nav>
      <Toast msg={toastMsg} />
    </div>
  );
}
