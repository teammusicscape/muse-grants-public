import type { Entity, Notice, Place } from "./types";

/**
 * 지역 조건 판정 — 지역문화재단 공고는 "주거지(주소지)" 또는 "활동지역" 기준이 있는 경우가 많다.
 * 수집·표시는 모두 하고, 지원 주체별로 부합 여부만 표시한다 (걸러내지 않음).
 */

export const SIDO = ["서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"] as const;

const SIDO_FULL: [RegExp, string][] = [
  [/서울(특별)?시?/, "서울"], [/경기도?/, "경기"], [/인천(광역)?시?/, "인천"], [/부산(광역)?시?/, "부산"],
  [/대구(광역)?시?/, "대구"], [/광주(광역)?시/, "광주"], [/대전(광역)?시?/, "대전"], [/울산(광역)?시?/, "울산"],
  [/세종(특별자치)?시?/, "세종"], [/강원(특별자치)?도?/, "강원"], [/충청북도|충북/, "충북"], [/충청남도|충남/, "충남"],
  [/전북(특별자치도)?|전라북도/, "전북"], [/전라남도|전남/, "전남"], [/경상북도|경북/, "경북"], [/경상남도|경남/, "경남"],
  [/제주(특별자치)?도?/, "제주"],
];

/** 시·도별 시·군·구 (지역문화재단이 있는 곳 위주) */
export const SIGUNGU: Record<string, string[]> = {
  서울: ["종로구", "중구", "용산구", "성동구", "광진구", "동대문구", "중랑구", "성북구", "강북구", "도봉구", "노원구", "은평구", "서대문구", "마포구", "양천구", "강서구", "구로구", "금천구", "영등포구", "동작구", "관악구", "서초구", "강남구", "송파구", "강동구"],
  경기: ["수원시", "성남시", "고양시", "용인시", "부천시", "안산시", "안양시", "남양주시", "화성시", "평택시", "의정부시", "시흥시", "파주시", "김포시", "광명시", "광주시", "군포시", "하남시", "오산시", "이천시", "안성시", "의왕시", "양주시", "구리시", "포천시", "여주시", "동두천시", "과천시", "가평군", "양평군", "연천군"],
  인천: ["중구", "동구", "미추홀구", "연수구", "남동구", "부평구", "계양구", "서구", "강화군", "옹진군"],
  부산: ["중구", "서구", "동구", "영도구", "부산진구", "동래구", "남구", "북구", "해운대구", "사하구", "금정구", "강서구", "연제구", "수영구", "사상구", "기장군"],
  대구: ["중구", "동구", "서구", "남구", "북구", "수성구", "달서구", "달성군", "군위군"],
  광주: ["동구", "서구", "남구", "북구", "광산구"],
  대전: ["동구", "중구", "서구", "유성구", "대덕구"],
  울산: ["중구", "남구", "동구", "북구", "울주군"],
  강원: ["춘천시", "원주시", "강릉시", "동해시", "태백시", "속초시", "삼척시", "홍천군", "횡성군", "영월군", "평창군", "정선군", "철원군", "화천군", "양구군", "인제군", "고성군", "양양군"],
  충북: ["청주시", "충주시", "제천시", "보은군", "옥천군", "영동군", "증평군", "진천군", "괴산군", "음성군", "단양군"],
  충남: ["천안시", "공주시", "보령시", "아산시", "서산시", "논산시", "계룡시", "당진시", "금산군", "부여군", "서천군", "청양군", "홍성군", "예산군", "태안군"],
  전북: ["전주시", "군산시", "익산시", "정읍시", "남원시", "김제시", "완주군", "진안군", "무주군", "장수군", "임실군", "순창군", "고창군", "부안군"],
  전남: ["목포시", "여수시", "순천시", "나주시", "광양시", "담양군", "곡성군", "구례군", "고흥군", "보성군", "화순군", "장흥군", "강진군", "해남군", "영암군", "무안군", "함평군", "영광군", "장성군", "완도군", "진도군", "신안군"],
  경북: ["포항시", "경주시", "김천시", "안동시", "구미시", "영주시", "영천시", "상주시", "문경시", "경산시", "의성군", "청송군", "영양군", "영덕군", "청도군", "고령군", "성주군", "칠곡군", "예천군", "봉화군", "울진군", "울릉군"],
  경남: ["창원시", "진주시", "통영시", "사천시", "김해시", "밀양시", "거제시", "양산시", "의령군", "함안군", "창녕군", "고성군", "남해군", "하동군", "산청군", "함양군", "거창군", "합천군"],
  제주: ["제주시", "서귀포시"],
  세종: [],
};

