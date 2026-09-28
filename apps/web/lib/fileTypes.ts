/** 파일 확장자 → 종류 (아이콘·저장 형식) */
export const EXT_TYPE: Record<string, string> = {
  pdf: "application/pdf", hwp: "application/x-hwp", hwpx: "application/hwp+zip",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", txt: "text/plain",
};
export const extOf = (name: string) => (/\.([a-z0-9]{2,5})$/i.exec(name.trim())?.[1] ?? "").toLowerCase();
export const typeOf = (name: string) => EXT_TYPE[extOf(name)] ?? "application/octet-stream";

/** 저장소 경로: 한글 파일명은 저장소 키로 못 쓰므로 영문·숫자 키 + 확장자 (원래 이름은 목록 표에 보관) */
export function storageKey(uid: string, noticeId: string, name: string) {
  const ext = extOf(name) || "bin";
  const nid = noticeId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "notice";
  return `${uid}/${nid}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${ext}`;
}

export function sizeLabel(n?: number) {
  if (!n) return "";
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`;
}
