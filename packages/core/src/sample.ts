/**
 * 데모 모드 샘플 데이터 — 실제 공고가 아닙니다.
 * Supabase가 연결되지 않았을 때 화면을 확인하기 위한 예시입니다.
 * 마감일은 "오늘" 기준 상대 날짜로 만들어서 항상 살아 있는 화면이 되도록 합니다.
 */
import type { Entity, KeywordSet, Notice } from "./types";
import type { Platform } from "./platform";

/** 데모용 플랫폼 (실제 K-GO 디렉토리는 수집기가 채움) */
export const SAMPLE_PLATFORMS: Platform[] = [
  { id: "demo-1", source: "K-GO", field: "공연", name: "예시 사운드 페스티벌", nameEn: "Example Sound Festival", type: "페스티벌", genres: ["복합"], continent: "유럽", country: "독일", city: "베를린", homepage: "https://example.org" },
];
import { addDays, todayISO } from "./date";

export const SAMPLE_ENTITIES: Entity[] = [
  { id: "me", name: "홍길동 (개인 예술가)", short: "개인", type: "개인 예술가", region: "서울", residence: { sido: "서울", sigungu: "마포구" }, activityRegions: [{ sido: "광주", years: 2, count: 3 }], activityStartYear: 2016, documents: ["예술활동증명", "포트폴리오"] },
  { id: "tm", name: "예시 예술단체", short: "단체", type: "예술단체", region: "서울", residence: { sido: "서울" }, foundedAt: "2023-03-01", documents: ["포트폴리오", "단체 소개서"] },
];

/** 실제 사용 시작할 때의 기본 설정 (사용자가 설정에서 바꿈) */
export const DEFAULT_KEYWORDS: KeywordSet = {
  include: [],
  exclude: [],
  regions: ["전국"],
  kinds: ["grant", "service", "edu", "venue", "residency"],
  v: 2,
};

/** 설정에서 한 번에 고를 수 있는 추천 키워드 */
export const SUGGESTED_KEYWORDS = ["음악", "공연", "미디어아트", "사운드", "다원예술", "융복합", "레지던시", "창작", "국악", "전시", "영상", "기술", "해외", "청년", "대관료", "교육", "아카데미", "예술기업"];
/** 해외 공고(영문)용 추천 키워드 */
export const SUGGESTED_KEYWORDS_EN = ["music", "sound", "performance", "media", "media art", "new media", "electronic", "interdisciplinary", "technology", "composer", "audiovisual", "installation"];

export const SAMPLE_KEYWORDS: KeywordSet = {
  include: ["미디어아트", "사운드", "음악", "공연", "융복합", "다원", "레지던시", "전자음악", "창작", "국악"],
  exclude: ["아동 대상 한정", "연극 단독"],
  regions: ["서울", "경기", "인천", "광주", "전남", "부산", "전국"],
  kinds: ["grant", "service", "edu", "venue", "residency"],
  v: 2,
};

type Draft = Omit<Notice, "deadline" | "checkedAt" | "postedAt"> & { d: number | null; p?: number };

