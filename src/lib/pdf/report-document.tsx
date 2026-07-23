import path from "path";
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import {
  CHECKLIST_STATUS_LABELS,
  ChecklistStatus,
  HAZARD_SEVERITY_LABELS,
  HAZARD_STATUS_LABELS,
  HazardSeverity,
  HazardStatus,
  SAFETY_CATEGORY_LABELS,
  SafetyCategory,
} from "@/lib/types";

Font.register({
  family: "Rubik",
  fonts: [
    { src: path.join(process.cwd(), "public/fonts/Rubik-Regular.woff") },
    {
      src: path.join(process.cwd(), "public/fonts/Rubik-Bold.woff"),
      fontWeight: "bold",
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    direction: "rtl",
    fontFamily: "Rubik",
    fontSize: 11,
    padding: 32,
    color: "#111827",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#111827",
    paddingBottom: 10,
    marginBottom: 16,
  },
  brand: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "right",
  },
  subtitle: {
    fontSize: 10,
    color: "#6b7280",
    textAlign: "right",
    marginTop: 2,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "right",
    marginBottom: 6,
  },
  row: {
    flexDirection: "row-reverse",
    marginBottom: 3,
  },
  label: {
    fontWeight: "bold",
    marginLeft: 4,
  },
  value: {
    textAlign: "right",
  },
  paragraph: {
    textAlign: "right",
    lineHeight: 1.5,
  },
  hazardCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  hazardHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  severityBadge: {
    fontSize: 9,
    fontWeight: "bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hazardPhoto: {
    width: 140,
    height: 140,
    objectFit: "cover",
    marginTop: 6,
    borderRadius: 4,
  },
  hazardPhotoRow: {
    flexDirection: "row-reverse",
    gap: 10,
    marginTop: 6,
  },
  hazardPhotoCaption: {
    fontSize: 8,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 2,
  },
  statusBadge: {
    fontSize: 9,
    fontWeight: "bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  resolutionBox: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 6,
  },
  categoryTag: {
    fontSize: 9,
    color: "#6b7280",
  },
  checklistRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    paddingVertical: 4,
  },
  checklistLabel: {
    flex: 1,
    textAlign: "right",
    marginRight: 8,
  },
  checklistStatusBadge: {
    fontSize: 9,
    fontWeight: "bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  checklistNote: {
    fontSize: 9,
    color: "#6b7280",
    textAlign: "right",
    marginTop: 2,
  },
  signatureImage: {
    width: 220,
    height: 80,
    objectFit: "contain",
    marginTop: 6,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    textAlign: "center",
    fontSize: 8,
    color: "#9ca3af",
  },
});

const SEVERITY_COLORS: Record<HazardSeverity, { bg: string; text: string }> = {
  low: { bg: "#d1fae5", text: "#065f46" },
  medium: { bg: "#fef3c7", text: "#92400e" },
  high: { bg: "#fee2e2", text: "#991b1b" },
  critical: { bg: "#fecaca", text: "#7f1d1d" },
};

const CHECKLIST_STATUS_COLORS: Record<ChecklistStatus, { bg: string; text: string }> = {
  pass: { bg: "#d1fae5", text: "#065f46" },
  fail: { bg: "#fecaca", text: "#7f1d1d" },
  na: { bg: "#e5e7eb", text: "#4b5563" },
};

const HAZARD_STATUS_COLORS: Record<HazardStatus, { bg: string; text: string }> = {
  OPEN: { bg: "#fecaca", text: "#7f1d1d" },
  IN_PROGRESS: { bg: "#fef3c7", text: "#92400e" },
  RESOLVED: { bg: "#d1fae5", text: "#065f46" },
};

export interface ReportPdfHazard {
  description: string;
  severity: HazardSeverity;
  category?: SafetyCategory;
  dueDate: Date;
  photoUrl?: string;
  status: HazardStatus;
  resolvedAt?: Date;
  resolutionComment?: string;
  resolutionPhotoUrl?: string;
}

export interface ReportPdfChecklistResult {
  itemLabel: string;
  category: SafetyCategory;
  status: ChecklistStatus;
  note?: string;
}

export interface ReportPdfProps {
  companyName: string;
  clientName: string;
  clientAddress?: string;
  officerName: string;
  scheduledDate: Date;
  summary: string;
  checklistResults: ReportPdfChecklistResult[];
  hazards: ReportPdfHazard[];
  signatureUrl?: string;
}

