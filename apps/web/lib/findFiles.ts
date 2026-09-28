/** 공고 원문 HTML에서 첨부파일 링크 찾기 (서버 API와 테스트에서 함께 씀) */
const EXT = /\.(hwpx?|pdf|docx?|xlsx?|pptx?|zip|txt|jpe?g|png)(?=$|[?#&"'\s)\]])/i;
const DOWN = /(file_?down|filedown|download|attach|atch_?file|getfile|fileview|file\.do|down\.do)/i;
export const FOLLOW_TEXT = /(신청\s*사이트|원문|공고\s*원문|홈페이지)\s*(바로\s*가기|보기|이동)/;

export interface FoundFile { name: string; url: string; preview?: { seNo: string; fileSn: string } }

function decodeEntities(s: string) {
  return s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}
const clean = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const attr = (attrs: string, name: string) => decodeEntities((new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(attrs)?.slice(2, 4).find((x) => x !== undefined)) ?? "");

function nameFromUrl(u: URL) {
  for (const [, v] of u.searchParams) if (EXT.test(v)) return v.split(/[\\/]/).pop()!;
  let last = u.pathname.split("/").pop() ?? "";
  try { last = decodeURIComponent(last); } catch { /* 그대로 */ }
  return EXT.test(last) ? last : "";
}

export function extractFiles(html: string, base: URL): { files: FoundFile[]; hidden: number; follow: URL[] } {
  const files: FoundFile[] = [];
  const follow: URL[] = [];
  let hidden = 0;
  const seen = new Set<string>();
  // 사이트 공통 아래쪽(인증마크·약관 PDF 등)은 빼고 찾기
  const foot = html.search(/<footer\b|id=["'](footer|foot)["']|class=["'][^"']*\bfooter\b/i);
  if (foot > 2000) html = html.slice(0, foot);
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    const text = clean(m[2]);
    const title = attr(attrs, "title");
    const href = attr(attrs, "href").trim();
    const onclick = attr(attrs, "onclick");
    const isJs = !href || href.startsWith("#") || /^javascript:/i.test(href);
    if (isJs) {
      if ((DOWN.test(href + onclick) || EXT.test(text)) && (EXT.test(text) || /다운|첨부/.test(text))) hidden++;
      continue;
    }
    let u: URL;
    try { u = new URL(href, base); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    const fromUrl = nameFromUrl(u);
    const looksFile = EXT.test(text) || EXT.test(title) || !!fromUrl || (DOWN.test(u.pathname + u.search) && text.length > 0 && text.length < 200);
    if (!looksFile) {
      if (/site-link/.test(attr(attrs, "class")) || (FOLLOW_TEXT.test(text) && text.length < 30)) follow.push(u);
      continue;
    }
    // 이름: 확장자가 붙은 글자 > title > 주소의 파일명 > 글자
    let name = [text, title].find((x) => EXT.test(x)) || fromUrl || text || title;
    name = name.replace(/\s*[([]?\s*\d+(\.\d+)?\s*(KB|MB|kb|mb|bytes?)\s*[)\]]?\s*$/, "").replace(/^(첨부파일|파일|다운로드)\s*[:：]?\s*/, "").trim();
    if (!name || /^(다운로드|download|내려받기|미리보기|보기)$/i.test(name)) name = fromUrl || name;
    if (!name || (!text && !EXT.test(title))) continue; // 글자 없는 배지(인증마크 등)
    if (seen.has(u.href)) continue;
    seen.add(u.href);
    // 아트누리 문서 뷰어 미리보기
    const after = html.slice(re.lastIndex, re.lastIndex + 600);
    const v = /openViewer\('([^']*)',\s*'([^']*)'/.exec(after);
    files.push({ name, url: u.href, preview: v && u.hostname.endsWith("artnuri.or.kr") ? { seNo: v[1], fileSn: v[2] } : undefined });
  }
  return { files, hidden, follow };
}


/** 문서 파일만 (이미지 제외) — JSON·스크립트 안에서 찾을 때 */
const DOC_EXT = /\.(hwpx?|pdf|docx?|xlsx?|pptx?|zip)(?=$|[?#&"'\s)\]])/i;

/** 파일 주소에서 보여줄 이름 (앞에 붙은 uuid_·숫자_ 떼기) */
const stripId = (s: string) => s.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i, "").trim();
function prettyName(u: URL) {
  let last = u.pathname.split("/").pop() ?? "";
  try { last = decodeURIComponent(last); } catch { /* 그대로 */ }
  return last.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i, "").trim();
}

/**
 * 화면을 스크립트로 그리는 사이트: 첨부파일 정보가 따로 있는 데이터 주소
 * (페이지 HTML에는 파일 링크가 없음)
 */
export function dataUrlsFor(u: URL): URL[] {
  const h = u.hostname.replace(/^www\./, "");
  let m: RegExpExecArray | null;
  if (h === "uctf.or.kr" && (m = /\/board\/[\w-]+\/view\/(\d+)/.exec(u.pathname))) return [new URL(`/api/notices/${m[1]}`, u.origin)];
  if (h === "jfac.kr" && (m = /\/notification\/[\w-]+\/(\d+)/.exec(u.pathname))) return [new URL(`/api/archive/${m[1]}`, u.origin)];
  return [];
}

/** JSON 안에서 문서 파일 주소 찾기 (옆에 fileName·name 같은 이름이 있으면 그걸 씀) */
export function extractFilesFromJson(data: unknown, base: URL): FoundFile[] {
  const out: FoundFile[] = [];
  const add = (raw: string, name?: string) => {
    for (const part of [raw]) {
      if (!DOC_EXT.test(part)) continue;
      let u: URL;
      try { u = new URL(part, base); } catch { continue; }
      if (!/^https?:$/.test(u.protocol) || out.some((f) => f.url === u.href)) continue;
      out.push({ name: stripId((name && DOC_EXT.test(name) ? name : "") || nameFromUrl(u) || prettyName(u)), url: u.href });
    }
  };
  const walk = (v: unknown, depth: number) => {
    if (depth > 6 || v == null) return;
    if (Array.isArray(v)) { v.forEach((x) => walk(x, depth + 1)); return; }
    if (typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    // 파일 이름 칸 (우선순위: fileName류 > name > title)
    const keys = Object.keys(o).filter((k) => typeof o[k] === "string");
    const nameKey = keys.find((k) => /^(file_?name|original_?(file_?)?name|orgn?_?file_?nm|real_?name)$/i.test(k)) ?? keys.find((k) => /^name$/i.test(k)) ?? keys.find((k) => /^title$/i.test(k));
    const nameStr = nameKey ? String(o[nameKey]) : "";
    for (const [k, x] of Object.entries(o)) {
      if (typeof x === "string" && /(path|url|href|link|src|file)/i.test(k) && !/content|html|body|name|title/i.test(k)) {
        // 여러 파일이 한 칸에 "||" 또는 "&"로 이어진 사이트가 있음
        const parts = x.split(/\s*\|\|\s*|&(?=https?:\/\/)/);
        let names = nameStr.split(/\s*\|\|\s*/);
        if (names.length !== parts.length && parts.length > 1) names = nameStr.split(/&(?=[^&]*\.[a-z0-9]{2,5}(?:&|$))/i);
        parts.forEach((p, i) => add(p, names.length === parts.length ? names[i] : parts.length === 1 ? nameStr : undefined));
      } else if (typeof x === "object") walk(x, depth + 1);
    }
  };
  walk(data, 0);
  return out;
}

/** HTML 속 스크립트·데이터에 적힌 문서 파일 주소 (링크 태그가 없을 때 마지막 수단) */
export function extractFileUrlsInText(html: string, base: URL): FoundFile[] {
  const out: FoundFile[] = [];
  const re = /https?:\/\/[^\s"'<>()\\]+?\.(?:hwpx?|pdf|docx?|xlsx?|pptx?|zip)(?:\?[^\s"'<>\\]*)?(?=["'\s<>\\]|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let u: URL;
    try { u = new URL(m[0].replace(/&amp;/g, "&"), base); } catch { continue; }
    if (out.some((f) => f.url === u.href)) continue;
    out.push({ name: nameFromUrl(u) || prettyName(u), url: u.href });
  }
  return out;
}
