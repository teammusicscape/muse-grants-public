import type { NoticeKind } from "./types";

/** 출처 기준 1차 분류 */
const SOURCE_KIND: Record<string, NoticeKind> = {
  나라장터: "service",
  "문화예술 내일": "edu",
  아트모아: "edu",
  "해외레지던스": "residency",
};

/** 제목 키워드 2차 분류 (앞에 있을수록 우선) */
const RULES: [RegExp, NoticeKind][] = [
  [/대관료\s*지원/, "grant"], // 대관료 지원은 지원사업 (+대관 태그)
  [/(용역|입찰|제안서\s*공모|위탁\s*운영\s*사업자)/, "service"],
  [/(레지던시|레지던스|입주\s*작가|입주\s*예술가|입주\s*단체|창작\s*공간\s*입주|창작스튜디오\s*입주|residency|artist[-\s]in[-\s]residence)/i, "residency"],
  [/(수강생|교육생|아카데미|워크숍|워크샵|강좌|연수|클래스|교육\s*참가자|교육과정)/, "edu"],
  [/(대관|공간\s*대여|정기\s*대관|수시\s*대관|공연장\s*사용)/, "venue"],
];

export function classifyKind(title: string, source?: string): NoticeKind {
  if (source && SOURCE_KIND[source]) return SOURCE_KIND[source];
  for (const [re, kind] of RULES) if (re.test(title)) return kind;
  return "grant";
}

/** 창업·스타트업 지원 공고 (K-Startup 등) — 탭은 지원사업, "창업" 태그로 따로 보거나 뺄 수 있음 */
export const STARTUP_RE = /(창업|스타트업|start-?up|벤처|액셀러레이|엑셀러레이|투자\s*유치|사업화\s*지원|예비\s*기업가)/i;
export const isStartup = (n: { tags: string[] }) => n.tags.includes("창업");

export function extraTags(title: string, source?: string): string[] {
  const tags: string[] = [];
  if (source === "K-Startup" || STARTUP_RE.test(title)) tags.push("창업");
  if (/대관료/.test(title)) tags.push("대관");
  if (/(해외|국제|international)/i.test(title)) tags.push("해외");
  if (/(청년|39세)/.test(title)) tags.push("청년");
  return tags;
}
