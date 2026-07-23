import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { CERT_EXPIRY_WARNING_DAYS, CertStatus, CertificateDoc } from "./types";

const db = () => getFirestore();

/**
 * Recompute the denormalized certStatus/nearestCertExpiration on the
 * owning officer's `users/{uid}` doc whenever one of their certificates
 * is created, edited, or deleted.
 *
 * This snapshot is used for fast UI reads (dashboard badges, disabling
 * the officer in the scheduling board before the admin even tries to
 * assign them). It is NOT the authoritative check for the hard
 * "no expired/expiring cert" business rule - that lives in
 * assignSchedule, which runs a live query at write time to avoid any
 * staleness window. See schedules.ts.
 */
export const onCertificateWrite = onDocumentWritten("certificates/{certId}", async (event) => {
  const userId =
    event.data?.after.data()?.userId ?? event.data?.before.data()?.userId;
  if (!userId) return;

  await recomputeCertStatus(userId);
});

export async function recomputeCertStatus(userId: string): Promise<void> {
  const snapshot = await db()
    .collection("certificates")
    .where("userId", "==", userId)
    .get();

  if (snapshot.empty) {
    await db().collection("users").doc(userId).set(
      { certStatus: "none" as CertStatus, nearestCertExpiration: null },
      { merge: true }
    );
    return;
  }

  const now = Timestamp.now();
  const warningCutoff = Timestamp.fromMillis(
    now.toMillis() + CERT_EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000
  );

  let nearest: Timestamp | null = null;
  let status: CertStatus = "valid";

  snapshot.forEach((doc) => {
    const cert = doc.data() as CertificateDoc;
    if (!nearest || cert.expirationDate.toMillis() < nearest.toMillis()) {
      nearest = cert.expirationDate;
    }
    if (cert.expirationDate.toMillis() < now.toMillis()) {
      status = "expired";
    } else if (
      cert.expirationDate.toMillis() < warningCutoff.toMillis() &&
      status !== "expired"
    ) {
      status = "expiring_soon";
    }
  });

  await db()
    .collection("users")
    .doc(userId)
    .set({ certStatus: status, nearestCertExpiration: nearest }, { merge: true });
}
