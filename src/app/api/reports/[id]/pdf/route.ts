import { NextRequest, NextResponse } from "next/server";
import { getReportAccessInfo, renderReportPdf, ReportNotFoundError } from "@/lib/pdf/render-report-pdf";
import { verifyCaller } from "@/lib/verify-caller";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const idToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!idToken) {
    return NextResponse.json({ error: "missing authorization" }, { status: 401 });
  }

  try {
    const caller = await verifyCaller(idToken);
    const access = await getReportAccessInfo(id);
    if (caller.role !== "admin" && caller.uid !== access.userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const pdfBuffer = await renderReportPdf(id);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="report-${id}.pdf"`,
      },
    });
  } catch (err) {
    if (err instanceof ReportNotFoundError) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}
