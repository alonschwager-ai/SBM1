import "server-only";
import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// FIREBASE_SERVICE_ACCOUNT_KEY is the service account JSON, either raw or
// base64-encoded (base64 avoids escaping issues in most env var UIs).
function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not set");
  }
  const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(json);
}

// Lazily initialized so importing this module doesn't require the service
// account env var to be present at build/collection time - only when a
// route handler or Server Action actually calls one of these getters.
let app: App | undefined;

function getAdminApp(): App {
  if (!app) {
    app = getApps()[0] ?? initializeApp({
      credential: cert(loadServiceAccount()),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }
  return app;
}

export const adminAuth = () => getAuth(getAdminApp());
export const adminDb = () => getFirestore(getAdminApp());
export const adminStorage = () => getStorage(getAdminApp());
