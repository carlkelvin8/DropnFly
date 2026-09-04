interface PdfReport {
  title: string;
  summary: string;
  sections: { heading: string; content: string }[];
  generatedAt: string;
}

function pdfText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrap(value: string, width = 88) {
  const words = pdfText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > width && line) {
      lines.push(line);
      line = word;
    } else line = `${line} ${word}`.trim();
  }
  if (line) lines.push(line);
  return lines;
}

export function createReportPdf(report: PdfReport): Uint8Array {
  const rows: { text: string; size: number; gap: number }[] = [
    { text: report.title, size: 18, gap: 26 },
    { text: `Generated ${new Date(report.generatedAt).toLocaleString("en-PH")}`, size: 9, gap: 20 },
    ...wrap(report.summary).map((text) => ({ text, size: 11, gap: 15 })),
  ];
  for (const section of report.sections) {
    rows.push({ text: section.heading, size: 13, gap: 22 });
    rows.push(...wrap(section.content).map((text) => ({ text, size: 10, gap: 14 })));
  }

  const pages: typeof rows[] = [];
  let page: typeof rows = [];
  let height = 0;
  for (const row of rows) {
    if (height + row.gap > 700 && page.length) {
      pages.push(page);
      page = [];
      height = 0;
    }
    page.push(row);
    height += row.gap;
  }
  if (page.length) pages.push(page);

  const objects: string[] = [];
  const add = (value: string) => { objects.push(value); return objects.length; };
  const catalogId = add("");
  const pagesId = add("");
  const fontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds: number[] = [];
  for (const rowsForPage of pages) {
    let y = 760;
    const commands = rowsForPage.map((row) => {
      const command = `BT /F1 ${row.size} Tf 54 ${y} Td (${pdfText(row.text)}) Tj ET`;
      y -= row.gap;
      return command;
    }).join("\n");
    const contentId = add(`<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`));
  }
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(output.length);
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = output.length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(output);
}
