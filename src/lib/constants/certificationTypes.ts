// Common certificate/qualification types selectable both when an admin
// configures a client's required certifications (Site Requirements Config,
// /admin/clients/[id]) and when adding a certificate to an officer's
// profile (/admin/officers) - sharing one list is what makes the exact
// string match in assignSchedule's cert-matching check reliable, instead
// of comparing two independently free-typed strings.
export const CERTIFICATION_TYPES = [
  "עבודה בגובה",
  "עזרה ראשונה",
  "חומרים מסוכנים",
  "עבודה במרחב מוקף",
  "תעופה",
  "תחבורה",
] as const;

export type CertificationType = (typeof CERTIFICATION_TYPES)[number];

// Escape hatch for a certificate type not in the preset list above.
export const OTHER_CERTIFICATION = "אחר";
