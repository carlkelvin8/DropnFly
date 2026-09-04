import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createReportPdf } from "@/lib/simple-pdf";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const report = await req.json();
  if (!report?.title || !report?.summary || !Array.isArray(report.sections)) {
    return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  }
  const pdf = createReportPdf(report);
  return new NextResponse(new TextDecoder().decode(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="dropnfly-report-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
