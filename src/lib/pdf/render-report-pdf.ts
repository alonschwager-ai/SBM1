import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { adminDb } from "@/lib/firebase-admin";
import { getIndustryChecklistItem } from "@/lib/constants/industryChecklists";
import { ChecklistResultEntry, IndustrySector, SAFETY_CATEGORY_LABELS } from "@/lib/types";
import { ReportDocument, ReportPdfChecklistResult, ReportPdfHazard } from "./report-document";

const COMPANY_NAME = "ניהול ממוני בטיחות";

export class ReportNotFoundError extends Error {}

export async function renderReportPdf(reportId: string): Promise<Buffer> {
  const db = adminDb();
  const reportSnap = await db.collection("reports").doc(reportId).get();
  if (!reportSnap.exists) throw new ReportNotFoundError(`Report ${reportId} not found`);
  const report = reportSnap.data()!;

  const [clientSnap, officerSnap, scheduleSnap, hazardsSnap] = await Promise.all([
    db.collection("clients").doc(report.clientId).get(),
    db.collection("users").doc(report.userId).get(),
    db.collection("schedules").doc(report.scheduleId).get(),
    db.collection("hazards").where("reportId", "==", reportId).get(),
  ]);

  const client = clientSnap.data();
  const officer = officerSnap.data();
  const schedule = scheduleSnap.data();

  const hazards: ReportPdfHazard[] = hazardsSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      description: data.description,
      severity: data.severity,
      category: data.category,
      dueDate: data.dueDate.toDate(),
      photoUrl: data.photoUrl,
      status: data.status ?? "OPEN",
      resolvedAt: data.resolvedAt?.toDate(),
      resolutionComment: data.resolutionComment,
      resolutionPhotoUrl: data.resolutionPhotoUrl,
    };
  });

  const industrySector = client?.industrySector as IndustrySector | undefined;
  const checklistResults: ReportPdfChecklistResult[] = (
    (report.checklistResults as ChecklistResultEntry[] | undefined) ?? []
  ).map((entry) => {
    const item = industrySector ? getIndustryChecklistItem(industrySector, entry.itemId) : undefined;
    return {
      itemLabel: item?.label ?? SAFETY_CATEGORY_LABELS[entry.category],
      category: entry.category,
      status: entry.status,
      note: entry.note,
    };
  });

  return renderToBuffer(
    ReportDocument({
      companyName: COMPANY_NAME,
      clientName: client?.companyName ?? "לקוח",
      clientAddress: client?.address,
      officerName: officer?.fullName ?? "ממונה בטיחות",
      scheduledDate: schedule?.scheduledDate?.toDate() ?? report.createdAt.toDate(),
      summary: report.summary,
      checklistResults,
      hazards,
      signatureUrl: report.signatureUrl,
    })
  );
}

export async function getReportAccessInfo(reportId: string) {
  const snap = await adminDb().collection("reports").doc(reportId).get();
  if (!snap.exists) throw new ReportNotFoundError(`Report ${reportId} not found`);
  const data = snap.data()!;
  return { userId: data.userId as string, clientId: data.clientId as string };
}
