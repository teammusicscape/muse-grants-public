import assert from "node:assert/strict";
import { parseBoard } from "../src/board";
import { deadlineFromPeriod, normDate } from "../src/util";
import { classifyKind } from "@muse/core";

const html = `
<table><tbody>
<tr><td>1</td><td class="org">서울문화재단</td><td><a href="/crawler/info/view.do?docid=CRL1">2026 다원예술 창작지원 (하반기) NEW</a></td><td>2026-09-01 ~ 2026-09-30</td></tr>
<tr><td>2</td><td class="org">예술경영지원센터</td><td><a href="view.do?docid=CRL2" title="예술산업아카데미 수강생 모집">예술산업아카데미…</a></td><td>2026.09.10 ~ 2026.10.01</td></tr>
<tr><td>3</td><td class="org">-</td><td><a href="/other/page">다른 링크</a></td><td>2026.09.10</td></tr>
</tbody></table>`;

const r = parseBoard(html, "https://artnuri.or.kr/crawler/info/search.do", { link: /view\.do/, org: ".org" });
assert.equal(r.length, 2, "공고 링크 2개");
assert.equal(r[0].title, "2026 다원예술 창작지원 (하반기)");
assert.equal(r[0].deadline, "2026-09-30");
assert.equal(r[0].url, "https://artnuri.or.kr/crawler/info/view.do?docid=CRL1");
assert.equal(r[0].org, "서울문화재단");
assert.equal(r[1].title, "예술산업아카데미 수강생 모집", "title 속성 우선");
assert.equal(r[1].deadline, "2026-10-01");

assert.equal(normDate("26.9.3"), "2026-09-03");
assert.equal(normDate("2026년 10월 2일"), "2026-10-02");
assert.equal(deadlineFromPeriod("2026.09.01(월) ~ 2026.09.30(화) 18:00"), "2026-09-30");

assert.equal(classifyKind("예술산업아카데미 수강생 모집"), "edu");
assert.equal(classifyKind("2027 상반기 정기대관 공모"), "venue");
assert.equal(classifyKind("공연예술 대관료 지원"), "grant");
assert.equal(classifyKind("축제 음악감독 용역"), "service");
assert.equal(classifyKind("아무 공고", "나라장터"), "service");
assert.equal(classifyKind("2026 다원예술 창작지원"), "grant");
console.log("✓ 수집기 파서 테스트 통과");
