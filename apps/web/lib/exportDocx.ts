import type { Draft } from "@muse/core";

/** 초안을 Word(.docx)로 — [확인 필요] 부분은 노란 형광펜 */
export async function exportDocx(d: Draft, entityName: string) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
  const runs = (line: string) => line.split(/(\[확인\s*필요[^\]]*\])/g).filter(Boolean).map((t) =>
    /^\[확인/.test(t) ? new TextRun({ text: t, highlight: "yellow", font: "Malgun Gothic" }) : new TextRun({ text: t, font: "Malgun Gothic" }));
  const body: InstanceType<typeof Paragraph>[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: d.noticeTitle, font: "Malgun Gothic" })] }),
    new Paragraph({ children: [new TextRun({ text: `신청: ${entityName}  ·  작성: ${new Date().toLocaleDateString("ko-KR")}`, color: "666666", font: "Malgun Gothic", size: 20 })] }),
  ];
  d.sections.forEach((s, i) => {
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 320, after: 120 }, children: [new TextRun({ text: `${i + 1}. ${s.title}`, font: "Malgun Gothic" })] }));
    for (const line of (s.content || "").split("\n")) {
      const m = /^\s*[-•·*]\s+(.*)$/.exec(line);
      body.push(m ? new Paragraph({ bullet: { level: 0 }, children: runs(m[1]) }) : new Paragraph({ spacing: { after: 80 }, children: runs(line) }));
    }
  });
  const doc = new Document({ styles: { default: { document: { run: { font: "Malgun Gothic", size: 21 } } } }, sections: [{ children: body }] });
  const blob = await Packer.toBlob(doc);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${d.noticeTitle.replace(/[\\/:*?"<>|]/g, "").slice(0, 60)}_초안.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export function draftText(d: Draft) {
  return d.sections.map((s, i) => `${i + 1}. ${s.title}\n${s.content.trim()}`).join("\n\n");
}
