import assert from "node:assert/strict";
import { artnuri } from "../src/sources/artnuri";
import { ncas } from "../src/sources/ncas";
import { gokams } from "../src/sources/gokams";
import { hrdArko } from "../src/sources/hrdArko";
import { artmore } from "../src/sources/artmore";
import { artnuriResidence } from "../src/sources/artnuriResidence";
import { parseKgoNotices, kgoPlatforms } from "../src/sources/kgo";
import { parseKoficeList, parseKoficeDetail } from "../src/sources/kofice";
import { botameRowsToItems } from "../src/sources/botame";
import { g2bRowToItem } from "../src/sources/g2b";
import { parseKoccaList, parseKoccaDetail } from "../src/sources/kocca";
import { parseEduKoccaList } from "../src/sources/eduKocca";
import { extraTags } from "@muse/core";
import { matchPlatforms, matchedKeywords, type Notice } from "@muse/core";
import type { CollectContext } from "../src/base";

// 2026-09-24 실제 페이지에서 확인한 구조를 줄인 조각
const F: [RegExp, string][] = [
  [/k-go.*Platform\/search/, JSON.stringify({ status: "success", total: 1, item: [{ aply: 1, city: "덴하그", continent: "유럽", dvsn: "페스티벌", gnr: "<span class=\"genre-item\">#전통음악/월드뮤직/재즈</span>", homepage: "https://www.rewirefestival.nl/", name: "리와이어 페스티벌", name_en: "Rewire Festival / Korzo Hall", nation: "네덜란드", tour: "N" }] })],
  [/residence\/crawler\/list\.do.*pageIndex=1&/, `<ul><li><a href="#none" onclick="goView('4640')"><div class="img-wrap"><img src="/atch/getImg.do?atchFileSn=100000003191&amp;thumb=345x244"></div><div class="txt-wrap"><div class="top"><strong class="txt-over2">Haihatus Artist Residency Open Call – February–April 2027</strong></div><div class="bottom"><span><em class="bottom-tit">Deadline</em>2026-10-31</span><span><em class="bottom-tit">Country</em>Finland</span><div><span class="view">8</span></div></div></div></a></li></ul>`],
  [/residence\/crawler\/view\.do/, `<div class="supt-det"><strong class="ti">Haihatus</strong><ul class="info-txt"><li><strong>Location</strong><em>Finland</em></li><li><strong>Application deadline</strong><em>2026-10-31\n</em></li><li><strong>Residency starts</strong><em>2027-02-01</em></li><li><strong>Residency ends</strong><em>2027-04-30</em></li><li><strong>Original text</strong><em><a href="https://resartis.org/open-call/haihatus/" target="_blank">https://resartis.org/open-call/haihatus/</a></em></li></ul><div class="supt-content"><div><div class="thumb-img"><img src="/x"></div></div><p>Haihatus Artist Residency is part of an independent, artist-run contemporary art centre.</p></div></div>`],
  [/artnuri.*search\.do.*sw=/, `<ul class="card"><li><span class="state-st2 prog">진행중</span><a href="#none" class="title" onclick="goView('A_NOTICE_2', '서울문화재단','001')" >미디어아트 창작 레지던시 모집</a><ul class="txt"><li class="organ"><strong>주관기관</strong><em></em></li><li><strong>지원대상</strong><em>개인</em></li><li><strong>마감일</strong><em>2026-10-10</em></li></ul></li></ul>`],
  [/artnuri.*search\.do.*pageIndex=1/, `<ul class="card"><li><span class="state-st2 prog">진행중</span><a href="#none" class="title" onclick="goView('GCTF_NOTICE_1', '고창문화관광재단','001')" >2026년 원로창작이음지원사업 모집</a><ul class="txt"><li class="organ"><strong>주관기관</strong><em><a class="logo"></a></em></li><li><strong>지원대상</strong><em>개인</em></li><li><strong>마감일</strong><em>2026-09-28</em></li></ul></li>
   <li><span class="state-st2 end">마감</span><a class="title" onclick="goView('X_OLD', '어디','001')">지난 공고</a></li></ul>
   <ul class="list"><li><a class="title" onclick="goView('GCTF_NOTICE_1', '고창문화관광재단','001')">2026년 원로창작이음지원사업 모집</a></li></ul>`],
  [/artnuri.*search\.do/, `<ul></ul>`],
  [/artnuri.*view\.do/, `<div class="sub-content-wrap"><ul class="info-txt"><li><strong>지원대상</strong><ul class="view-list"><li>개인</li></ul></li><li><strong>지역</strong><ul class="view-list"><li>전북</li></ul></li><li><strong>신청기간</strong><em>2026-09-22 ~ 2026-09-28</em></li><li><strong>사업유형</strong><ul class="view-list"><li>창작지원</li></ul></li><li><strong>온라인신청</strong><a href="https://www.gctf.or.kr/web/board/1/4496" class="site-link">신청사이트 바로가기</a></li><li><strong>첨부파일</strong><ul class="file-list"><li><a href="/crawler/Info/fileDown.do?crlAttachId=10034615"> 2027년 IETM 초청 프로그램.pdf</a><button type="button" onclick="openViewer('001','10034615', 'in');" class="preview-btn">미리보기</button></li><li><a href="/crawler/Info/fileDown.do?crlAttachId=10034616">신청서 양식.hwp</a></li></ul></li></ul></div>`],
  [/ncas\.or\.kr\/$/, `<div class="tab__cont js-tcont on" data-tab="tab1_01"><table><tbody><tr data-item="{&quot;instNm&quot;:&quot;예술경영지원센터&quot;, &quot;prgsStatus&quot;:&quot;진행중&quot;}"><td><div class="field">예술경영지원센터</div></td><td><div class="field">2026 예술산업 금융지원 시범사업(융자) 5차 공모</div></td><td><div class="field">2026.09.14 <br> 09:00 </div></td><td><div class="field"> 2026.10.02 <br> 16:00 <br> <span>(D-08)</span></div></td><td><div class="field">단체</div></td><td><div class="field">예술일반</div></td><td><div class="field"><button onclick="window.open('https://www.gokams.or.kr/01_news/notice_view.aspx?Idx=4564');">보기</button></div></td></tr></tbody></table></div>`],
  [/gokams.*notice_list/, `<table><tr class="noticeColor"><td></td><td></td><td class="left"><a href="notice_view.aspx?Idx=4571&amp;page=1">2026 대형 뮤지컬 낭독공연 지원사업 2차 공모 서류심의 결과 안내</a></td><td>2026-09-17</td><td>854</td></tr><tr><td>1</td><td></td><td class="left"><a href="notice_view.aspx?Idx=4563">2026 아트코리아랩 오픈 프롬프트 커뮤니티 9월 참여자 모집(~9.20(일)까지)</a></td><td>2026-09-01</td><td>10</td></tr></table>`],
  [/hrd\.arko/, `<table><tbody><tr><td><a href="javascript:void(0);" onclick="doGoCourseDetail({'courseMasterSeq' : '746', 'courseActiveSeq' : '4618'});">무대예술 커리어 토크</a></td><td> 26.10.29 ~ 26.10.29</td><td> 오프라인 </td><td> 접수중 </td><td></td></tr><tr><td><a onclick="doGoCourseDetail({'courseMasterSeq' : '1', 'courseActiveSeq' : '2'});">마감된 과정</a></td><td>26.10.01 ~ 26.10.01</td><td>온라인</td><td>접수마감</td><td></td></tr></tbody></table>`],
  [/artmore.*expert/, `<ul><li class="aca_card_box"><a href="/moaa_sub/lecture/expert_lect_view.do?lecture_idx=747" class="aca_card_con"><div class="aca_thumbnail"><img src="/upfile/attach/LECT_1.jpg"></div><div class="aca_info"><div class="aca_info_title txt-over2"><span>[기업성장]</span> 예술기업 자금전략 로드맵</div></div><div class="aca_status"><div class="status_off">오프라인</div></div><div class="aca_con_active"><div class="active_name">신청기간 : 2099-09-04 ~ 2099-10-01</div><div class="active_name">교육기간 : 2099-10-06 ~ 2099-10-27</div></div></a></li></ul>`],
  [/artmore/, `<ul></ul>`],
];
const ctx: CollectContext = {
  async fetchText(url) { const f = F.find(([re]) => re.test(url)); if (!f) throw new Error("no fixture " + url); return f[1]; },
  async fetchJson() { return {} as never; },
  env: {}, log: () => {}, keywords: ["미디어아트"],
};

