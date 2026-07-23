import type { Timestamp } from "firebase/firestore";

export type UserRole = "admin" | "safety_officer";

export type CertStatus = "valid" | "expiring_soon" | "expired" | "none";

export const CERT_EXPIRY_WARNING_DAYS = 7;

export interface UserDoc {
  fullName: string;
  role: UserRole;
  phone?: string;
  region?: string;
  certStatus: CertStatus;
  nearestCertExpiration: Timestamp | null;
  // Defaults to active when unset. Set to false from /admin/officers'
  // quick controls; enforced client-side (auth-context signs the user out
  // as soon as their own profile doc reflects active === false).
  active?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CertificateDoc {
  userId: string;
  certType: string;
  issueDate: Timestamp;
  expirationDate: Timestamp;
  documentUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ScheduleStatus = "scheduled" | "completed" | "canceled";

export interface ScheduleDoc {
  userId: string;
  clientId: string;
  scheduledDate: Timestamp;
  status: ScheduleStatus;
  checkedInAt?: Timestamp | null;
  // Captured best-effort from the browser Geolocation API at check-in time
  // (see /officer/dashboard) - never blocks check-in if unavailable/denied.
  // Powers the "Live Site Pulse" widget on /admin/clients/[id].
  checkedInLocation?: { lat: number; lng: number } | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Industry sector a client operates in - drives which SafetyCategory
// checklist the officer sees on /officer/reports/new (see
// src/lib/constants/industryChecklists.ts, the single source of truth for
// the sector -> category -> checklist item mapping).
export type IndustrySector =
  | "high_tech_field" // הייטק ועבודות שטח אזרחיות
  | "office_corporate" // סביבה משרדית ומטה
  | "logistics_warehousing" // לוגיסטיקה ומחסנים
  | "labs_industry" // תעשייה, מעבדות ו-R&D
  | "food_hospitality"; // מסעדנות, מזון ואירוח

export const INDUSTRY_SECTOR_LABELS: Record<IndustrySector, string> = {
  high_tech_field: "הייטק ועבודות שטח אזרחיות",
  office_corporate: "סביבה משרדית ומטה",
  logistics_warehousing: "לוגיסטיקה ומחסנים",
  labs_industry: "תעשייה, מעבדות ו-R&D",
  food_hospitality: "מסעדנות, מזון ואירוח",
};

// Cross-cutting safety topics that checklist items and hazards are tagged
// with, so hazards can be aggregated by category regardless of client/sector.
export type SafetyCategory =
  | "ENVIRONMENT_CLIMATE" // אקלים ועומס חום
  | "ERGONOMICS_HEALTH" // ארגונומיה ובריאות
  | "FIRE_EVACUATION" // אש, כיבוי ומילוט
  | "ROAD_SAFETY" // בטיחות בדרכים ונהיגה
  | "HAZMAT_LABS" // חומרים מסוכנים ומעבדות
  | "LOGISTICS_LIFTING" // שינוע, הרמה ומידוף
  | "MACHINERY_FOOD"; // מכונות, בטיחות חשמל ומטבחים

export const SAFETY_CATEGORY_LABELS: Record<SafetyCategory, string> = {
  ENVIRONMENT_CLIMATE: "אקלים ועומס חום",
  ERGONOMICS_HEALTH: "ארגונומיה ובריאות",
  FIRE_EVACUATION: "אש, כיבוי ומילוט",
  ROAD_SAFETY: "בטיחות בדרכים ונהיגה",
  HAZMAT_LABS: "חומרים מסוכנים ומעבדות",
  LOGISTICS_LIFTING: "שינוע, הרמה ומידוף",
  MACHINERY_FOOD: "מכונות, בטיחות חשמל ומטבחים",
};

export interface ClientDoc {
  companyName: string;
  contactPerson?: string;
  contactEmail?: string;
  phone?: string;
  address?: string;
  region?: string;
  assignedOfficerIds: string[];
  // Permanent/primary safety officer for this client, set directly by an
  // admin - independent of assignedOfficerIds, which is derived from
  // whoever has ever been scheduled there (see syncClientAssignments).
  assignedOfficerId?: string;
  clientSafetyContactName?: string;
  clientSafetyContactPhone?: string;
  googleMapsUrl?: string;
  weeklyDaysCount?: number;
  industrySector?: IndustrySector;
  // Free-text certificate-type labels (matched against
  // CertificateDoc.certType) an officer must hold, unexpired, to be
  // assignable here - enforced server-side in assignSchedule.
  requiredCertTypes?: string[];
  // Admin-only: rendered only on admin-facing views, and gated by
  // storage.rules to admin-only read/write (see contracts/{clientId}/*).
  contractDocUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type HazardSeverity = "low" | "medium" | "high" | "critical";

export const HAZARD_SEVERITY_LABELS: Record<HazardSeverity, string> = {
  low: "נמוכה",
  medium: "בינונית",
  high: "גבוהה",
  critical: "קריטית",
};

export type ChecklistStatus = "pass" | "fail" | "na";

export const CHECKLIST_STATUS_LABELS: Record<ChecklistStatus, string> = {
  pass: "תקין",
  fail: "נכשל",
  na: "לא רלוונטי",
};

export interface ChecklistResultEntry {
  itemId: string;
  category: SafetyCategory;
  status: ChecklistStatus;
  note?: string;
}

export interface ReportDoc {
  scheduleId: string;
  clientId: string;
  userId: string;
  summary: string;
  // Snapshot of the industry safety checklist filled in during this visit
  // (see src/lib/constants/industryChecklists.ts). Only items the officer
  // actually set a status on are included.
  checklistResults?: ChecklistResultEntry[];
  signatureUrl?: string;
  pdfUrl?: string;
  emailedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type HazardStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

export const HAZARD_STATUS_LABELS: Record<HazardStatus, string> = {
  OPEN: "פתוח",
  IN_PROGRESS: "בטיפול",
  RESOLVED: "טופל",
};

export interface HazardDoc {
  reportId: string;
  // Denormalized from the parent report at creation time so admin/officer
  // views can query hazards directly by client or by reporter without an
  // extra get() per hazard (see /admin/hazards, /admin/clients/[id],
  // and the "My Open Hazards" section on /officer/workplaces).
  clientId: string;
  userId: string;
  description: string;
  severity: HazardSeverity;
  // Set from the checklist item's category when created via the "יצירת
  // מפגע" quick action on a FAIL, or picked manually for freeform hazards -
  // powers the admin dashboard's hazard-by-category breakdown.
  category?: SafetyCategory;
  dueDate: Timestamp;
  photoUrl?: string;
  status: HazardStatus;
  resolvedBy?: string;
  resolvedAt?: Timestamp | null;
  resolutionComment?: string;
  // "Proof of fix" photo, uploaded to the same hazards/{reportId}/* Storage
  // path as the original hazard photo.
  resolutionPhotoUrl?: string;
  createdAt: Timestamp;
}

export const CERT_STATUS_LABELS: Record<CertStatus, string> = {
  valid: "בתוקף",
  expiring_soon: "פג תוקף בקרוב",
  expired: "פג תוקף",
  none: "ללא תעודה",
};

// An officer's ask to change one of their own schedules. Always
// admin-mediated - there is no peer-to-peer negotiation flow: for a
// "swap" the officer just names who/why in `note`, and an admin resolves
// it manually (see /admin/schedule's Pending Requests widget). Approving
// a "reschedule" replays through the existing assignSchedule callable (so
// the cert-expiry check still applies); approving "swap"/"absence" simply
// cancels the original schedule for the admin to reassign.
export type ScheduleChangeRequestType = "reschedule" | "swap" | "absence";
export type ScheduleChangeRequestStatus = "PENDING_ADMIN_APPROVAL" | "approved" | "rejected";

export const SCHEDULE_CHANGE_TYPE_LABELS: Record<ScheduleChangeRequestType, string> = {
  reschedule: "הזזת תאריך",
  swap: "החלפה עם עמית",
  absence: "היעדרות",
};

export const SCHEDULE_CHANGE_STATUS_LABELS: Record<ScheduleChangeRequestStatus, string> = {
  PENDING_ADMIN_APPROVAL: "ממתין לאישור מנהל",
  approved: "אושר",
  rejected: "נדחה",
};

export interface ScheduleChangeRequestDoc {
  scheduleId: string;
  userId: string;
  clientId: string;
  scheduledDate: Timestamp;
  type: ScheduleChangeRequestType;
  note: string;
  requestedDate?: Timestamp | null;
  status: ScheduleChangeRequestStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Safety guideline / regulation PDF, managed by an admin at
// /admin/safety-docs and surfaced to officers on /officer/tools, grouped
// by the IndustrySector(s) of the clients they currently serve.
export interface SafetyDocDoc {
  title: string;
  sector: IndustrySector;
  fileUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
