import { careerLabel, KIND_LABEL, placeLabel, profileText, residenceOf, type Draft, type DraftSection, type Entity, type Notice } from "@muse/core";
import { detailRows } from "@/components/meta";

function noticeBlock(n: Notice) {
  const rows = detailRows(n).filter(([, v]) => v).map(([k, v]) => `- ${k}: ${v}`).join("\n");
  return `## 공고
- 제목: ${n.title}
- 종류: ${KIND_LABEL[n.kind]}
- 기관: ${n.org}${n.region ? ` (${n.region})` : ""}
- 마감: ${n.deadline ?? n.deadlineLabel ?? "확인 필요"}
- 원문: ${n.url}
${rows}
${n.summary ? `- 내용: ${n.summary}` : ""}`;
}

function entityBlock(es: Entity[]) {
  return "## 지원 주체\n" + es.map((e) => {
    const res = residenceOf(e);
    const acts = (e.activityRegions ?? []).map((a) => `${placeLabel(a)}${a.years ? ` ${a.years}년` : ""}${a.count ? ` ${a.count}회` : ""}`).join(", ");
    return `- [${e.id}] ${e.name} · ${e.type} · ${res ? `${e.type === "개인 예술가" ? "주거지" : "소재지"} ${placeLabel(res)}` : "주거지 미입력"}${acts ? ` · 활동지역 ${acts}` : ""}${careerLabel(e) ? ` · ${careerLabel(e)}` : ""} · 보유 서류: ${e.documents.join(", ") || "없음"}${e.profile?.headline ? ` · ${e.profile.headline}` : ""}${e.profile?.genres?.length ? ` · 분야 ${e.profile.genres.join("/")}` : ""}${e.profile?.works?.length ? ` · 대표 작업 ${e.profile.works.slice(0, 3).map((w) => w.title).join(", ")}` : ""}`;
  }).join("\n");
}

/** 수동 모드 분석 프롬프트 (결과는 JSON으로 받아 다시 붙여넣기) */
export function analyzePrompt(n: Notice, es: Entity[]) {
  return `당신은 한국 문화예술 지원사업 전문 컨설턴트입니다. 아래 공고를 각 지원 주체 기준으로 판정해 주세요.
가능하면 공고 원문 링크를 열어 확인하고, 확인되지 않은 내용은 추측하지 말고 "[확인 필요]"라고 쓰세요.

${noticeBlock(n)}

${entityBlock(es)}

## 판정 기준
- status: now(지금 지원 가능) / prep(준비하면 가능) / indirect(직접 신청은 안 되지만 파트너·협력으로 참여 가능) / no(불가)
- prep이면 gaps에 부족한 항목, 준비 방법, 걸리는 일수(days)를 적기
- 적합도: eligibility(자격 충족, 0~40) + purpose(목적 일치, 0~30) + capacity(역량·실적, 0~20) + scale(규모 적정성, 0~10). 자격 미달이면 합계 30 이하
- grade: 강추(80+) / 추천(60+) / 검토(40+) / 비추

## 출력 (JSON만, 설명 없이)
{"verdicts":[{"entityId":"me","status":"now","reason":"","gaps":[{"item":"","how":"","days":0}]}],
 "fit":{"eligibility":0,"purpose":0,"capacity":0,"scale":0},
 "grade":"추천","pros":["맞는 점"],"cons":["주의할 점"],"opinion":"전략 의견 2~3문장"}`;
}

