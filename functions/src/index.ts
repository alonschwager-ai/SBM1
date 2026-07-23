import { initializeApp } from "firebase-admin/app";

initializeApp();

export { onAuthUserCreate, onUserRoleWrite, revokeOfficerSessions } from "./auth";
export { onCertificateWrite } from "./certificates";
export { assignSchedule, syncClientAssignments } from "./schedules";
