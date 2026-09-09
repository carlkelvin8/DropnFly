interface PdfReport {
  title: string;
  summary: string;
  sections: { heading: string; content: string }[];
  generatedAt: string;
  reportType?: string;
  dateRange?: string;
  kpis?: { label: string; value: string }[];
  tables?: { title: string; headers: string[]; rows: string[][] }[];
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
  const generatedStr = new Date(report.generatedAt).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const dateRangeStr = report.dateRange || "Selected period";
  const reportTypeStr = report.reportType
    ? report.reportType.charAt(0).toUpperCase() + report.reportType.slice(1)
    : "Analytics";
  const reportId = `${report.generatedAt.slice(0, 10)}-${reportTypeStr.toLowerCase()}`;

  type Row =
    | { kind: "headerBar"; text: string }
    | { kind: "coverAccent" }
    | { kind: "title"; text: string }
    | { kind: "subtitle"; text: string }
    | { kind: "meta"; text: string }
    | { kind: "kpiRow"; left: string; right: string }
    | { kind: "sectionHeading"; text: string }
    | { kind: "body"; text: string }
    | { kind: "tableTitle"; text: string }
    | { kind: "tableHeader"; cols: string[] }
    | { kind: "tableRow"; cols: string[]; alt: boolean }
    | { kind: "tocItem"; text: string }
    | { kind: "footerNote"; text: string }
    | { kind: "spacer"; h: number }
    | { kind: "line"; y: number };

  const rows: Row[] = [];

  // Cover
  rows.push({ kind: "headerBar", text: "DropnFly Logistics Inc.  •  Luggage Storage & Delivery  •  Villamor, Pasay City — Metro Manila, Philippines" });
  rows.push({ kind: "spacer", h: 6 });
  rows.push({ kind: "coverAccent" });
  rows.push({ kind: "title", text: report.title });
  rows.push({ kind: "subtitle", text: `${reportTypeStr} Report  •  ${dateRangeStr}` });
  rows.push({ kind: "meta", text: `Generated: ${generatedStr}  •  Report ID: ${reportId}  •  Source: Live DropnFly DB (bookings/payments/luggage/customers)` });
  rows.push({ kind: "spacer", h: 10 });

  // Executive summary - detailed box
  rows.push({ kind: "sectionHeading", text: "Executive Summary — Decision Ready" });
  for (const line of wrap(report.summary, 88)) rows.push({ kind: "body", text: line });
  rows.push({ kind: "spacer", h: 4 });
  rows.push({ kind: "footerNote", text: "How to use: Cross-check figures below with Financial Oversight & Graphical Data tabs, reconcile pending collections, and validate capacity vs. staffing for the selected period before committing resources." });
  rows.push({ kind: "spacer", h: 8 });

  // KPIs — clean 2-col grid, each pair on one row (max level)
  if (report.kpis && report.kpis.length) {
    rows.push({ kind: "sectionHeading", text: "Key Performance Indicators — Period Snapshot" });
    const kpis = report.kpis.slice(0, 8);
    for (let i = 0; i < kpis.length; i += 2) {
      const left = kpis[i];
      const right = kpis[i + 1];
      const leftStr = left ? `${left.label}: ${left.value}` : "";
      const rightStr = right ? `${right.label}: ${right.value}` : "";
      rows.push({ kind: "kpiRow", left: leftStr, right: rightStr });
      rows.push({ kind: "spacer", h: 4 });
    }
    rows.push({ kind: "spacer", h: 4 });
  }

  // TOC
  if (report.sections.length) {
    rows.push({ kind: "sectionHeading", text: "Contents" });
    for (let i = 0; i < report.sections.length; i++) {
      rows.push({ kind: "tocItem", text: `${i + 1}. ${report.sections[i].heading}` });
    }
    rows.push({ kind: "spacer", h: 6 });
  }

  // Data tables if provided (detailed — not plain text)
  if (report.tables && report.tables.length) {
    for (const tbl of report.tables.slice(0, 4)) {
      rows.push({ kind: "tableTitle", text: tbl.title });
      rows.push({ kind: "tableHeader", cols: tbl.headers });
      for (let r = 0; r < tbl.rows.length; r++) {
        rows.push({ kind: "tableRow", cols: tbl.rows[r], alt: r % 2 === 1 });
      }
      rows.push({ kind: "spacer", h: 6 });
    }
  }

  // Sections — clean paragraphs (split only on blank lines, preserve sentences)
  for (const section of report.sections) {
    rows.push({ kind: "sectionHeading", text: section.heading });
    const paragraphs = section.content.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    // If no blank-line paragraphs, treat whole content as one block and wrap cleanly
    const blocks = paragraphs.length ? paragraphs : [section.content.trim()];
    for (const para of blocks) {
      if (!para) continue;
      // Remove any residual markdown bullets/numbers for clean PDF
      const cleanPara = para.replace(/^\s*[-•]\s*/gm, "").replace(/^\s*\d+\.\s*/gm, "").trim();
      for (const line of wrap(cleanPara, 86)) rows.push({ kind: "body", text: line });
      rows.push({ kind: "spacer", h: 5 });
    }
  }

  rows.push({ kind: "spacer", h: 8 });
  rows.push({ kind: "sectionHeading", text: "Methodology & Limitations" });
  for (const line of wrap("Figures are derived from live bookings, payments (PAID requires paidAt), luggage details, and customer records for the selected period using Manila time. Outstanding = booked value − confirmed paid (paidAt verified). Gross booked value, paid revenue, and pending are distinct. Small samples and missing cost data limit certainty—treat forecasts as decision-support, not guarantees.", 86)) rows.push({ kind: "body", text: line });
  rows.push({ kind: "spacer", h: 6 });
  rows.push({ kind: "footerNote", text: "Verify figures in Financial Oversight before acting. Not financial advice. Confidential — For admin use only — DropnFly Logistics Inc." });
  rows.push({ kind: "footerNote", text: `Report ID ${reportId} • Generated ${generatedStr} • ${dateRangeStr}` });

  // Pagination
  const pageHeight = 680;
  const rowHeights: Record<string, number> = {
    headerBar: 14,
    coverAccent: 6,
    title: 24,
    subtitle: 14,
    meta: 10,
    sectionHeading: 22,
    body: 11,
    kpiRow: 26,
    tableTitle: 14,
    tableHeader: 16,
    tableRow: 14,
    tocItem: 11,
    footerNote: 9,
    spacer: 0,
    line: 1,
  };
  const pages: Row[][] = [];
  let cur: Row[] = [];
  let h = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] as Row & { h?: number };
    const rh = r.kind === "spacer" ? (r as { h: number }).h : (rowHeights[r.kind] ?? 12);
    if (h + rh > pageHeight && cur.length) {
      if (r.kind === "sectionHeading" && h > pageHeight - 60) {
        pages.push(cur); cur = []; h = 0;
      } else if (h + rh > pageHeight) {
        pages.push(cur); cur = []; h = 0;
      }
    }
    cur.push(r);
    h += rh;
  }
  if (cur.length) pages.push(cur);

  // Build PDF objects
  const objects: string[] = [];
  const add = (v: string) => { objects.push(v); return objects.length; };
  const catalogId = add("");
  const pagesId = add("");
  const fontRegular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const pageIds: number[] = [];

  pages.forEach((pageRows, pageIndex) => {
    const pageNum = pageIndex + 1;
    const totalPages = pages.length;
    let y = 750;
    const cmds: string[] = [];

    // Top orange header bar each page
    const headerY = 770;
    cmds.push(`q 0.94 0.33 0.08 rg 0 ${headerY - 14} 612 20 re f Q`);
    cmds.push(`BT /F2 8 Tf 1 1 1 rg 20 ${headerY - 9} Td (${pdfText(`DropnFly  •  ${reportTypeStr} Analytics  •  Admin Report`)}) Tj ET`);
    cmds.push(`BT /F1 7 Tf 1 1 1 rg 470 ${headerY - 9} Td (${pdfText(`Page ${pageNum} of ${totalPages}  •  ${reportTypeStr}`)}) Tj ET`);
    cmds.push(`0 0 0 rg`);

    for (const row of pageRows) {
      if (row.kind === "spacer") { y -= (row as { h: number }).h; continue; }
      if (row.kind === "coverAccent") {
        cmds.push(`q 0.15 0.23 0.84 rg 20 ${y} 572 3 re f Q 0 0 0 rg`);
        y -= 8;
        continue;
      }
      let size = 9;
      let x = 28;
      let isBold = false;
      let color = "0.12 0.12 0.12";
      let text = "";
      if ("text" in row) text = pdfText((row as { text: string }).text);
      switch (row.kind) {
        case "headerBar":
          size = 6; x = 20; y -= 6; color = "0.45 0.45 0.45";
          cmds.push(`BT /F1 ${size} Tf ${color} rg ${x} ${y} Td (${text}) Tj ET`);
          y -= 8;
          continue;
        case "title":
          size = 18; isBold = true; color = "0.15 0.23 0.84"; x = 20;
          break;
        case "subtitle":
          size = 9; color = "0.35 0.35 0.35"; x = 20;
          break;
        case "meta":
          size = 6.5; color = "0.5 0.5 0.5"; x = 20;
          break;
        case "sectionHeading":
          size = 11; isBold = true; color = "0.94 0.33 0.08"; x = 20;
          y -= 3;
          cmds.push(`q ${color} rg 20 ${y - 8} 572 0.9 re f Q 0 0 0 rg`);
          break;
        case "body":
          size = 8.5; color = "0.18 0.18 0.18"; x = 28;
          break;
        case "kpiRow": {
          const kpi = row as { left: string; right: string };
          const boxW = 270;
          const boxH = 22;
          const leftX = 20;
          const rightX = 306;
          // Left box
          if (kpi.left) {
            cmds.push(`q 0.96 0.96 1 rg ${leftX} ${y - boxH + 4} ${boxW} ${boxH} re f Q`);
            cmds.push(`q 0.8 0.82 0.96 rg ${leftX} ${y - boxH + 4} ${boxW} ${boxH} re S Q`);
            const parts = kpi.left.split(": ");
            const label = parts[0] || "";
            const val = parts.slice(1).join(": ") || "";
            cmds.push(`BT /F1 6 Tf 0.45 0.45 0.6 rg ${leftX + 8} ${y - 4} Td (${pdfText(label)}) Tj ET`);
            cmds.push(`BT /F2 9 Tf 0.12 0.18 0.6 rg ${leftX + 8} ${y - 14} Td (${pdfText(val || label)}) Tj ET`);
          }
          // Right box
          if (kpi.right) {
            cmds.push(`q 0.96 0.96 1 rg ${rightX} ${y - boxH + 4} ${boxW} ${boxH} re f Q`);
            cmds.push(`q 0.8 0.82 0.96 rg ${rightX} ${y - boxH + 4} ${boxW} ${boxH} re S Q`);
            const parts = kpi.right.split(": ");
            const label = parts[0] || "";
            const val = parts.slice(1).join(": ") || "";
            cmds.push(`BT /F1 6 Tf 0.45 0.45 0.6 rg ${rightX + 8} ${y - 4} Td (${pdfText(label)}) Tj ET`);
            cmds.push(`BT /F2 9 Tf 0.12 0.18 0.6 rg ${rightX + 8} ${y - 14} Td (${pdfText(val || label)}) Tj ET`);
          }
          y -= boxH + 6;
          continue;
        }
        case "tableTitle":
          size = 9; isBold = true; color = "0.15 0.23 0.84"; x = 20;
          cmds.push(`q 0.93 0.95 1 rg 20 ${y - 6} 572 14 re f Q 0 0 0 rg`);
          break;
        case "tableHeader": {
          const cols = (row as { cols: string[] }).cols;
          const colW = 572 / cols.length;
          // Header bg
          cmds.push(`q 0.15 0.23 0.84 rg 20 ${y - 10} 572 14 re f Q`);
          cols.forEach((c, idx) => {
            const cx = 20 + idx * colW + 6;
            cmds.push(`BT /F2 7 Tf 1 1 1 rg ${cx} ${y - 4} Td (${pdfText(c)}) Tj ET`);
          });
          y -= 14;
          continue;
        }
        case "tableRow": {
          const rr = row as { cols: string[]; alt: boolean };
          const cols = rr.cols;
          const colW = 572 / cols.length;
          if (rr.alt) cmds.push(`q 0.97 0.97 0.97 rg 20 ${y - 10} 572 12 re f Q`);
          cmds.push(`q 0.88 0.88 0.88 rg 20 ${y - 10} 572 12 re S Q`);
          cols.forEach((c, idx) => {
            const cx = 20 + idx * colW + 6;
            cmds.push(`BT /F1 7 Tf 0.12 0.12 0.12 rg ${cx} ${y - 4} Td (${pdfText(c)}) Tj ET`);
          });
          y -= 12;
          continue;
        }
        case "tocItem":
          size = 8; color = "0.25 0.25 0.25"; x = 28;
          cmds.push(`BT /F1 ${size} Tf ${color} rg 22 ${y} Td (${pdfText("•")}) Tj ET`);
          x = 32;
          break;
        case "footerNote":
          size = 6.5; color = "0.5 0.5 0.5"; x = 20;
          break;
      }
      const font = isBold ? "F2" : "F1";
      if (row.kind === "sectionHeading") y -= 8;
      cmds.push(`BT /${font} ${size} Tf ${color} rg ${x} ${y} Td (${text}) Tj ET`);
      const gap: Record<string, number> = { title: 20, subtitle: 12, meta: 8, sectionHeading: 16, body: 10, tableTitle: 12, footerNote: 8, tocItem: 10 };
      y -= gap[row.kind] ?? 10;
    }

    // Footer
    const footerY = 28;
    cmds.push(`q 0.9 0.9 0.9 rg 20 ${footerY + 8} 572 0.6 re f Q 0 0 0 rg`);
    cmds.push(`BT /F1 6 Tf 0.5 0.5 0.5 rg 20 ${footerY} Td (${pdfText(`DropnFly Logistics Inc. • ${generatedStr} • ID ${reportId} • Page ${pageNum}/${totalPages}`)}) Tj ET`);
    cmds.push(`BT /F1 6 Tf 0.5 0.5 0.5 rg 500 ${footerY} Td (${pdfText("Confidential")}) Tj ET`);

    const content = cmds.join("\n");
    const contentId = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentId} 0 R >>`));
  });

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, idx) => {
    offsets.push(output.length);
    output += `${idx + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = output.length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(output);
}