/** 시·군·구 이름 → 속한 시·도들 (중구·동구처럼 여러 곳에 있는 이름은 여러 개) */
const SGG_INDEX = new Map<string, string[]>();
for (const [sido, list] of Object.entries(SIGUNGU)) for (const g of list) SGG_INDEX.set(g, [...(SGG_INDEX.get(g) ?? []), sido]);
const stem = (g: string) => g.replace(/(시|군|구)$/, "");
/** 기관명 매칭용 정규식 (한 번만 만들기). "광주"처럼 시·도 이름과 같으면 "광주시"로만 매칭 */
const ORG_RES = [...SGG_INDEX].filter(([g]) => stem(g).length >= 2).map(([g, sidos]) => {
  const s = stem(g);
  const name = (SIDO as readonly string[]).includes(s) ? g : `${s}(?:${g.slice(-1)})?`;
  return { g, sidos, s, re: new RegExp(`^(?:[가-힣]{2,4}(?:특별시|광역시|도)?)?${name}(문화|예술|아트|시립|구립|군립|청|시청|구청|군청)`) };
});

function sidoOf(text: string): string | undefined {
  const t = text.trim();
  for (const s of SIDO) if (t.startsWith(s)) return s;
  for (const [re, s] of SIDO_FULL) if (re.test(text)) return s;
  return undefined;
}

/** 기관명에서 지역 찾기: "(재)마포문화재단" → 서울 마포구, "경기문화재단" → 경기 */
export function placeFromOrg(org: string): Place | undefined {
  const o = org.replace(/\(재\)|재단법인|\s/g, "");
  if (!o) return undefined;
  if (/^세종문화회관/.test(o)) return { sido: "서울" };
  // ① 시·군·구 문화재단/문화원/아트센터 (이름이 2자 이상이고 한 시·도에만 있는 경우)
  for (const { g, sidos, s, re } of ORG_RES) {
    if (re.test(o)) {
      const prefixSido = sidoOf(o.slice(0, o.indexOf(s)));
      if (sidos.length === 1) return { sido: sidos[0], sigungu: g };
      if (prefixSido && sidos.includes(prefixSido)) return { sido: prefixSido, sigungu: g };
    }
  }
  // ② 시·도 문화재단 등
  if (/^(서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|충청|전북|전라|전남|경북|경상|경남|제주)/.test(o) && /(문화|예술|아트|시립|도립|광역|특별|청)/.test(o)) {
    const s = sidoOf(o);
    if (s) return { sido: s };
  }
  return undefined;
}

/** 본문에서 "OO 거주", "OO 소재" 문구로 지역 찾기 */
function placeFromText(text: string): Place | undefined {
  const m = /([가-힣]{2,10})\s*(?:에\s*)?(거주|주소지|소재|주민등록)/.exec(text);
  if (!m) return undefined;
  const w = m[1];
  for (const [g, sidos] of SGG_INDEX) if (w.endsWith(g) || (stem(g).length >= 2 && !(SIDO as readonly string[]).includes(stem(g)) && w.endsWith(stem(g)))) {
    if (sidos.length === 1) return { sido: sidos[0], sigungu: g };
    const s = sidoOf(w);
    if (s && sidos.includes(s)) return { sido: s, sigungu: g };
  }
  const s = sidoOf(w);
  return s ? { sido: s } : undefined;
}

export type NoticePlace = Place | "전국" | null;

/** 공고의 지역 (null = 알 수 없음/해당 없음) */
export function noticePlace(n: Pick<Notice, "org" | "region" | "title" | "summary" | "overseas" | "kind" | "grant" | "targets">): NoticePlace {
  // 지역(거주) 조건은 지원사업·국내 레지던시에만 판정 (교육·대관·용역은 장소일 뿐 자격 조건이 아닌 경우가 대부분)
  if (n.kind !== "grant" && n.kind !== "residency") return null;
  if (n.overseas) return null;
  const text = `${n.title} ${n.summary ?? ""} ${n.grant?.eligibility ?? ""} ${(n.targets ?? []).join(" ")}`;
  const t = placeFromText(text);
  if (t) return t;
  if (/(거주\s*요건\s*없|지역\s*제한\s*없|지역\s*무관|전국\s*(누구나|예술인|단위))/.test(text)) return "전국";
  // 레지던시는 기관 위치 ≠ 지원 자격 → 본문에 거주 조건이 있을 때만
  if (n.kind === "residency") return /(거주|주소지|소재)/.test(text) ? placeFromOrg(n.org ?? "") ?? null : null;
  const org = placeFromOrg(n.org ?? "");
  if (org) return org;
  if (n.region) {
    if (/전국|해외|온라인/.test(n.region)) return "전국";
    const s = sidoOf(n.region);
    if (s) return { sido: s };
  }
  return null;
}