export function ReportDocument({
  companyName,
  clientName,
  clientAddress,
  officerName,
  scheduledDate,
  summary,
  checklistResults,
  hazards,
  signatureUrl,
}: ReportPdfProps) {
  const dateLabel = scheduledDate.toLocaleDateString("he-IL");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>{companyName}</Text>
          <Text style={styles.subtitle}>דוח ביקורת בטיחות</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>לקוח:</Text>
            <Text style={styles.value}>{clientName}</Text>
          </View>
          {clientAddress && (
            <View style={styles.row}>
              <Text style={styles.label}>כתובת:</Text>
              <Text style={styles.value}>{clientAddress}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>ממונה בטיחות:</Text>
            <Text style={styles.value}>{officerName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>תאריך ביקורת:</Text>
            <Text style={styles.value}>{dateLabel}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>סיכום ביקורת</Text>
          <Text style={styles.paragraph}>{summary}</Text>
        </View>

        {checklistResults.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>תוצאות שאלון בטיחות</Text>
            {checklistResults.map((result, index) => (
              <View key={index} style={styles.checklistRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.checklistLabel}>{result.itemLabel}</Text>
                  <Text style={[styles.checklistNote, styles.categoryTag]}>
                    {SAFETY_CATEGORY_LABELS[result.category]}
                  </Text>
                  {result.note && <Text style={styles.checklistNote}>{result.note}</Text>}
                </View>
                <Text
                  style={[
                    styles.checklistStatusBadge,
                    {
                      backgroundColor: CHECKLIST_STATUS_COLORS[result.status].bg,
                      color: CHECKLIST_STATUS_COLORS[result.status].text,
                    },
                  ]}
                >
                  {CHECKLIST_STATUS_LABELS[result.status]}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>מפגעים שזוהו ({hazards.length})</Text>
          {hazards.length === 0 && (
            <Text style={styles.paragraph}>לא זוהו מפגעים בביקורת זו</Text>
          )}
          {hazards.map((hazard, index) => (
            <View key={index} style={styles.hazardCard} wrap={false}>
              <View style={styles.hazardHeader}>
                <View style={{ flexDirection: "row-reverse", gap: 4 }}>
                  <Text
                    style={[
                      styles.severityBadge,
                      {
                        backgroundColor: SEVERITY_COLORS[hazard.severity].bg,
                        color: SEVERITY_COLORS[hazard.severity].text,
                      },
                    ]}
                  >
                    {HAZARD_SEVERITY_LABELS[hazard.severity]}
                  </Text>
                  <Text
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: HAZARD_STATUS_COLORS[hazard.status].bg,
                        color: HAZARD_STATUS_COLORS[hazard.status].text,
                      },
                    ]}
                  >
                    {HAZARD_STATUS_LABELS[hazard.status]}
                  </Text>
                </View>
                <Text>תיקון עד: {hazard.dueDate.toLocaleDateString("he-IL")}</Text>
              </View>
              {hazard.category && (
                <Text style={styles.categoryTag}>{SAFETY_CATEGORY_LABELS[hazard.category]}</Text>
              )}
              <Text style={styles.paragraph}>{hazard.description}</Text>

              {(hazard.photoUrl || hazard.resolutionPhotoUrl) && (
                <View style={styles.hazardPhotoRow}>
                  {hazard.photoUrl && (
                    <View>
                      {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image, not an <img> */}
                      <Image src={hazard.photoUrl} style={styles.hazardPhoto} />
                      <Text style={styles.hazardPhotoCaption}>לפני</Text>
                    </View>
                  )}
                  {hazard.resolutionPhotoUrl && (
                    <View>
                      {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image, not an <img> */}
                      <Image src={hazard.resolutionPhotoUrl} style={styles.hazardPhoto} />
                      <Text style={styles.hazardPhotoCaption}>אחרי</Text>
                    </View>
                  )}
                </View>
              )}

              {hazard.status === "RESOLVED" && (
                <View style={styles.resolutionBox}>
                  <Text style={styles.categoryTag}>
                    טופל
                    {hazard.resolvedAt ? ` בתאריך ${hazard.resolvedAt.toLocaleDateString("he-IL")}` : ""}
                  </Text>
                  {hazard.resolutionComment && (
                    <Text style={styles.paragraph}>{hazard.resolutionComment}</Text>
                  )}
                </View>
              )}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>חתימת לקוח</Text>
          {signatureUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image, not an <img>
            <Image src={signatureUrl} style={styles.signatureImage} />
          ) : (
            <Text style={styles.paragraph}>לא נמצאה חתימה</Text>
          )}
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