const a = await artnuri.list(ctx);
assert.equal(a.length, 2, "마감 제외, 중복 제거, 키워드 검색 결과 포함");
const ad = await a[0].detail!();
assert.equal(ad.files?.length, 2, "첨부파일");
assert.equal(ad.files?.[0].url, "https://artnuri.or.kr/crawler/Info/fileDown.do?crlAttachId=10034615");
assert.deepEqual(ad.files?.[0].preview, { seNo: "001", fileSn: "10034615" });
assert.equal(ad.files?.[1].name, "신청서 양식.hwp");
assert.equal(a[0].title, "2026년 원로창작이음지원사업 모집");
assert.equal(a[0].org, "고창문화관광재단");
assert.equal(a[0].deadline, "2026-09-28");
assert.deepEqual(a[1].keywords, ["미디어아트"]);
const d = await a[0].detail!();
assert.equal(d.applyStart, "2026-09-22");
assert.equal(d.applyEnd, "2026-09-28");
assert.equal(d.region, "전북");
assert.equal(d.applyUrl, "https://www.gctf.or.kr/web/board/1/4496");

const n = await ncas.list(ctx);
assert.equal(n.length, 1);
assert.equal(n[0].applyStart, "2026-09-14 09:00");
assert.equal(n[0].applyEnd, "2026-10-02 16:00");
assert.equal(n[0].deadline, "2026-10-02");
assert.equal(n[0].url, "https://www.gokams.or.kr/01_news/notice_view.aspx?Idx=4564");

