"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Cloud, Laptop, Monitor, Moon, Plus, RotateCcw, Sun, UserRound, Users, X } from "lucide-react";
import { ALL_KINDS, careerLabel, KIND_LABEL, placeLabel, residenceOf, SUGGESTED_KEYWORDS, SUGGESTED_KEYWORDS_EN, type Entity, type NoticeKind } from "@muse/core";
import { EntitySheet } from "@/components/EntitySheet";
import { useApp } from "@/lib/store";
import { SHOWCASE_NAME } from "@/lib/showcase";
import { usePref, type ChatAI } from "@/lib/prefs";
import { Button, cx, PageTitle, Sheet, Tip } from "@/components/ui";

function Card({ id, title, desc, tip, children }: { id?: string; title: string; desc?: string; tip?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-2xl border border-line bg-surface p-5 lg:p-6 shadow-card">
      <h2 className="text-[16px] font-bold flex items-center gap-1">{title}{tip && <Tip>{tip}</Tip>}</h2>
      {desc && <p className="text-[13px] text-mute mt-1">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ChipInput({ words, onChange, placeholder, tone }: { words: string[]; onChange(w: string[]): void; placeholder: string; tone: "brand" | "seal" }) {
  const [v, setV] = useState("");
  const add = () => { const t = v.trim(); if (t && !words.includes(t)) onChange([...words, t]); setV(""); };
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {words.map((w) => (
        <span key={w} className={cx("inline-flex items-center gap-1 h-8 pl-3 pr-1.5 rounded-full text-[13px] font-medium", tone === "brand" ? "bg-brand-soft text-brand-ink" : "bg-seal-soft text-seal")}>
          {w}
          <button aria-label={`${w} 삭제`} onClick={() => onChange(words.filter((x) => x !== w))} className="size-5 grid place-items-center rounded-full hover:bg-black/10"><X size={12} /></button>
        </span>
      ))}
      <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && (e.preventDefault(), add())} onBlur={add}
        placeholder={placeholder} className="h-8 w-36 rounded-full border border-dashed border-line-strong px-3 text-[13px] bg-transparent focus:outline-none focus:border-brand" />
    </div>
  );
}

const NAV: [string, string][] = [["account", "내 계정"], ["entities", "지원 주체"], ["kinds", "공고 종류"], ["keywords", "키워드"], ["regions", "지역"], ["ai", "AI 요금 모드"], ["chat", "대화용 AI"], ["mobile", "휴대폰에서도 보기"], ["theme", "화면"], ["help", "도움말"]];

const MODES = [
  { id: "free", icon: "🆓", name: "무료", cost: "0원", desc: "규칙 판정 · PC 안의 순위 모델 · 포스터 글자 인식. 분석과 초안은 쓰시는 AI 채팅에서 대화로 (결과 붙여넣기).", note: "API 키가 필요 없어요." },
  { id: "save", icon: "💡", name: "절약", cost: "월 약 2천~7천 원", desc: "공고 분석·포스터 읽기는 저가 모델(Haiku·Flash·mini급), 초안은 중급 모델(Sonnet급).", note: "대부분의 사용자에게 추천해요." },
  { id: "best", icon: "✨", name: "최고 품질", cost: "월 약 1만~3만 원", desc: "분석·초안 모두 상위 모델. 초안을 항목별로 여러 버전 만들어요.", note: "지원서 품질이 가장 중요할 때." },
  { id: "custom", icon: "⚙️", name: "직접 설정", cost: "설정에 따라", desc: "분석 · 포스터 · 초안 · 학습마다 서비스와 모델을 따로 골라요.", note: "고급 사용자용." },
];

const TIPS: [string, string][] = [
  ["Gemini·ChatGPT로 쓸 때", "내 프로필을 Gem이나 ChatGPT 프로젝트에 한 번 저장해 두면, 다음부터는 공고 파일만 올리면 돼요."],
  ["Claude로 쓸 때", "PC 앱에서 만든 작업 폴더를 Cowork에 연결하면, 파일을 올릴 필요 없이 Claude가 바로 읽고 초안을 써요."],
  ["구독과 API는 달라요", "유료 채팅 구독과 API는 별개예요. API는 콘솔에서 따로 충전하고 쓴 만큼 빠져나가요. 처음엔 5달러 정도로 작게 시작하고 월 한도를 걸어두세요."],
  ["적합도 점수", "자격 40 · 목적 일치 30 · 역량·실적 20 · 지원 규모 10점으로 채점해요. 자격이 안 되면 30점 이하예요."],
  ["🔵 간접 참여", "직접 신청은 안 되지만 파트너나 협력자로 들어갈 수 있는 공고예요. 의견에 참여 방법이 적혀 있어요."],
  ["예정 공고", "작년 일정을 기준으로 미리 보여드려요. [미리 준비]로 초안 틀을 만들어 두면 공고 뒤 바로 제출할 수 있어요."],
  ["[확인 필요] 표시", "초안에서 자료가 없는 부분은 지어내지 않고 [확인 필요]로 비워 둬요."],
  ["인스타 공고", "인스타는 자동 수집이 안 돼요. 링크를 복사해 붙여넣거나 포스터를 캡처해서 끌어다 놓으세요."],
  ["★ 저장", "★한 공고만 본문과 분석이 저장돼요. 나머지는 마감 30일 뒤 자동으로 정리돼요."],
  ["교육·대관 탭", "교육과 대관 공고는 AI를 쓰지 않고 조건만으로 걸러서 비용이 들지 않아요."],
  ["휴대폰 알림 (iPhone)", "iOS 16.4 이상에서, 홈 화면에 추가한 아이콘으로 열어야 알림이 와요."],
];

export default function SettingsPage() {
  const { entities, keywords, setKeywords, enabledKinds, toggleKind, live, guest, exitGuest, theme, setTheme, state, hide, notices, userEmail, signOut, deletedNotices, restore, toast } = useApp();
  const [editing, setEditing] = useState<Entity | null>(null);
  const [mode, setMode] = usePref("mg-ai-mode", "save");
  const [openMode, setOpenMode] = useState<string | null>(null);
  const [ai, setAi] = usePref<ChatAI>("mg-chat-ai", "Claude");
  const [syncOpen, setSyncOpen] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const hiddenIds = Object.keys(state.hidden).filter((k) => state.hidden[k]);
  const REGIONS = ["서울", "경기", "인천", "광주", "전남", "부산", "대전", "대구", "전국"];

  return (
    <main className="px-4 sm:px-6 lg:px-10 pt-5 lg:pt-9 pb-16 max-w-5xl">
      <PageTitle title="설정" sub="나에게 맞는 공고만 모이도록" />
      <div className="lg:grid lg:grid-cols-[176px_minmax(0,1fr)] lg:gap-8 lg:items-start">
      <nav aria-label="설정 목차" className="hidden lg:flex flex-col gap-0.5 sticky top-8 text-[13.5px]">
        {NAV.map(([id, l]) => (
          <a key={id} href={`#${id}`} className="rounded-lg px-3 h-9 flex items-center text-mute hover:text-ink hover:bg-surface-2">{l}</a>
        ))}
      </nav>
      <div className="space-y-4 max-w-3xl">
        {guest && (
          <Card id="account" title="체험 모드">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0"><p className="font-semibold text-[14.5px]">로그인 없이 둘러보는 중</p><p className="text-[12.5px] text-mute">★·결정·지원 주체·메모는 이 브라우저에만 저장돼요. 다른 기기와 공유되지 않고, 브라우저 데이터를 지우면 함께 사라져요. 처음에는 {SHOWCASE_NAME ? `예시 계정(${SHOWCASE_NAME})` : "예시 계정"}의 지원 주체·키워드·AI 분석으로 보여줘요. 본인 정보로 바꿔도 돼요.</p></div>
              <Button size="sm" onClick={() => exitGuest()}>로그인</Button>
            </div>
          </Card>
        )}
        {live && !guest && (
          <Card id="account" title="내 계정">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0"><p className="font-semibold text-[14.5px] truncate">{userEmail}</p><p className="text-[12.5px] text-mute">이 계정의 ★·결정·설정이 PC와 휴대폰에 함께 보여요</p></div>
              <Button size="sm" onClick={() => signOut()}>로그아웃</Button>
            </div>
          </Card>
        )}

        <Card id="entities" title="지원 주체" desc="공고마다 주체별로 지원 가능 여부를 판정해요." tip="한 사람이 개인과 단체를 함께 등록할 수 있어요. 주거지·활동지역·활동년차(설립일)·보유 서류가 판정에 쓰여요.">
          <div className="grid sm:grid-cols-2 gap-2.5">
            {entities.map((e) => (
              <div key={e.id} className="rounded-xl border border-line hover:border-line-strong flex flex-col">
              <button onClick={() => setEditing(e)} className="text-left p-3.5 flex gap-3 flex-1">
                <span className="size-10 rounded-xl bg-brand-soft text-brand grid place-items-center shrink-0">{e.type === "개인 예술가" ? <UserRound size={19} /> : <Users size={19} />}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-[14.5px] truncate">{e.name}</p>
                  <p className="text-[12.5px] text-mute">{[e.type, residenceOf(e) ? `${e.type === "개인 예술가" ? "거주" : "소재"} ${placeLabel(residenceOf(e)!)}` : "주거지 미입력", careerLabel(e)].filter(Boolean).join(" · ")}</p>
                  {!!e.activityRegions?.length && <p className="text-[12px] text-mute truncate">활동: {e.activityRegions.map((a) => `${placeLabel(a)}${a.years ? ` ${a.years}년` : ""}${a.count ? ` ${a.count}회` : ""}`).join(", ")}</p>}
                  <p className="text-[12px] text-faint mt-0.5 truncate">서류: {e.documents.join(", ") || "없음"}</p>
                </div>
              </button>
              <Link href={`/profile?e=${e.id}`} className="border-t border-line px-3.5 h-10 flex items-center justify-between text-[13px] font-semibold text-brand-ink hover:bg-surface-2 rounded-b-xl">
                <span>{e.profile?.works?.length || e.profile?.bio ? `프로필 · 대표 작업 ${e.profile?.works?.length ?? 0}개` : "프로필 채우기 (초안 재료)"}</span><span aria-hidden>→</span>
              </Link>
              </div>
            ))}
            <button onClick={() => setEditing({ id: "e" + Date.now().toString(36), name: "", short: "", type: "개인 예술가", region: "", documents: [], activityRegions: [] })}
              className="rounded-xl border border-dashed border-line-strong p-3.5 text-[13.5px] text-mute flex items-center justify-center gap-1.5 hover:text-ink hover:border-ink min-h-[72px]"><Plus size={16} /> 주체 추가</button>
          </div>
        </Card>

        <Card id="kinds" title="보고 싶은 공고 종류" desc="끄면 탭과 수집이 함께 사라져요." tip="공고 종류가 잘못 분류됐으면 카드에서 바로 바꿀 수 있어요. 다음부터 더 정확해져요.">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
            {ALL_KINDS.map((k) => {
              const on = enabledKinds.includes(k);
              return (
                <button key={k} onClick={() => toggleKind(k)} aria-pressed={on}
                  className={cx(`k-${k}`, "h-12 rounded-xl border text-[14px] font-semibold flex items-center justify-center gap-2 transition-colors",
                    on ? "border-[var(--k)] bg-[var(--ks)] text-[var(--k)]" : "border-line text-faint")}>
                  <span className={cx("size-2 rounded-full", on ? "bg-[var(--k)]" : "bg-line-strong")} />{KIND_LABEL[k]}
                </button>
              );
            })}
          </div>
        </Card>

        <Card id="keywords" title="키워드" desc="공고 화면에서 키워드별로 골라 볼 수 있고, 카드에 #키워드로 표시돼요. 아트누리는 이 키워드로 직접 검색해서도 가져와요 (다음 수집부터)." tip="공고 제목·요약·분야에 키워드가 들어 있으면 그 키워드가 붙어요. 제외 키워드가 들어간 공고는 숨겨요.">
          <p className="text-[12.5px] font-semibold text-mute mb-2">추천 키워드 (눌러서 추가)</p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {SUGGESTED_KEYWORDS.filter((w) => !keywords.include.includes(w)).map((w) => (
              <button key={w} onClick={() => setKeywords({ ...keywords, include: [...keywords.include, w] })}
                className="h-8 px-3 rounded-full border border-dashed border-line-strong text-[13px] text-mute hover:text-brand-ink hover:border-brand">+ {w}</button>
            ))}
          </div>
          <p className="text-[12.5px] font-semibold text-mute mb-2 flex items-center gap-1">영문 추천 키워드 <Tip>해외 레지던시·페스티벌 공고는 영어로 올라와요. 한글 키워드도 음악↔music, 공연↔performance처럼 서로 찾아 주지만, 영어 단어를 직접 넣으면 더 정확해요. 영어는 단어 단위로 찾아요 (media는 multimedia에 걸리지 않아요).</Tip></p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {SUGGESTED_KEYWORDS_EN.filter((w) => !keywords.include.includes(w)).map((w) => (
              <button key={w} onClick={() => setKeywords({ ...keywords, include: [...keywords.include, w] })}
                className="h-8 px-3 rounded-full border border-dashed border-line-strong text-[13px] text-mute hover:text-brand-ink hover:border-brand">+ {w}</button>
            ))}
          </div>
          <p className="text-[12.5px] font-semibold text-mute mb-2">포함 <span className="font-normal">— 원하는 말을 직접 입력하고 Enter (한글·영문 모두)</span></p>
          <ChipInput words={keywords.include} tone="brand" placeholder="+ 키워드 추가" onChange={(w) => setKeywords({ ...keywords, include: w })} />
          <p className="text-[12.5px] font-semibold text-mute mb-2 mt-4">제외</p>
          <ChipInput words={keywords.exclude} tone="seal" placeholder="+ 제외할 말" onChange={(w) => setKeywords({ ...keywords, exclude: w })} />
        </Card>

        <Card id="regions" title="지역">
          <div className="flex flex-wrap gap-1.5">
            {REGIONS.map((r) => {
              const on = keywords.regions.includes(r);
              return (
                <button key={r} aria-pressed={on} onClick={() => setKeywords({ ...keywords, regions: on ? keywords.regions.filter((x) => x !== r) : [...keywords.regions, r] })}
                  className={cx("h-9 px-3.5 rounded-full text-[13.5px] border", on ? "border-brand bg-brand-soft text-brand-ink font-semibold" : "border-line-strong text-mute")}>{r}</button>
              );
            })}
          </div>
        </Card>

        <Card id="ai" title="AI 요금 모드" desc="언제든 바꿀 수 있어요." tip="유료 채팅 구독과 API는 별개예요. API는 각 서비스 콘솔에서 따로 충전하고 쓴 만큼 빠져나가요.">
          <div className="space-y-2">
            {MODES.map((m) => (
              <div key={m.id} className={cx("rounded-xl border transition-colors", mode === m.id ? "border-brand bg-brand-soft/40" : "border-line")}>
                <div className="flex items-center gap-3 p-3.5">
                  <button onClick={() => setMode(m.id)} aria-pressed={mode === m.id} className="flex items-center gap-3 flex-1 text-left">
                    <span className={cx("size-5 rounded-full border-2 grid place-items-center shrink-0", mode === m.id ? "border-brand" : "border-line-strong")}>
                      {mode === m.id && <span className="size-2.5 rounded-full bg-brand" />}
                    </span>
                    <span className="text-lg" aria-hidden>{m.icon}</span>
                    <span><span className="font-semibold text-[14.5px]">{m.name}</span><span className="block text-[12.5px] text-mute tnum">{m.cost}</span></span>
                  </button>
                  <button onClick={() => setOpenMode(openMode === m.id ? null : m.id)} aria-expanded={openMode === m.id} className="text-[12.5px] text-mute flex items-center gap-0.5 hover:text-ink">
                    자세히 <ChevronDown size={14} className={cx("transition-transform", openMode === m.id && "rotate-180")} />
                  </button>
                </div>
                {openMode === m.id && (
                  <div className="px-3.5 pb-3.5 pl-[68px] text-[13px] anim-fade">
                    <p>{m.desc}</p><p className="text-mute mt-1">{m.note}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          {mode !== "free" && <p className="text-[12.5px] text-mute mt-3">API 키는 PC 앱에서 입력해요 (PC 비밀번호 저장소에 보관). 월 예산 상한을 넘으면 무료 모드로 자동 전환돼요.</p>}
        </Card>

        <Card id="chat" title="대화로 쓰기에 쓸 AI" desc="초안과 분석을 대화로 할 때 버튼이 이 AI로 연결돼요. 구독 안에서 돼서 API 비용이 들지 않아요.">
          <div className="grid grid-cols-3 gap-2">
            {(["Claude", "Gemini", "ChatGPT"] as ChatAI[]).map((x) => (
              <button key={x} onClick={() => setAi(x)} aria-pressed={ai === x}
                className={cx("h-12 rounded-xl border text-[14.5px] font-semibold", ai === x ? "border-brand bg-brand-soft text-brand-ink" : "border-line text-mute")}>{x}</button>
            ))}
          </div>
          <p className="text-[12.5px] text-mute mt-3 flex items-start gap-1">
            {ai === "Claude" ? "PC 앱의 작업 폴더를 Cowork에 연결하면 Claude가 파일을 바로 읽고 초안을 써요." : "팁: 내 프로필을 " + (ai === "Gemini" ? "Gem" : "ChatGPT 프로젝트") + "에 한 번 저장해 두면, 다음부터는 공고 파일만 올리면 돼요."}
          </p>
        </Card>

        <Card id="mobile" title="휴대폰에서도 보기" desc="PC가 꺼져 있어도 휴대폰으로 새 공고를 보고, 저장한 공고를 확인해요."
          tip="무료 서비스 3개를 연결해요: 자동 일꾼(GitHub) · 내 전용 공고 수첩(Supabase) · 휴대폰으로 여는 내 주소(Vercel).">
          <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-3.5">
            {live && !guest ? <Cloud className="text-brand" /> : <Laptop className="text-amber" />}
            <div className="flex-1"><p className="font-semibold text-[14px]">{guest ? "체험 모드 (공고는 자동 수집, 내 표시는 이 브라우저에만)" : live ? "클라우드 동기화 켜짐" : "아직 연결 안 됨 (데모 모드)"}</p>
              <p className="text-[12.5px] text-mute">{guest ? "내 기록을 PC·휴대폰에서 함께 보려면 초대를 받아 로그인하거나, 직접 설치해서 쓰세요" : live ? "하루 2회 자동 수집 · 휴대폰과 PC가 같은 내용을 봐요" : "설정 마법사가 15~20분이면 대신 설정해 줘요"}</p></div>
            {!live && <Button variant="primary" size="sm" onClick={() => setSyncOpen(true)}>설정 시작</Button>}
          </div>
        </Card>

        <Card id="theme" title="화면">
          <div className="grid grid-cols-3 gap-2">
            {([["light", Sun, "밝게"], ["system", Monitor, "시스템"], ["dark", Moon, "어둡게"]] as const).map(([v, I, l]) => (
              <button key={v} onClick={() => setTheme(v)} aria-pressed={theme === v}
                className={cx("h-12 rounded-xl border text-[14px] font-semibold flex items-center justify-center gap-2", theme === v ? "border-brand bg-brand-soft text-brand-ink" : "border-line text-mute")}><I size={16} />{l}</button>
            ))}
          </div>
        </Card>

        {deletedNotices.length > 0 && (
          <Card id="deleted" title="삭제한 공고" desc={`${deletedNotices.length}건 — 다시 수집돼도 목록에 나오지 않아요.`}>
            <button className="text-[13.5px] font-semibold text-brand-ink mb-2" onClick={() => setShowDeleted((v) => !v)}>{showDeleted ? "접기" : "목록 보기"}</button>
            {showDeleted && (
              <ul className="divide-y divide-line border-y border-line mb-1">
                {deletedNotices.map((n) => (
                  <li key={n.id} className="flex items-center gap-2 py-2">
                    <span className="flex-1 min-w-0"><span className="block truncate text-[13.5px]">{n.title}</span><span className="text-[12px] text-faint">{n.org}</span></span>
                    <Button size="sm" variant="ghost" onClick={() => { restore(n.id); toast("복원했어요"); }}><RotateCcw size={14} /> 복원</Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {hiddenIds.length > 0 && (
          <Card id="hidden" title="숨긴 공고" desc={`${hiddenIds.length}건을 숨겼어요.`}>
            <ul className="text-[13.5px] space-y-1.5 mb-3">{hiddenIds.map((id) => <li key={id} className="truncate text-mute">· {notices.find((n) => n.id === id)?.title ?? id}</li>)}</ul>
            <Button size="sm" onClick={() => hiddenIds.forEach((id) => hide(id, false))}>모두 다시 보기</Button>
          </Card>
        )}

        <Card id="help" title="도움말">
          <div className="divide-y divide-line">
            {TIPS.map(([t, d]) => (
              <details key={t} className="group py-3">
                <summary className="flex items-center justify-between cursor-pointer list-none text-[14px] font-semibold">
                  {t}<ChevronDown size={16} className="text-faint transition-transform group-open:rotate-180" />
                </summary>
                <p className="text-[13.5px] text-mute mt-2 leading-relaxed">{d}</p>
              </details>
            ))}
          </div>
        </Card>
      </div>
      </div>

      <EntitySheet entity={editing} onClose={() => setEditing(null)} />
      <Sheet open={syncOpen} onClose={() => setSyncOpen(false)} title="휴대폰에서도 보기 설정">
        <ol className="space-y-4">
          {[
            ["세 서비스에 가입하기", "GitHub에 가입한 뒤, Supabase와 Vercel은 'Continue with GitHub'로 바로 가입해요. 카드 등록은 필요 없어요.", "약 5분"],
            ["연결 열쇠(토큰) 3개 붙여넣기", "마법사가 발급 페이지를 열어주고 누를 곳을 알려드려요. 토큰은 비밀번호와 같으니 다른 사람에게 보여주지 마세요.", "약 5분"],
            ["[자동 설정] 누르고 기다리기", "공고 수첩 만들기 → 자동 일꾼 만들기 → 휴대폰 주소 발급 → 첫 수집까지 앱이 대신 해요.", "약 3~5분"],
            ["휴대폰에서 QR 찍고 홈 화면에 추가", "iPhone은 공유 버튼 → '홈 화면에 추가', Android는 ⋮ → '앱 설치'. 알림도 허용해 주세요.", "약 2분"],
          ].map(([t, d, time], i) => (
            <li key={t} className="flex gap-3">
              <span className="size-7 shrink-0 rounded-full bg-brand text-white grid place-items-center text-[13px] font-bold dark:text-[#0f1413]">{i + 1}</span>
              <div><p className="font-semibold text-[14.5px]">{t} <span className="text-[12px] text-faint font-normal">{time}</span></p><p className="text-[13px] text-mute mt-0.5">{d}</p></div>
            </li>
          ))}
        </ol>
        <div className="mt-5 rounded-xl bg-surface-2 p-3.5 text-[12.5px] text-mute">
          클라우드에는 공고 목록 · ★ · 결정 · 지원 단계만 올라가요. API 키, 지원서 초안, 등록 문서는 <b className="text-ink">PC에만</b> 남아요.
        </div>
        <p className="text-[12.5px] text-faint mt-3">자동 설정 마법사는 PC 앱에서 실행돼요. 이미 Supabase를 쓰고 있다면 [직접 설정할게요]로 기존 프로젝트를 연결할 수 있어요.</p>
      </Sheet>
    </main>
  );
}
