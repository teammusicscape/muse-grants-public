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

export function extraTags(title: string): string[] {
  const tags: string[] = [];
  if (/대관료/.test(title)) tags.push("대관");
  if (/(해외|국제|international)/i.test(title)) tags.push("해외");
  if (/(청년|39세)/.test(title)) tags.push("청년");
  return tags;
}
