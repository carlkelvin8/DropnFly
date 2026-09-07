import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createReportPdf } from "@/lib/simple-pdf";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  // Support both legacy {title,summary,sections,generatedAt} and new { report, dateRange, reportType, kpis }
  const report = body.report ? body.report : body;
  const dateRange = body.dateRange || body.report?.dateRange;
  const reportType = body.reportType || body.report?.reportType || body.type || "financial";
  const kpis = body.kpis || body.report?.kpis;
  const tables = body.tables || body.report?.tables;

  if (!report?.title || !report?.summary || !Array.isArray(report.sections)) {
    return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  }

  const enriched = {
    ...report,
    reportType,
    dateRange,
    kpis,
    tables,
  };

  const pdf = createReportPdf(enriched);

  // Professional filename: Financial-Oversight-Report-YYYY-MM-DD-to-YYYY-MM-DD.pdf
  const safeRange = (dateRange || new Date().toISOString().slice(0, 10)).replace(/\s+/g, "-").replace(/[^0-9A-Za-z\-to]/g, "");
  const formattedType = String(reportType).charAt(0).toUpperCase() + String(reportType).slice(1);
  const filename = `Financial-Oversight-Report-${formattedType}-${safeRange}.pdf`.replace(/\s+/g, "-");

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.length),
    },
  });
}
