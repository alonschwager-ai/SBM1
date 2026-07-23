import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { auth } from "firebase-functions/v1";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { UserDoc } from "./types";

const db = () => getFirestore();

/**
 * Provision a `users/{uid}` profile the moment someone signs up, and set
 * their initial custom claim.
 *
 * Bootstrap rule: the very first account ever created becomes `admin`
 * (there is no admin yet to promote anyone, so this is the only way to
 * get the business owner into the system). Every account after that
 * defaults to `safety_officer` - promoting someone to `admin` from then
 * on is a deliberate follow-up action taken by an existing admin, never
 * automatic.
 */
export const onAuthUserCreate = auth.user().onCreate(async (user) => {
  const now = FieldValue.serverTimestamp();

  const existingUsers = await db().collection("users").limit(1).get();
  const role = existingUsers.empty ? "admin" : "safety_officer";

  await getAuth().setCustomUserClaims(user.uid, { role });

  const profile: Partial<UserDoc> = {
    fullName: user.displayName ?? user.email ?? "New User",
    role,
    certStatus: "none",
    nearestCertExpiration: null,
  };

  await db()
    .collection("users")
    .doc(user.uid)
    .set({ ...profile, createdAt: now, updatedAt: now }, { merge: true });
});

/**
 * Keep the `role` custom claim in sync with `users/{uid}.role`.
 *
 * Firestore security rules block a user from writing their own `role`
 * field (see firestore.rules), so this only ever fires from an admin
 * write - but the client must still force-refresh its ID token
 * (getIdToken(true)) to pick up the new claim, since claims are only
 * embedded in the token at mint time.
 */
export const onUserRoleWrite = onDocumentUpdated("users/{userId}", async (event) => {
  const before = event.data?.before.data() as UserDoc | undefined;
  const after = event.data?.after.data() as UserDoc | undefined;
  if (!before || !after || before.role === after.role) return;

  await getAuth().setCustomUserClaims(event.params.userId, { role: after.role });
});

interface RevokeOfficerSessionsRequest {
  userId: string;
}

/**
 * "Reset permissions" quick control on /admin/officers: forces the target
 * account to re-authenticate everywhere it's signed in, so a freshly
 * synced role/claim (or a just-set active:false) takes effect immediately
 * instead of waiting for their existing ID token to expire naturally.
 */
export const revokeOfficerSessions = onCall<RevokeOfficerSessionsRequest>(async (request) => {
  if (request.auth?.token.role !== "admin") {
    throw new HttpsError("permission-denied", "רק מנהל מערכת רשאי לאפס הרשאות");
  }

  const { userId } = request.data;
  if (!userId) {
    throw new HttpsError("invalid-argument", "חסר שדה חובה: userId");
  }

  await getAuth().revokeRefreshTokens(userId);
  return { ok: true };
});
