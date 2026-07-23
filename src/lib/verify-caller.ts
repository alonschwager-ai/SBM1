import "server-only";
import { adminAuth } from "@/lib/firebase-admin";

export interface CallerClaims {
  uid: string;
  role?: "admin" | "safety_officer";
}

export async function verifyCaller(idToken: string): Promise<CallerClaims> {
  const decoded = await adminAuth().verifyIdToken(idToken);
  return { uid: decoded.uid, role: decoded.role as CallerClaims["role"] };
}