export function placeLabel(p: Place): string {
  return p.sigungu ? `${p.sido} ${p.sigungu}` : p.sido;
}

/** 공고 본문에 활동 이력으로도 가능하다는 문구가 있는지 */
export function mentionsActivityRule(n: Pick<Notice, "title" | "summary" | "grant">): boolean {
  return /(활동\s*(중|하는|이력|실적|근거|경력)|근거지|활동한|연고)/.test(`${n.title} ${n.summary ?? ""} ${n.grant?.eligibility ?? ""}`);
}

export type RegionStatus = "match" | "activity" | "check" | "mismatch" | "unknown";
export const REGION_STATUS_LABEL: Record<RegionStatus, string> = {
  match: "거주지 부합",
  activity: "활동지역 부합",
  check: "세부 지역 확인",
  mismatch: "지역 조건 다름",
  unknown: "주거지 미입력",
};

export interface RegionFit {
  entityId: string;
  place: Place;
  status: RegionStatus;
  note?: string;
}

/** 주체의 주거지(없으면 예전 region 값) */
export function residenceOf(e: Entity): Place | undefined {
  if (e.residence?.sido) return e.residence;
  if (e.region && (SIDO as readonly string[]).includes(e.region)) return { sido: e.region };
  return undefined;
}

function samePlace(a: Place, p: Place): "yes" | "partial" | "no" {
  if (a.sido !== p.sido) return "no";
  if (!p.sigungu) return "yes";
  if (!a.sigungu) return "partial";
  return a.sigungu === p.sigungu ? "yes" : "no";
}

/** 지원 주체 한 명에 대한 지역 조건 판정 */
export function regionFit(n: Notice, e: Entity, place: NoticePlace = noticePlace(n)): RegionFit | null {
  if (!place || place === "전국") return null;
  const res = residenceOf(e);
  const r = res ? samePlace(res, place) : "no";
  if (r === "yes") return { entityId: e.id, place, status: "match" };
  for (const a of e.activityRegions ?? []) {
    const s = samePlace(a, place);
    if (s === "yes") {
      const bits = [a.years ? `${a.years}년` : "", a.count ? `${a.count}회` : ""].filter(Boolean).join("·");
      return { entityId: e.id, place, status: "activity", note: `${placeLabel(a)} 활동${bits ? " " + bits : ""} — 공고의 활동 기준(기간·횟수)을 확인하세요` };
    }
  }
  if (r === "partial") return { entityId: e.id, place, status: "check", note: `공고는 ${placeLabel(place)} 기준 — 주거지 시·군·구를 입력하면 정확해져요` };
  if (!res) return { entityId: e.id, place, status: "unknown", note: "설정 → 지원 주체에서 주거지를 입력하면 판정해요" };
  return { entityId: e.id, place, status: "mismatch", note: `내 주거지 ${placeLabel(res)} — 이사를 고려하거나 활동지역 조건을 확인해 보세요` };
}

const RANK: RegionStatus[] = ["match", "activity", "check", "unknown", "mismatch"];
/** 여러 주체 중 가장 좋은 판정 (카드 배지용) */
export function bestRegionFit(n: Notice, entities: Entity[]): RegionFit | null {
  const place = noticePlace(n);
  if (!place || place === "전국") return null;
  const fits = entities.map((e) => regionFit(n, e, place)).filter((x): x is RegionFit => !!x);
  if (!fits.length) return { entityId: "", place, status: "unknown" };
  return fits.sort((a, b) => RANK.indexOf(a.status) - RANK.indexOf(b.status))[0];
}

/** 활동년차 (개인) / 업력 (단체·사업자) 표시 */
export function careerLabel(e: Entity, now = new Date()): string | undefined {
  if (e.type === "개인 예술가") {
    if (!e.activityStartYear) return undefined;
    return `활동 ${now.getFullYear() - e.activityStartYear + 1}년차`;
  }
  if (!e.foundedAt) return undefined;
  const d = new Date(e.foundedAt);
  const years = (now.getTime() - d.getTime()) / (365.25 * 864e5);
  return years < 1 ? `설립 ${Math.max(1, Math.round(years * 12))}개월` : `설립 ${Math.floor(years)}년차`;
}
