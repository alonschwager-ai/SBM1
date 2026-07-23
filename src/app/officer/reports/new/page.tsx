"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad, SignaturePadHandle } from "@/components/officer/signature-pad";
import {
  ChecklistEntryState,
  SafetyChecklist,
} from "@/components/officer/safety-checklist";
import { useAuth } from "@/lib/auth-context";
import { db, storage } from "@/lib/firebase";
import {
  ChecklistItem,
  getIndustryCategories,
  getIndustryChecklistItem,
} from "@/lib/constants/industryChecklists";
import {
  ChecklistResultEntry,
  ClientDoc,
  ChecklistStatus,
  HAZARD_SEVERITY_LABELS,
  HazardSeverity,
  SAFETY_CATEGORY_LABELS,
  SafetyCategory,
  ScheduleDoc,
} from "@/lib/types";
import { submitReportAction } from "@/lib/actions/report-actions";

const ALL_CATEGORIES = Object.keys(SAFETY_CATEGORY_LABELS) as SafetyCategory[];

interface HazardFormRow {
  key: string;
  description: string;
  severity: HazardSeverity;
  category: SafetyCategory | "";
  dueDate: string;
  photo: File | null;
  photoPreview: string | null;
}

function newHazardRow(overrides: Partial<HazardFormRow> = {}): HazardFormRow {
  return {
    key: crypto.randomUUID(),
    description: "",
    severity: "medium",
    category: "",
    dueDate: "",
    photo: null,
    photoPreview: null,
    ...overrides,
  };
}

export default function NewReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          טוען...
        </div>
      }
    >
      <ReportForm />
    </Suspense>
  );
}