const RAW: Draft[] = [
  {
    id: "s1", kind: "grant", d: 5, p: -9,
    title: "2026 다원예술 창작지원 (하반기)", org: "서울문화재단", sources: ["아트누리", "서울문화재단"],
    url: "https://www.sfac.or.kr", region: "서울", fields: ["다원예술", "융복합"], tags: [],
    summary: "장르 경계를 넘나드는 다원·융복합 예술 신작 제작을 지원합니다. 발표 공간 연계 가능.",
    grant: { amount: "최대 2,000만원", eligibility: "서울 소재 예술인·예술단체", period: "2026.11 ~ 2027.03" },
    posterColor: "#2D6E66",
    analysis: {
      by: "api", analyzedAt: "", grade: "강추",
      verdicts: [
        { entityId: "me", status: "now" },
        { entityId: "tm", status: "prep", gaps: [{ item: "고유번호증", how: "관할 세무서 신청", days: 7 }] },
      ],
      fit: { eligibility: 38, purpose: 28, capacity: 16, scale: 7 },
      pros: ["사운드·영상·공간을 결합한 작업이 다원예술 취지와 직접 맞음", "레지던시 결과 발표와 연계 가능"],
      cons: ["단체 명의 신청 시 고유번호증 필요", "경쟁률이 높은 편"],
      opinion: "개인 명의로 바로 지원 가능합니다. 전시형 실험을 신작 개발의 근거로 강조하세요.",
    },
  },
  {
    id: "s2", kind: "grant", d: 12, p: -3,
    title: "2027 해외 레지던시 파견 지원 (미디어·사운드 분야)", org: "한국문화예술위원회", sources: ["NCAS"],
    url: "https://www.ncas.or.kr", region: "전국", fields: ["미디어아트", "음악"], tags: ["해외"], overseas: true,
    summary: "해외 레지던시 기관에 입주하는 예술가의 항공·체재비를 지원합니다.",
    files: [
      { name: "2027 해외 레지던시 파견 지원 공고문(예시).pdf", url: "https://example.org/sample-notice.pdf", preview: { seNo: "000", fileSn: "0" } },
      { name: "지원신청서 양식(예시).hwp", url: "https://example.org/sample-form.hwp" },
    ],
    grant: { amount: "1인 최대 1,200만원", eligibility: "개인 예술가 (예술활동증명 필수)", period: "2027.03 ~ 2027.12" },
    posterColor: "#3B5BA9",
    analysis: {
      by: "manual", analyzedAt: "", grade: "강추",
      verdicts: [{ entityId: "me", status: "now" }, { entityId: "tm", status: "no", reason: "개인 대상 사업" }],
      fit: { eligibility: 40, purpose: 27, capacity: 18, scale: 8 },
      pros: ["해외 레지던시 수행 경험", "예술활동증명 보유"],
      cons: ["입주 기관 초청장이 필요할 수 있음 [확인 필요]"],
      opinion: "해외 레지던시 경험이 있어 선정 가능성이 높습니다. 초청장 확보 일정을 먼저 확인하세요.",
    },
  },
  {
    id: "s3", kind: "grant", d: 2, p: -20,
    title: "공연예술 대관료 지원 (4차)", org: "예술경영지원센터", sources: ["아트누리", "예술경영지원센터"],
    url: "https://www.gokams.or.kr", region: "전국", fields: ["공연"], tags: ["대관"],
    summary: "민간 공연장·공공 공연장 대관료의 일부를 지원합니다.",
    grant: { amount: "대관료의 최대 70%", eligibility: "공연 단체 및 개인", period: "2026.12 이전 공연" },
    posterColor: "#7A4B8C",
    analysis: {
      by: "rule", analyzedAt: "",
      verdicts: [{ entityId: "me", status: "now" }, { entityId: "tm", status: "now" }],
    },
  },
  {
    id: "s4", kind: "grant", d: 21, p: -1,
    title: "예술기술 융합 프로젝트 공모 — 사운드 인터랙션", org: "한국콘텐츠진흥원", sources: ["웹"],
    url: "https://www.kocca.kr", region: "전국", fields: ["융복합", "사운드"], tags: [],
    summary: "공간 음향, 인터랙티브 사운드 기술을 활용한 창작 프로젝트의 제작비를 지원합니다.",
    grant: { amount: "과제당 5,000만원 내외", eligibility: "개인사업자·법인 (업력 7년 이내)", period: "2027.01 ~ 2027.10" },
    posterColor: "#1E2A2B",
    analysis: {
      by: "api", analyzedAt: "", grade: "추천",
      verdicts: [
        { entityId: "me", status: "prep", gaps: [{ item: "개인사업자 등록", how: "홈택스 온라인 신청", days: 3 }] },
        { entityId: "tm", status: "prep", gaps: [{ item: "사업자 등록 (단체 → 개인사업자/법인)", how: "세무서", days: 7 }] },
      ],
      fit: { eligibility: 22, purpose: 29, capacity: 14, scale: 9 },
      pros: ["공간 음향 설계 경험이 과제 취지와 일치"],
      cons: ["사업자 등록이 선행되어야 함", "자부담 10% [확인 필요]"],
      opinion: "사업자 등록을 마치면 적합도가 높아집니다. 마감까지 3주라 지금 준비하면 충분합니다.",
    },
  },
  {
    id: "s5", kind: "grant", d: null, deadlineLabel: "예정", lastYear: "작년 접수 9/23 ~ 10/30",
    title: "2027 문예진흥기금 정기공모", org: "한국문화예술위원회", sources: ["연간 공모"],
    url: "https://www.arko.or.kr", region: "전국", fields: ["창작"], tags: [],
    summary: "매년 가을 공고되는 정기공모입니다. 작년 일정 기준으로 미리 보여드려요.",
    grant: { amount: "사업별 상이" }, posterColor: "#8A5E0E",
  },
  {
    id: "s6", kind: "residency", d: 9, p: 0,
    title: "광주 아시아 미디어아트 창작 레지던시 입주 작가 모집", org: "광주문화재단", sources: ["IG"],
    url: "https://www.instagram.com", region: "광주", fields: ["미디어아트"], tags: [],
    summary: "포스터에서 추출한 정보입니다. 광주 거주 또는 광주에서 2년 이상 활동한 미디어아트 작가. 입주 기간 3개월, 창작 지원금 포함.",
    grant: { amount: "창작 지원금 600만원", eligibility: "국내 미디어아트 작가" },
    posterColor: "#B8321F", needsReview: true,
  },
  {
    id: "s7", kind: "grant", d: -2, p: -30,
    title: "2026 지역 문화예술 특성화 지원 (추가)", org: "부산문화재단", sources: ["아트누리"],
    url: "https://www.bscf.or.kr", region: "부산", fields: ["공연"], tags: [],
    grant: { amount: "최대 1,500만원", eligibility: "부산 소재 단체" }, posterColor: "#5C6A69",
    analysis: { by: "rule", analyzedAt: "", verdicts: [{ entityId: "me", status: "no", reason: "부산 소재 요건" }, { entityId: "tm", status: "no", reason: "부산 소재 요건" }] },
  },
  {
    id: "s8", kind: "grant", d: 12, p: -3,
    title: "2026 마포 예술인 창작활동 지원", org: "마포문화재단", sources: ["아트누리"],
    url: "https://www.mfac.or.kr", region: "서울", fields: ["창작", "음악"], tags: [],
    summary: "마포구 거주 예술인 또는 최근 2년간 마포구에서 3회 이상 활동한 예술인의 창작을 지원합니다.",
    grant: { amount: "개인 300만원", eligibility: "마포구 거주 또는 마포구 활동 예술인" }, posterColor: "#2D6E66",
  },
  {
    id: "s9", kind: "grant", d: 16, p: -1,
    title: "부천 예술인 창작 지원사업 2차", org: "부천문화재단", sources: ["아트누리"],
    url: "https://www.bcf.or.kr", region: "경기", fields: ["창작"], tags: [],
    summary: "공고일 기준 부천시에 주소지를 둔 예술인·단체 대상.",
    grant: { amount: "최대 700만원", eligibility: "부천시 거주 예술인" }, posterColor: "#7A4B8C",
  },
  // 레지던시
  {
    id: "r1", kind: "residency", d: 20, p: -2,
    title: "2027 인천아트플랫폼 입주 예술가 공모", org: "인천아트플랫폼", sources: ["아트누리"],
    url: "https://www.inartplatform.kr", region: "인천", fields: ["시각", "다원", "사운드"], tags: [],
    summary: "창작 스튜디오 입주 (1년). 국내외 예술가 대상, 거주 요건 없음.",
    residency: { country: "한국", city: "인천", start: "2027-02-01", end: "2027-12-31", support: "스튜디오·숙소 제공, 창작지원금" },
    posterColor: "#3B5BA9",
  },
  {
    id: "r2", kind: "residency", d: 33, p: -4, overseas: true,
    title: "Sound & Media Art Residency at Example Sound Festival — Spring 2027", org: "해외 · Germany", sources: ["해외레지던스"],
    url: "https://resartis.org/open-calls/", region: "Germany", fields: [], tags: ["해외"],
    summary: "A 2-month residency for artists working with sound, electronic music and new media. Studio, accommodation and a production budget provided.",
    residency: { country: "Germany", start: "2027-03-01", end: "2027-04-30", support: "Studio, accommodation, production budget" },
    posterColor: "#1E2A2B",
  },
  {
    id: "r3", kind: "residency", d: 11, p: -6, overseas: true,
    title: "Winter Interdisciplinary Residency 2027", org: "해외 · Finland", sources: ["해외레지던스"],
    url: "https://resartis.org/open-calls/", region: "Finland", fields: [], tags: ["해외"],
    summary: "Open to visual artists, musicians and performance makers. Residency fee applies.",
    residency: { country: "Finland", start: "2027-01-10", end: "2027-03-10", fee: "EUR 600 / month" },
    posterColor: "#5C6A69",
  },
  // 용역·입찰
  {
    id: "v1", kind: "service", d: 6, p: -4,
    title: "2026 시민 문화축제 개막공연 연출 및 음악감독 용역", org: "○○구청 문화체육과", sources: ["나라장터"],
    url: "https://www.g2b.go.kr", region: "서울", fields: ["공연", "음악"], tags: [],
    service: { budget: "추정가격 4,500만원", qualification: "공연기획업 등록 사업자", method: "협상에 의한 계약 (제안서 평가)" },
    posterColor: "#3B5BA9",
    analysis: {
      by: "rule", analyzedAt: "",
      verdicts: [
        { entityId: "me", status: "indirect", reason: "음악감독으로 참여 업체와 협업" },
        { entityId: "tm", status: "prep", gaps: [{ item: "공연기획업 등록", how: "관할 구청 등록", days: 14 }] },
      ],
    },
  },
  {
    id: "v2", kind: "service", d: 15, p: -2,
    title: "미디어아트 전시 사운드 디자인 제작 용역", org: "경기도 문화기관", sources: ["나라장터"],
    url: "https://www.g2b.go.kr", region: "경기", fields: ["사운드", "미디어아트"], tags: [],
    service: { budget: "추정가격 2,800만원", qualification: "소프트웨어사업자 또는 관련 업종", method: "제한경쟁" },
    posterColor: "#2D6E66",
  },
  // 교육
  {
    id: "e1", kind: "edu", d: 4, p: -6,
    title: "예술산업아카데미 — 예술기업 자금전략 로드맵 수강생 모집", org: "예술경영지원센터", sources: ["아트모아"],
    url: "https://www.artmore.kr", region: "서울", fields: ["예술경영"], tags: [],
    edu: { period: "10월 14일 ~ 11월 4일 (매주 화)", fee: "무료", capacity: "30명", mode: "오프라인", certificate: true },
    posterColor: "#8A5E0E",
  },
  {
    id: "e2", kind: "edu", d: 10, p: -1,
    title: "문화예술 기획자 역량강화 — 해외 네트워킹 실무", org: "한국문화예술위원회", sources: ["문화예술 내일"],
    url: "https://hrd.arko.or.kr", region: "전국", fields: ["기획"], tags: ["해외"],
    edu: { period: "11월 3일 ~ 11월 21일", fee: "무료", capacity: "40명", mode: "온라인", certificate: true },
    posterColor: "#3B5BA9",
  },
  {
    id: "e3", kind: "edu", d: 18, p: 0,
    title: "실감콘텐츠 창작자 교육 — 공간음향·몰입형 사운드", org: "한국콘텐츠진흥원", sources: ["웹"],
    url: "https://www.kocca.kr", region: "서울", fields: ["사운드", "융복합"], tags: [],
    edu: { period: "11월 10일 ~ 12월 12일", fee: "5만원", capacity: "20명", mode: "혼합", certificate: true },
    posterColor: "#1E2A2B",
  },
  // 대관
  {
    id: "h1", kind: "venue", d: 8, p: -5,
    title: "2027 상반기 정기대관 공모 (소극장·스튜디오)", org: "세종문화회관", sources: ["웹"],
    url: "https://www.sejongpac.or.kr", region: "서울", fields: ["공연"], tags: [],
    venue: { usePeriod: "2027.01 ~ 2027.06", space: "S씨어터 · 체임버홀", seats: 300, fee: "1회 약 180만원", supportLink: "s3" },
    posterColor: "#7A4B8C",
  },
  {
    id: "h2", kind: "venue", d: 25, p: -2,
    title: "아트센터 블랙박스 스튜디오 수시대관", org: "인천 문화기관", sources: ["웹"],
    url: "https://www.ifac.or.kr", region: "인천", fields: ["공연", "다원"], tags: [],
    venue: { usePeriod: "2026.12 ~ 2027.02", space: "블랙박스 스튜디오", seats: 120, fee: "1일 약 60만원" },
    posterColor: "#5C6A69",
  },
  {
    id: "h3", kind: "venue", d: null, deadlineLabel: "상시",
    title: "창작공간 연습실·녹음실 상시 대관", org: "부산 문화기관", sources: ["IG"],
    url: "https://www.instagram.com", region: "부산", fields: ["음악"], tags: [],
    venue: { space: "연습실 3실 · 녹음실", fee: "시간당 1만원", usePeriod: "연중" },
    posterColor: "#B8321F", needsReview: true,
  },
];

export function sampleNotices(now = new Date()): Notice[] {
  const today = todayISO(now);
  return RAW.map(({ d, p, ...n }) => ({
    ...n,
    deadline: d === null ? null : addDays(today, d),
    postedAt: p === undefined ? undefined : addDays(today, p),
    applyStart: p === undefined ? undefined : `${addDays(today, p)} 09:00`,
    applyEnd: d === null ? undefined : `${addDays(today, d)} 18:00`,
    checkedAt: today,
    analysis: n.analysis ? { ...n.analysis, analyzedAt: today } : undefined,
  }));
}
