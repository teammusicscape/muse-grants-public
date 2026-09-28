import type { Notice } from "@muse/core";

const rPeriod = (n: Notice) => (n.residency?.start ? `${n.residency.start.replace(/-/g, ".")} ~ ${n.residency.end?.replace(/-/g, ".") ?? ""}` : undefined);
const rPlace = (n: Notice) => [n.residency?.country, n.residency?.city].filter(Boolean).join(" · ") || undefined;

/** 탭별로 카드에 먼저 보여줄 핵심 정보 */
export function keyFacts(n: Notice): string[] {
  switch (n.kind) {
    case "grant":
      return [n.grant?.amount, n.grant?.eligibility].filter(Boolean) as string[];
    case "service":
      return [n.service?.budget, n.service?.qualification].filter(Boolean) as string[];
    case "edu":
      return [n.edu?.fee, n.edu?.mode, n.edu?.period].filter(Boolean) as string[];
    case "venue":
      return [n.venue?.space && (n.venue.seats ? `${n.venue.space} · ${n.venue.seats}석` : n.venue.space), n.venue?.usePeriod, n.venue?.fee].filter(Boolean) as string[];
    case "residency":
      return [rPlace(n), rPeriod(n) && `입주 ${rPeriod(n)}`, n.residency?.support ?? n.grant?.amount, n.residency?.fee && `참가비 ${n.residency.fee}`].filter(Boolean) as string[];
  }
}

export function detailRows(n: Notice): [string, string | undefined][] {
  switch (n.kind) {
    case "grant":
      return [["지원금", n.grant?.amount], ["지원 자격", n.grant?.eligibility], ["사업 기간", n.grant?.period]];
    case "service":
      return [["예정 금액", n.service?.budget], ["참가 자격", n.service?.qualification], ["계약 방법", n.service?.method], ["발주 기관", n.org]];
    case "edu":
      return [["교육 기간", n.edu?.period], ["수강료", n.edu?.fee], ["모집 인원", n.edu?.capacity], ["방식", n.edu?.mode], ["수료증", n.edu?.certificate === undefined ? undefined : n.edu.certificate ? "발급" : "없음"]];
    case "venue":
      return [["공간", n.venue?.space], ["규모", n.venue?.seats ? `${n.venue.seats}석` : undefined], ["대관 가능 기간", n.venue?.usePeriod], ["대관료", n.venue?.fee]];
    case "residency":
      return [["장소", rPlace(n)], ["입주 기간", rPeriod(n)], ["지원 내용", n.residency?.support ?? n.grant?.amount], ["참가비", n.residency?.fee], ["지원 자격", n.grant?.eligibility]];
  }
}