function ReportForm() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const scheduleId = searchParams.get("scheduleId");

  const [schedule, setSchedule] = useState<(ScheduleDoc & { id: string }) | null>(null);
  const [client, setClient] = useState<ClientDoc | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [hazards, setHazards] = useState<HazardFormRow[]>([]);
  const [checklist, setChecklist] = useState<Record<string, ChecklistEntryState>>({});
  const [submitting, setSubmitting] = useState(false);
  const signatureRef = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    if (!user || !scheduleId) return;
    (async () => {
      const snap = await getDoc(doc(db, "schedules", scheduleId));
      if (!snap.exists() || (snap.data() as ScheduleDoc).userId !== user.uid) {
        setLoadError("השיבוץ לא נמצא או שאינו שייך אליך");
        return;
      }
      const scheduleData = { id: snap.id, ...(snap.data() as ScheduleDoc) };
      setSchedule(scheduleData);

      const clientSnap = await getDoc(doc(db, "clients", scheduleData.clientId));
      if (clientSnap.exists()) setClient(clientSnap.data() as ClientDoc);
    })();
  }, [user, scheduleId]);

  const availableCategories = client?.industrySector
    ? getIndustryCategories(client.industrySector)
    : ALL_CATEGORIES;

  if (!scheduleId || loadError) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-4 text-center">
        <p className="text-muted-foreground">
          {loadError ?? "יש לבחור ביקור מהדשבורד כדי למלא דוח"}
        </p>
        <Button render={<a href="/officer/dashboard" />}>חזרה לדשבורד</Button>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        טוען...
      </div>
    );
  }

  function addHazard(overrides?: Partial<HazardFormRow>) {
    setHazards((rows) => [...rows, newHazardRow(overrides)]);
  }

  function updateHazard(key: string, patch: Partial<HazardFormRow>) {
    setHazards((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeHazard(key: string) {
    setHazards((rows) => rows.filter((r) => r.key !== key));
  }

  function handleChecklistStatus(item: ChecklistItem, status: ChecklistStatus) {
    setChecklist((prev) => ({
      ...prev,
      [item.id]: { status, note: prev[item.id]?.note ?? "" },
    }));
  }

  function handleChecklistNote(itemId: string, note: string) {
    setChecklist((prev) => ({
      ...prev,
      [itemId]: { status: prev[itemId]?.status ?? "na", note },
    }));
  }

  function handleCreateHazardFromChecklist(item: ChecklistItem) {
    addHazard({
      description: item.label,
      category: item.category,
      severity: "high",
    });
    toast.info("נוסף מפגע לרשימה למטה בהתאם לפריט שסומן כנכשל");
  }

  async function handleSubmit() {
    if (!user || !schedule) return;
    if (!summary.trim()) {
      toast.error("יש למלא סיכום ביקורת");
      return;
    }
    if (signatureRef.current?.isEmpty()) {
      toast.error("יש לקבל חתימת לקוח");
      return;
    }

    setSubmitting(true);
    try {
      const checklistResults: ChecklistResultEntry[] = Object.entries(checklist).map(
        ([itemId, entry]) => {
          const item = client?.industrySector
            ? getIndustryChecklistItem(client.industrySector, itemId)
            : undefined;
          return {
            itemId,
            category: item?.category ?? "MACHINERY_FOOD",
            status: entry.status,
            ...(entry.note.trim() ? { note: entry.note.trim() } : {}),
          };
        }
      );

      const reportRef = await addDoc(collection(db, "reports"), {
        scheduleId: schedule.id,
        clientId: schedule.clientId,
        userId: user.uid,
        summary,
        ...(checklistResults.length > 0 ? { checklistResults } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      for (const hazard of hazards) {
        if (!hazard.description.trim() || !hazard.dueDate) continue;
        let photoUrl: string | undefined;
        if (hazard.photo) {
          const photoRef = ref(
            storage,
            `hazards/${reportRef.id}/${Date.now()}-${hazard.photo.name}`
          );
          await uploadBytes(photoRef, hazard.photo);
          photoUrl = await getDownloadURL(photoRef);
        }
        await addDoc(collection(db, "hazards"), {
          reportId: reportRef.id,
          clientId: schedule.clientId,
          userId: user.uid,
          description: hazard.description,
          severity: hazard.severity,
          dueDate: Timestamp.fromDate(new Date(hazard.dueDate)),
          status: "OPEN",
          ...(hazard.category ? { category: hazard.category } : {}),
          ...(photoUrl ? { photoUrl } : {}),
          createdAt: serverTimestamp(),
        });
      }

      const signatureBlob = await signatureRef.current?.toBlob();
      if (signatureBlob) {
        const signatureRefPath = ref(storage, `signatures/${reportRef.id}/signature.png`);
        await uploadBytes(signatureRefPath, signatureBlob);
        const signatureUrl = await getDownloadURL(signatureRefPath);
        await updateDoc(reportRef, { signatureUrl, updatedAt: serverTimestamp() });
      }

      await updateDoc(doc(db, "schedules", schedule.id), {
        status: "completed",
        updatedAt: serverTimestamp(),
      });

      const idToken = await user.getIdToken();
      const result = await submitReportAction(reportRef.id, idToken);
      if (result.ok) {
        toast.success("הדוח נשלח ונשלח מייל ללקוח");
      } else {
        toast.warning(`הדוח נשמר אך שליחת המייל נכשלה: ${result.error}`);
      }

      router.replace("/officer/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שליחת הדוח נכשלה");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-xl font-bold">דוח ביקורת</h1>

      <Card>
        <CardHeader>
          <CardTitle>סיכום ביקורת</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="תיאור כללי של הביקורת..."
            className="min-h-32"
          />
        </CardContent>
      </Card>

      {client?.industrySector && (
        <Card>
          <CardHeader>
            <CardTitle>שאלון בטיחות לפי תחום עיסוק</CardTitle>
          </CardHeader>
          <CardContent>
            <SafetyChecklist
              industrySector={client.industrySector}
              results={checklist}
              onStatusChange={handleChecklistStatus}
              onNoteChange={handleChecklistNote}
              onCreateHazard={handleCreateHazardFromChecklist}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>מפגעים</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => addHazard()}>
            <PlusIcon data-icon="inline-start" />
            הוספת מפגע
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {hazards.length === 0 && (
            <p className="text-sm text-muted-foreground">לא נרשמו מפגעים</p>
          )}
          {hazards.map((hazard) => (
            <div key={hazard.key} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label>תיאור המפגע</Label>
                  <Textarea
                    value={hazard.description}
                    onChange={(e) => updateHazard(hazard.key, { description: e.target.value })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeHazard(hazard.key)}
                >
                  <Trash2Icon className="text-destructive" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>חומרה</Label>
                  <Select
                    value={hazard.severity}
                    onValueChange={(value) =>
                      updateHazard(hazard.key, { severity: value as HazardSeverity })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(HAZARD_SEVERITY_LABELS) as HazardSeverity[]).map((sev) => (
                        <SelectItem key={sev} value={sev}>
                          {HAZARD_SEVERITY_LABELS[sev]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>קטגוריה</Label>
                  <Select
                    value={hazard.category}
                    onValueChange={(value) =>
                      updateHazard(hazard.key, { category: (value ?? "") as SafetyCategory | "" })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="בחירת קטגוריה" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {SAFETY_CATEGORY_LABELS[category]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>תאריך יעד לתיקון</Label>
                <Input
                  type="date"
                  value={hazard.dueDate}
                  onChange={(e) => updateHazard(hazard.key, { dueDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>תמונה</Label>
                <Input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    updateHazard(hazard.key, {
                      photo: file,
                      photoPreview: file ? URL.createObjectURL(file) : null,
                    });
                  }}
                />
                {hazard.photoPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={hazard.photoPreview}
                    alt=""
                    className="h-24 w-24 rounded-lg object-cover"
                  />
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>חתימת לקוח</CardTitle>
        </CardHeader>
        <CardContent>
          <SignaturePad ref={signatureRef} />
        </CardContent>
      </Card>

      <Button onClick={handleSubmit} disabled={submitting} className="w-full">
        {submitting ? "שולח..." : "שליחת דוח"}
      </Button>
    </div>
  );
}
