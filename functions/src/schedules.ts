import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { CERT_EXPIRY_WARNING_DAYS, ScheduleStatus } from "./types";

const db = () => getFirestore();

interface AssignScheduleRequest {
  scheduleId?: string; // omit to create a new schedule
  userId: string; // safety officer being assigned
  clientId: string;
  scheduledDate: string; // ISO 8601
}

/**
 * The single entry point for creating a schedule or reassigning its
 * officer/date. This is the authoritative enforcement of two hard
 * business rules:
 *
 *   1. "block assigning a safety officer if any of their certificates is
 *      expired, or expires in under 7 days"
 *   2. "block assigning a safety officer who doesn't hold a valid
 *      certificate for every type the client requires"
 *      (clients/{clientId}.requiredCertTypes, set from the client's Site
 *      Requirements config on /admin/clients/[id])
 *
 * Firestore security rules can only see a denormalized snapshot
 * (users/{uid}.certStatus, refreshed asynchronously by
 * onCertificateWrite) which has an eventual-consistency gap right
 * after a certificate is edited. For legal/safety compliance rules like
 * these, that gap is not acceptable, so both checks are done here with a
 * live query against `certificates`, using the Admin SDK, at the moment
 * of assignment. firestore.rules correspondingly blocks direct client
 * writes that create or reassign a schedule (see `allow create: if
 * false` there) - everything must flow through this function.
 */
export const assignSchedule = onCall<AssignScheduleRequest>(async (request) => {
  if (request.auth?.token.role !== "admin") {
    throw new HttpsError("permission-denied", "רק מנהל מערכת רשאי לשבץ ממונה בטיחות");
  }

  const { scheduleId, userId, clientId, scheduledDate } = request.data;
  if (!userId || !clientId || !scheduledDate) {
    throw new HttpsError("invalid-argument", "חסרים שדות חובה: userId, clientId, scheduledDate");
  }

  const clientDoc = await db().collection("clients").doc(clientId).get();
  if (!clientDoc.exists) {
    throw new HttpsError("not-found", "לקוח לא נמצא");
  }

  const now = Timestamp.now();
  const warningCutoff = Timestamp.fromMillis(
    now.toMillis() + CERT_EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000
  );

  const officerCerts = await db()
    .collection("certificates")
    .where("userId", "==", userId)
    .get();

  const isValid = (expirationDate: Timestamp) => expirationDate.toMillis() >= warningCutoff.toMillis();

  const hasExpiredOrExpiringSoon = officerCerts.docs.some(
    (certDoc) => !isValid(certDoc.data().expirationDate as Timestamp)
  );
  if (hasExpiredOrExpiringSoon) {
    throw new HttpsError(
      "failed-precondition",
      "לא ניתן לשבץ ממונה בטיחות זה: קיימת תעודה שפג תוקפה או שתפוג תוך פחות מ-7 ימים"
    );
  }

  const requiredCertTypes = (clientDoc.data()?.requiredCertTypes as string[] | undefined) ?? [];
  if (requiredCertTypes.length > 0) {
    const heldValidTypes = new Set(
      officerCerts.docs
        .filter((certDoc) => isValid(certDoc.data().expirationDate as Timestamp))
        .map((certDoc) => (certDoc.data().certType as string).trim().toLowerCase())
    );
    const missing = requiredCertTypes.filter(
      (required) => !heldValidTypes.has(required.trim().toLowerCase())
    );
    if (missing.length > 0) {
      throw new HttpsError(
        "failed-precondition",
        `לא ניתן לשבץ ממונה בטיחות זה: חסרות תעודות נדרשות עבור לקוח זה (${missing.join(", ")})`
      );
    }
  }

  const data = {
    userId,
    clientId,
    scheduledDate: Timestamp.fromDate(new Date(scheduledDate)),
    status: "scheduled" as ScheduleStatus,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (scheduleId) {
    await db().collection("schedules").doc(scheduleId).set(data, { merge: true });
    return { scheduleId };
  }

  const ref = await db()
    .collection("schedules")
    .add({ ...data, createdAt: FieldValue.serverTimestamp() });
  return { scheduleId: ref.id };
});

/**
 * Keep clients/{clientId}.assignedOfficerIds in sync so Firestore
 * security rules can let an officer read only the clients they
 * actually service, without running a live query inside a rule (rules
 * can only `get()` documents by known path, not filter a collection).
 *
 * Recomputes from scratch on every create/update/delete of a schedule
 * rather than incrementally arrayUnion/Remove-ing, so it self-heals
 * and can never drift out of sync.
 */
export const syncClientAssignments = onDocumentWritten("schedules/{scheduleId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();

  const clientIds = new Set<string>();
  if (before?.clientId) clientIds.add(before.clientId);
  if (after?.clientId) clientIds.add(after.clientId);

  await Promise.all([...clientIds].map(recomputeAssignedOfficers));
});

async function recomputeAssignedOfficers(clientId: string): Promise<void> {
  const snapshot = await db()
    .collection("schedules")
    .where("clientId", "==", clientId)
    .get();

  const officerIds = [...new Set(snapshot.docs.map((doc) => doc.data().userId as string))];

  await db()
    .collection("clients")
    .doc(clientId)
    .set({ assignedOfficerIds: officerIds }, { merge: true });
}
