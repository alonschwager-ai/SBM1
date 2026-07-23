"use server";

import { Resend } from "resend";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { getReportAccessInfo, renderReportPdf } from "@/lib/pdf/render-report-pdf";
import { verifyCaller } from "@/lib/verify-caller";

export interface SubmitReportResult {
  ok: boolean;
  error?: string;
}

/**
 * Renders the report to PDF, stores it, and emails it to the client's
 * contact address via Resend. Shared by two callers:
 *  - the officer's report form (/officer/reports/new), right after submission
 *  - the admin's "Send Report to Client" action in the client workspace
 *    reports archive (/admin/clients/[id]), to re-send an existing report
 *    (e.g. after a hazard gets resolved and the PDF should reflect that)
 */
export async function submitReportAction(
  reportId: string,
  idToken: string
): Promise<SubmitReportResult> {
  try {
    const caller = await verifyCaller(idToken);
    const access = await getReportAccessInfo(reportId);
    if (caller.role !== "admin" && caller.uid !== access.userId) {
      return { ok: false, error: "אין הרשאה לדוח זה" };
    }

    const pdfBuffer = await renderReportPdf(reportId);
    const db = adminDb();

    const bucketFile = adminStorage().bucket().file(`reports/${reportId}/report.pdf`);
    await bucketFile.save(pdfBuffer, { contentType: "application/pdf" });
    const [pdfUrl] = await bucketFile.getSignedUrl({
      action: "read",
      expires: Date.now() + 1000 * 60 * 60 * 24 * 365 * 10,
    });

    await db.collection("reports").doc(reportId).update({ pdfUrl });

    const clientSnap = await db.collection("clients").doc(access.clientId).get();
    const contactEmail = clientSnap.data()?.contactEmail as string | undefined;

    if (!contactEmail) {
      return { ok: false, error: "ללקוח אין אימייל איש קשר מוגדר" };
    }
    if (!process.env.RESEND_API_KEY) {
      return { ok: false, error: "שירות המייל אינו מוגדר" };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "reports@resend.dev",
      to: contactEmail,
      subject: "דוח ביקורת בטיחות",
      html: "<div dir='rtl'>מצורף דוח ביקורת הבטיחות האחרון שבוצע באתרכם.</div>",
      attachments: [{ filename: `report-${reportId}.pdf`, content: pdfBuffer }],
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    await db.collection("reports").doc(reportId).update({
      emailedAt: new Date(),
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "שגיאה לא צפויה" };
  }
}