const g = await gokams.list(ctx);
assert.equal(g.length, 1, "결과 안내는 제외");
assert.equal(g[0].deadline, "2026-09-20");
assert.equal(g[0].postedAt, "2026-09-01");

const h = await hrdArko.list(ctx);
assert.equal(h.length, 1, "접수중만");
assert.match(h[0].url, /courseActiveSeq=4618/);

const m = await artmore.list(ctx);
assert.equal(m.length, 1);
assert.equal(m[0].applyEnd, "2099-10-01");
assert.equal(m[0].thumb, "https://www.artmore.kr/upfile/attach/LECT_1.jpg");
assert.match(m[0].title, /자금전략/);
const r = await artnuriResidence.list(ctx);
assert.equal(r.length, 1);
assert.equal(r[0].deadline, "2026-10-31");
assert.equal(r[0].kind, "residency");
assert.equal(r[0].org, "해외 · Finland");
assert.match(r[0].thumb ?? "", /atchFileSn=100000003191&thumb=345x244$/);
const rd = await r[0].detail!();
assert.equal(rd.applyUrl, "https://resartis.org/open-call/haihatus/");
assert.equal(rd.details?.residency?.start, "2027-02-01");
assert.equal(rd.details?.residency?.country, "Finland");
assert.match(rd.summary ?? "", /artist-run/);
const kn = parseKgoNotices(`<div class="board_bd"><a href="/notice/aFc9LHfL"><p class="col1">25</p><p class="col2">공모</p><p class="col3">&lt;K-arts on the GO&gt; 플랫폼 디렉토리 신규제안 접수 마감 안내(~26년 8월)</p><span>2026.08.24.</span></a><a href="/notice/RpbrHWd6"><p class="col1">23</p><p class="col2">공모</p><p class="col3">&lt;K-arts on the GO&gt;  2026년 제3차 공모 </p><span>2026.07.06.</span></a><a href="/notice/SBq81zbv"><p class="col2">공모</p><p class="col3">2026년 제3차 공모 지원 선정 결과 발표</p><span>2026.08.04.</span></a><a href="/notice/old"><p class="col2">공모</p><p class="col3">2026년 제1차 공모</p><span>2026.01.04.</span></a></div>`, "2026-06-01");
assert.equal(kn.length, 1, "공모만, 결과·안내·오래된 글 제외");
assert.equal(kn[0].title, "<K-arts on the GO> 2026년 제3차 공모");
const kp = await kgoPlatforms(ctx);
assert.equal(kp.length, 2, "공연·시각 두 분류");
assert.equal(kp[0].nameEn, "Rewire Festival / Korzo Hall");
const fake = (t: string, url = "https://x.org"): Notice => ({ id: "x", kind: "residency", title: t, org: "해외 · Netherlands", sources: [], url, fields: [], tags: [], deadline: null, checkedAt: "" });
assert.equal(matchPlatforms(fake("Artist residency at Rewire Festival / Korzo Hall 2027"), kp).length, 1);
assert.equal(matchPlatforms(fake("Open call", "https://rewirefestival.nl/open-call"), kp).length, 1, "홈페이지 주소로도");
assert.equal(matchPlatforms(fake("Some other festival"), kp).length, 0);
assert.deepEqual(matchedKeywords(fake("Multimedia performance residency"), ["media", "performance", "공연"]), ["performance", "공연"]);
assert.deepEqual(matchedKeywords({ ...fake("사운드 미디어 공연 창작 지원"), kind: "grant" }, ["sound", "media", "performance"]), ["sound", "media", "performance"]);
// KOFICE: 진행 중만, 제목의 (10.3) → 마감일, 첨부파일
const ko = parseKoficeList(`<table><tbody><tr class="notice"><td data-th="제목" class="title"><a href="#" onclick="return goView(54945, '')">&lt;2026 국제문화교류 컨설팅(경상권)&gt; 참가자 모집 (10.3)</a></td><td data-th="상태"><span class="state ongoing">진행</span></td><td data-th="게시일">2026-09-23</td></tr><tr><td data-th="제목" class="title"><a onclick="return goView(54589, '')">지난 공모</a></td><td data-th="상태"><span>종료</span></td><td data-th="게시일">2026-08-12</td></tr></tbody></table>`, { mnucd: "169", bbs: "7", kind: undefined, label: "사업공모" });
assert.equal(ko.length, 1);
assert.equal(ko[0].deadline, "2026-10-03");
assert.equal(parseKoficeDetail(`<div class="board-view-file"><a href="/file/download.do?atchFileSn=1&amp;atchSn=2&amp;childYn=Y"> 공고문.hwpx [ 67.93 KB ] </a></div>`).files?.[0].name, "공고문.hwpx");
// 보탬e: 문화예술 관련 + 마감 전만
const bt = botameRowsToItems([
  { pbacNo: "1", pbacNm: "동행 콘서트 행사 지원", allLafNm: "충청남도 서천군", fyr: "2026", pbcnAplyRcptEndYmd: "2026-10-12" },
  { pbacNo: "2", pbacNm: "민간개방화장실 리모델링", allLafNm: "대전광역시", fyr: "2026", pbcnAplyRcptEndYmd: "2026-10-12" },
  { pbacNo: "3", pbacNm: "지역특성화 축제 지원", allLafNm: "서울특별시 금천구", fyr: "2026", pbcnAplyRcptEndYmd: "2026-09-01" },
], [], "2026-09-29");
assert.deepEqual(bt.map((x) => x.title), ["동행 콘서트 행사 지원"]);
// 나라장터 응답 → 용역 카드
const gb = g2bRowToItem({ bidNtceNm: "시민축제 공연 운영 용역", dminsttNm: "○○구", bidClseDt: "2026-10-05 10:00:00", presmptPrce: "45000000", bidNtceDtlUrl: "https://www.g2b.go.kr/x" }, "공연");
assert.equal(gb?.deadline, "2026-10-05");
assert.equal(gb?.details?.service?.budget, "추정가격 4,500만원");
// 콘진원 지원공고
const kc = parseKoccaList(`<table><tbody><tr><td data-label="구분"><span>자유공모</span></td><td data-label="제목" class="AlignLeft"><a href="/kocca/pims/view.do?intcNo=326D00092012&amp;menuNo=204104&amp;pageIndex=1">2026년 대중음악 공연환경 개선 지원사업 추가 공고</a></td><td data-label="공고일"> 26.09.15 </td><td data-label="접수기간"> 26.09.15 ~ 26.10.02 </td><td data-label="조회">1</td></tr></tbody></table>`);
assert.equal(kc.length, 1);
assert.equal(kc[0].deadline, "2026-10-02");
assert.equal(kc[0].url, "https://www.kocca.kr/kocca/pims/view.do?intcNo=326D00092012&menuNo=204104");
assert.match(parseKoccaDetail(`<div class="board_view01"><div class="board_cont"> 행사 개요 · 행사명 </div></div>`).summary ?? "", /행사 개요/);
// 창업 태그
assert.ok(extraTags("2026 예비창업패키지 모집").includes("창업"));
assert.ok(extraTags("아무 제목", "K-Startup").includes("창업"));
assert.ok(!extraTags("2026 다원예술 창작지원").includes("창업"));
// 에듀코카 교육모집: 진행 카드만
const ek = parseEduKoccaList(`<div class="swiper-wrapper"><div><a href="/edu/bbs/B0000048/view.do?nttId=76089&amp;delCode=0&amp;menuNo=500203&amp;pageIndex=1&amp;opt=2" class="col-12 show fn event_card"><div class="img_box"><img alt="" src="/cmm/fms/getImage.do?atchFileId=FILE_1&amp;fileSn=1"></div><div class="text_box"><h3>KOCCA×NETFLIX 2026 프로덕션 아카데미 교육생 모집</h3><p class="date_tag_on">진행</p><p class="event_date"> 기간 : <span class="show">2026-09-21</span> ~ <span class="show">2026-10-05</span></p></div></a></div><div><a href="/edu/bbs/B0000048/view.do?nttId=70000" class="event_card"><h3>지난 교육</h3><p class="date_tag_off">종료</p><p class="event_date"><span>2026-01-01</span> ~ <span>2026-01-10</span></p></a></div></div>`);
assert.equal(ek.length, 1);
assert.equal(ek[0].deadline, "2026-10-05");
assert.equal(ek[0].kind, "edu");
assert.equal(ek[0].thumb, "https://edu.kocca.kr/cmm/fms/getImage.do?atchFileId=FILE_1&fileSn=1");
console.log("✓ 사이트별 수집기 테스트 통과 (아트누리·NCAS·예술경영지원센터·문화예술 내일·아트모아·해외레지던스·K-GO·KOFICE·콘진원·에듀코카·보탬e·나라장터)");