/** 대화로 쓰기 시작 문장 */
export function draftStarter(n: Notice, es: Entity[], ai: string) {
  const upload = ai === "Claude"
    ? "PC 앱에서 만든 지원서 작업 폴더를 Cowork에 연결했다면, 폴더의 00_작성가이드.md부터 읽어 주세요."
    : "첨부한 파일(공고요약, 자격판정, 내프로필, 양식)을 먼저 읽어 주세요.";
  return `이 공고에 낼 지원서 초안을 함께 쓰고 싶어요. ${upload}

${noticeBlock(n)}

${entityBlock(es)}

## 작성 규칙
1. 공고 양식의 목차 순서를 따르고, 양식이 없으면: 사업 개요 / 신청자 소개 및 역량 / 추진 배경 및 필요성 / 사업 목표 / 세부 추진 내용 / 추진 일정 / 예산 계획 / 기대효과 및 성과지표 / 사업 이후 지속 계획
2. 내가 준 자료에 있는 사실만 쓰고, 없는 수치·일정·예산은 [확인 필요: 무엇]으로 비워 두기
3. 마지막에 "채워야 할 정보" 목록과 "제출 서류 체크리스트"를 따로 정리
4. 심사 기준 용어를 반영하고, 개조식과 짧은 문장, 항목별 400~900자

먼저 공고의 핵심(목적·심사 기준·필수 서류)을 요약하고, 어떤 방향으로 쓸지 제안해 주세요.`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseAIJson(text: string): any {
  const t = text.replace(/```(?:json)?/gi, "").trim();
  try { return JSON.parse(t); } catch { /* 계속 */ }
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s < 0 || e < s) throw new Error("답변에서 결과(JSON)를 찾지 못했어요. 답변 전체를 복사했는지 확인해 주세요.");
  try { return JSON.parse(t.slice(s, e + 1)); } catch { throw new Error("결과 형식이 올바르지 않아요. AI에게 'JSON만 다시 출력해줘'라고 요청해 보세요."); }
}


/* ───────────── 프로필 자동 채우기 ───────────── */

export function profilePrompt(e: Entity, pasted: string) {
  return `아래 자료에서 지원서에 쓸 "${e.name}"(${e.type})의 프로필을 정리해 주세요.
${pasted.trim() ? "## 자료 (붙여넣은 글)\n" + pasted.trim().slice(0, 30000) : "## 자료\n첨부한 파일(소개서·이전 지원서·포트폴리오·이력서)을 읽어 주세요. 웹사이트 주소가 있으면 열어서 읽어 주세요."}

## 지금 저장된 프로필 (겹치는 내용은 다시 쓰지 않아도 됨)
${profileText(e.profile)}

## 규칙
- 자료에 있는 사실만. 추측하거나 꾸미지 말고, 모르는 칸은 빈 문자열이나 빈 배열로
- 연도는 "2026" 또는 "2024–2026" 형식. 작업은 최신순
- bio는 3인칭 300~600자, 지원서에 바로 쓸 수 있는 문장
- detail에는 장소·역할·기관 등 짧게

## 출력 (JSON만, 설명 없이)
{"headline":"한 줄 소개","bio":"소개문","genres":["분야"],
 "works":[{"year":"","title":"작업/공연/전시명","detail":"장소·역할","link":""}],
 "career":[{"year":"","title":"직함·기관","detail":""}],
 "awards":[{"year":"","title":"수상·선정·지원사업명","detail":"기관"}],
 "residencies":[{"year":"","title":"레지던시·교류","detail":"국가·기관"}],
 "education":[{"year":"","title":"학교·학위","detail":""}],
 "members":"(단체일 때) 구성원과 역할","links":[{"label":"홈페이지","url":""}]}`;
}

/* ───────────── 초안 ───────────── */

function draftContext(n: Notice, e: Entity | undefined, d: Draft) {
  const v = n.analysis?.verdicts.find((x) => x.entityId === e?.id);
  return `## 공고
${noticeBlock(n)}
${d.criteria.length ? `\n## 심사 기준\n${d.criteria.map((c) => `- ${c}`).join("\n")}` : ""}
${v ? `\n## 자격 판정 (${e?.short})\n- ${v.status}${v.reason ? ` — ${v.reason}` : ""}${v.gaps?.length ? "\n- 부족한 부분: " + v.gaps.map((g) => g.item).join(", ") : ""}` : ""}

## 신청 주체: ${e?.name ?? "(미선택)"} (${e?.type ?? ""})
${e ? profileText(e.profile) : ""}`;
}

const RULES = `## 작성 규칙
1. 위 프로필·자료에 있는 사실만 쓰기. 없는 수치·일정·인원·예산·기관명은 [확인 필요: 무엇]으로 비워 두기
2. 공고 목적과 심사 기준의 용어를 자연스럽게 반영
3. 개조식과 짧은 문장, 과장·미사여구 없이 구체적으로
4. 항목별 글자 수 제한(공백 포함)을 넘지 않기`;

/** 양식·공고문에서 목차·심사 기준·제출 서류 뽑기 */
export function outlinePrompt(n: Notice) {
  return `첨부한 공고문·신청서 양식 파일을 읽고, 지원서에서 작성해야 하는 항목(목차·표의 서술 칸)과 심사 기준, 제출 서류를 뽑아 주세요.
공고: ${n.title} (${n.org})${n.url ? ` · ${n.url}` : ""}

## 규칙
- 양식에 나온 순서와 이름 그대로. 성명·연락처 같은 단순 기재 칸은 빼고 "서술형" 칸만
- guide에는 양식의 작성 안내(괄호 설명 등)를 짧게, limit은 글자 수 제한이 있으면 숫자(없으면 0)
- 양식이 영어면 제목은 영어 그대로

## 출력 (JSON만)
{"sections":[{"title":"","guide":"","limit":0}],"criteria":["심사 기준과 배점"],"checklist":["제출 서류"]}`;
}

/** 전체 초안 한 번에 */
export function fullDraftPrompt(n: Notice, e: Entity | undefined, d: Draft) {
  const secs = d.sections.map((s, i) => `${i + 1}. ${s.title}${s.limit ? ` (${s.limit}자 이내)` : ""}${s.guide ? ` — ${s.guide}` : ""}${s.content.trim() ? `\n   [지금 쓴 내용 — 살려서 다듬기]\n   ${s.content.trim().slice(0, 1500).replace(/\n/g, "\n   ")}` : ""}`).join("\n");
  return `이 공고에 낼 지원서 초안을 써 주세요. 첨부한 공고문·양식 파일이 있으면 먼저 읽어 주세요.

${draftContext(n, e, d)}
${d.memo?.trim() ? `\n## 내 메모 (방향·강조점)\n${d.memo.trim()}` : ""}

## 작성할 항목
${secs}

${RULES}

## 출력 형식 (앱이 항목별로 나눠 넣어요 — 꼭 지켜 주세요)
각 항목을 "### 번호. 항목 제목" 줄로 시작하고 그 아래에 내용만 쓰기. 앞뒤 설명 없이.
마지막에 "### 채워야 할 정보" 항목으로 [확인 필요] 목록과 준비 방법을 정리.`;
}

export type SectionAsk = "write" | "shorter" | "concrete" | "criteria" | "bullets" | "custom";
export const SECTION_ASK: [SectionAsk, string][] = [
  ["write", "이 항목 쓰기"], ["shorter", "더 짧게"], ["concrete", "더 구체적으로"], ["criteria", "심사 기준 반영"], ["bullets", "개조식으로"], ["custom", "직접 요청…"],
];
const ASK_TEXT: Record<SectionAsk, string> = {
  write: "이 항목을 새로 써 주세요.",
  shorter: "지금 내용을 핵심만 남겨 더 짧게 줄여 주세요.",
  concrete: "추상적인 표현을 줄이고 프로필의 실제 작업·수치로 더 구체적으로 고쳐 주세요.",
  criteria: "심사 기준에 맞춰 평가자가 점수를 주기 쉽게 고쳐 주세요.",
  bullets: "개조식(• 짧은 문장)으로 바꿔 주세요.",
  custom: "",
};

/** 항목 하나만 쓰기·고치기 (같은 대화에 이어서 붙여넣어도 되게 맥락을 짧게 포함) */
export function sectionPrompt(n: Notice, e: Entity | undefined, d: Draft, s: DraftSection, ask: SectionAsk, custom = "") {
  const others = d.sections.filter((x) => x.id !== s.id && x.content.trim()).map((x) => `- ${x.title}: ${x.content.trim().slice(0, 160).replace(/\n/g, " ")}…`).join("\n");
  return `지원서의 "${s.title}" 항목${ask === "write" ? "을 써" : "을 고쳐"} 주세요. ${ask === "custom" ? custom : ASK_TEXT[ask]}
${s.guide ? `항목 안내: ${s.guide}` : ""}${s.limit ? `\n글자 수: ${s.limit}자 이내 (공백 포함)` : ""}
${s.content.trim() ? `\n## 지금 내용\n${s.content.trim()}` : ""}
${others ? `\n## 다른 항목 요약 (겹치지 않게)\n${others}` : ""}

${draftContext(n, e, d)}

${RULES}

## 출력
이 항목의 본문만 (제목·설명 없이).`;
}
