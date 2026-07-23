"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { addDays } from "date-fns";
import { KeyRoundIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CertStatusBadge } from "@/components/cert-status-badge";
import { db, functions, storage } from "@/lib/firebase";
import {
  CertificateDoc,
  ClientDoc,
  SCHEDULE_CHANGE_TYPE_LABELS,
  ScheduleChangeRequestDoc,
  ScheduleDoc,
  UserDoc,
  UserRole,
} from "@/lib/types";

type UserRow = UserDoc & { id: string };
type CertRow = CertificateDoc & { id: string };
type ClientRow = ClientDoc & { id: string };
type ScheduleRow = ScheduleDoc & { id: string };
type RequestRow = ScheduleChangeRequestDoc & { id: string };

const CERT_FORM_EMPTY = { certType: "", issueDate: "", expirationDate: "" };

export default function OfficersPage() {
  const [officers, setOfficers] = useState<UserRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [todaySchedules, setTodaySchedules] = useState<ScheduleRow[]>([]);
  const [selected, setSelected] = useState<UserRow | null>(null);

  const [profileForm, setProfileForm] = useState({
    fullName: "",
    role: "safety_officer" as UserRole,
    phone: "",
    region: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const [certs, setCerts] = useState<CertRow[]>([]);
  const [certForm, setCertForm] = useState(CERT_FORM_EMPTY);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [uploadingCert, setUploadingCert] = useState(false);

  const [upcomingSchedules, setUpcomingSchedules] = useState<ScheduleRow[]>([]);
  const [pendingRequests, setPendingRequests] = useState<RequestRow[]>([]);
  const [togglingActive, setTogglingActive] = useState(false);
  const [resettingPermissions, setResettingPermissions] = useState(false);

  useEffect(() => {
    return onSnapshot(
      query(collection(db, "users"), where("role", "==", "safety_officer"), orderBy("fullName")),
      (snapshot) => setOfficers(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as UserDoc) })))
    );
  }, []);

  useEffect(() => {
    return onSnapshot(query(collection(db, "clients"), orderBy("companyName")), (snapshot) => {
      setClients(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as ClientDoc) })));
    });
  }, []);

  useEffect(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const q = query(
      collection(db, "schedules"),
      where("scheduledDate", ">=", Timestamp.fromDate(todayStart)),
      where("scheduledDate", "<", Timestamp.fromDate(addDays(todayStart, 1)))
    );
    return onSnapshot(q, (snapshot) => {
      setTodaySchedules(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as ScheduleDoc) })));
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    const q = query(collection(db, "certificates"), where("userId", "==", selected.id));
    return onSnapshot(q, (snapshot) => {
      setCerts(
        snapshot.docs
          .map((d) => ({ id: d.id, ...(d.data() as CertificateDoc) }))
          .sort((a, b) => a.expirationDate.toMillis() - b.expirationDate.toMillis())
      );
    });
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const q = query(
      collection(db, "schedules"),
      where("userId", "==", selected.id),
      where("scheduledDate", ">=", Timestamp.fromDate(todayStart)),
      orderBy("scheduledDate")
    );
    return onSnapshot(q, (snapshot) => {
      setUpcomingSchedules(
        snapshot.docs
          .map((d) => ({ id: d.id, ...(d.data() as ScheduleDoc) }))
          .filter((s) => s.status === "scheduled")
      );
    });
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    return onSnapshot(
      query(collection(db, "scheduleChangeRequests"), where("userId", "==", selected.id)),
      (snapshot) => {
        setPendingRequests(
          snapshot.docs
            .map((d) => ({ id: d.id, ...(d.data() as ScheduleChangeRequestDoc) }))
            .filter((r) => r.status === "PENDING_ADMIN_APPROVAL")
        );
      }
    );
  }, [selected]);

  const clientNameById = useMemo(() => new Map(clients.map((c) => [c.id, c.companyName])), [clients]);

  const assignedClientsByOfficer = useMemo(() => {
    const map = new Map<string, ClientRow[]>();
    for (const client of clients) {
      const officerIds = new Set(client.assignedOfficerIds ?? []);
      if (client.assignedOfficerId) officerIds.add(client.assignedOfficerId);
      for (const officerId of officerIds) {
        map.set(officerId, [...(map.get(officerId) ?? []), client]);
      }
    }
    return map;
  }, [clients]);

  const todayStatusByOfficer = useMemo(() => {
    const map = new Map<string, "on_site" | "scheduled">();
    for (const s of todaySchedules) {
      if (s.status !== "scheduled") continue;
      if (s.checkedInAt) map.set(s.userId, "on_site");
      else if (!map.has(s.userId)) map.set(s.userId, "scheduled");
    }
    return map;
  }, [todaySchedules]);

  function closeDialog() {
    setSelected(null);
    setCerts([]);
    setUpcomingSchedules([]);
    setPendingRequests([]);
  }

  function openOfficer(officer: UserRow) {
    setSelected(officer);
    setProfileForm({
      fullName: officer.fullName,
      role: officer.role,
      phone: officer.phone ?? "",
      region: officer.region ?? "",
    });
    setCertForm(CERT_FORM_EMPTY);
    setCertFile(null);
  }

  async function handleSaveProfile(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSavingProfile(true);
    try {
      await updateDoc(doc(db, "users", selected.id), {
        ...profileForm,
        updatedAt: serverTimestamp(),
      });
      toast.success("הפרופיל עודכן");
      closeDialog();
    } catch {
      toast.error("עדכון הפרופיל נכשל");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAddCert(event: FormEvent) {
    event.preventDefault();
    if (!selected || !certForm.certType || !certForm.issueDate || !certForm.expirationDate) return;
    setUploadingCert(true);
    try {
      let documentUrl: string | undefined;
      if (certFile) {
        const fileRef = ref(storage, `certificates/${selected.id}/${Date.now()}-${certFile.name}`);
        await uploadBytes(fileRef, certFile);
        documentUrl = await getDownloadURL(fileRef);
      }
      await addDoc(collection(db, "certificates"), {
        userId: selected.id,
        certType: certForm.certType,
        issueDate: Timestamp.fromDate(new Date(certForm.issueDate)),
        expirationDate: Timestamp.fromDate(new Date(certForm.expirationDate)),
        ...(documentUrl ? { documentUrl } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success("התעודה נוספה");
      setCertForm(CERT_FORM_EMPTY);
      setCertFile(null);
    } catch {
      toast.error("הוספת התעודה נכשלה");
    } finally {
      setUploadingCert(false);
    }
  }

  async function handleDeleteCert(cert: CertRow) {
    if (!confirm(`למחוק את התעודה ${cert.certType}?`)) return;
    try {
      await deleteDoc(doc(db, "certificates", cert.id));
      toast.success("התעודה נמחקה");
    } catch {
      toast.error("מחיקת התעודה נכשלה");
    }
  }

  async function handleToggleActive() {
    if (!selected) return;
    setTogglingActive(true);
    try {
      const nextActive = selected.active === false;
      await updateDoc(doc(db, "users", selected.id), {
        active: nextActive,
        updatedAt: serverTimestamp(),
      });
      setSelected({ ...selected, active: nextActive });
      toast.success(nextActive ? "העובד הופעל" : "העובד הושבת");
    } catch {
      toast.error("העדכון נכשל");
    } finally {
      setTogglingActive(false);
    }
  }

  async function handleResetPermissions() {
    if (!selected) return;
    setResettingPermissions(true);
    try {
      const revokeOfficerSessions = httpsCallable(functions, "revokeOfficerSessions");
      await revokeOfficerSessions({ userId: selected.id });
      toast.success("ההרשאות אופסו - העובד יידרש להתחבר מחדש");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "איפוס ההרשאות נכשל");
    } finally {
      setResettingPermissions(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">ממוני בטיחות</h1>
        <p className="text-sm text-muted-foreground">
          עובדים חדשים נרשמים בעצמם במסך ההתחברות; כאן ניתן לנהל פרטים, שיבוצים, תעודות והרשאות.
        </p>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם מלא</TableHead>
              <TableHead>טלפון</TableHead>
              <TableHead>לקוחות משויכים</TableHead>
              <TableHead>סטטוס תעודה</TableHead>
              <TableHead>סטטוס היום</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {officers.map((officer) => {
              const assignedClients = assignedClientsByOfficer.get(officer.id) ?? [];
              const todayStatus = todayStatusByOfficer.get(officer.id);
              return (
                <TableRow
                  key={officer.id}
                  className="cursor-pointer"
                  onClick={() => openOfficer(officer)}
                >
                  <TableCell className="font-medium">
                    {officer.fullName}
                    {officer.active === false && (
                      <Badge variant="outline" className="mr-2">
                        לא פעיל
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell dir="ltr" className="text-start">
                    {officer.phone || "—"}
                  </TableCell>
                  <TableCell>
                    {assignedClients.length > 0
                      ? assignedClients.map((c) => c.companyName).join(", ")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <CertStatusBadge status={officer.certStatus} />
                  </TableCell>
                  <TableCell>
                    {todayStatus === "on_site" && (
                      <Badge className="bg-emerald-50 text-emerald-700">בשטח</Badge>
                    )}
                    {todayStatus === "scheduled" && <Badge variant="outline">משובץ היום</Badge>}
                    {!todayStatus && <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              );
            })}
            {officers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  אין ממוני בטיחות עדיין
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {selected && (
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle>{selected.fullName}</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSaveProfile} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">שם מלא</Label>
                  <Input
                    id="fullName"
                    required
                    value={profileForm.fullName}
                    onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>תפקיד</Label>
                  <Select
                    value={profileForm.role}
                    onValueChange={(value) => setProfileForm({ ...profileForm, role: value as UserRole })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="safety_officer">ממונה בטיחות</SelectItem>
                      <SelectItem value="admin">מנהל</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">טלפון</Label>
                  <Input
                    id="phone"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="region">אזור</Label>
                  <Input
                    id="region"
                    value={profileForm.region}
                    onChange={(e) => setProfileForm({ ...profileForm, region: e.target.value })}
                  />
                </div>
                <Button type="submit" disabled={savingProfile} className="w-full">
                  {savingProfile ? "שומר..." : "שמירת פרטים"}
                </Button>
              </form>

              <div className="space-y-2 border-t pt-4">
                <h3 className="font-medium">לקוחות ואתרים משויכים</h3>
                <div className="flex flex-wrap gap-1.5">
                  {(assignedClientsByOfficer.get(selected.id) ?? []).map((client) => (
                    <Badge key={client.id} variant="outline">
                      {client.companyName}
                    </Badge>
                  ))}
                  {(assignedClientsByOfficer.get(selected.id) ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">לא משויך ללקוחות</p>
                  )}
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <h3 className="font-medium">לוח זמנים אישי</h3>
                <div className="space-y-1.5">
                  {upcomingSchedules.slice(0, 5).map((s) => (
                    <div key={s.id} className="flex justify-between text-sm">
                      <span>{clientNameById.get(s.clientId) ?? s.clientId}</span>
                      <span className="text-muted-foreground">
                        {s.scheduledDate.toDate().toLocaleDateString("he-IL")}
                      </span>
                    </div>
                  ))}
                  {upcomingSchedules.length === 0 && (
                    <p className="text-sm text-muted-foreground">אין ביקורים קרובים</p>
                  )}
                </div>
                {pendingRequests.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <p className="text-xs font-medium text-muted-foreground">בקשות ממתינות</p>
                    {pendingRequests.map((r) => (
                      <div key={r.id} className="flex justify-between text-sm">
                        <span>{SCHEDULE_CHANGE_TYPE_LABELS[r.type]}</span>
                        <span className="text-muted-foreground">{r.note}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3 border-t pt-4">
                <h3 className="font-medium">תעודות</h3>
                <div className="space-y-2">
                  {certs.map((cert) => (
                    <div
                      key={cert.id}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                    >
                      <div>
                        <div className="font-medium">{cert.certType}</div>
                        <div className="text-muted-foreground">
                          בתוקף עד {cert.expirationDate.toDate().toLocaleDateString("he-IL")}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {cert.documentUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            render={<a href={cert.documentUrl} target="_blank" rel="noreferrer" />}
                          >
                            צפייה
                          </Button>
                        )}
                        <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteCert(cert)}>
                          <Trash2Icon className="text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {certs.length === 0 && <p className="text-sm text-muted-foreground">אין תעודות רשומות</p>}
                </div>

                <form onSubmit={handleAddCert} className="space-y-2 rounded-lg border p-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="certType">סוג תעודה</Label>
                    <Input
                      id="certType"
                      required
                      value={certForm.certType}
                      onChange={(e) => setCertForm({ ...certForm, certType: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="issueDate">תאריך הנפקה</Label>
                      <Input
                        id="issueDate"
                        type="date"
                        required
                        value={certForm.issueDate}
                        onChange={(e) => setCertForm({ ...certForm, issueDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="expirationDate">תאריך תפוגה</Label>
                      <Input
                        id="expirationDate"
                        type="date"
                        required
                        value={certForm.expirationDate}
                        onChange={(e) => setCertForm({ ...certForm, expirationDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="certFile">קובץ תעודה (תמונה או PDF)</Label>
                    <Input
                      id="certFile"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                  <Button type="submit" disabled={uploadingCert} className="w-full">
                    <UploadIcon data-icon="inline-start" />
                    {uploadingCert ? "מעלה..." : "הוספת תעודה"}
                  </Button>
                </form>
              </div>

              <div className="space-y-2 border-t pt-4">
                <h3 className="font-medium">בקרות מהירות</h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={togglingActive}
                    onClick={handleToggleActive}
                  >
                    {selected.active === false ? "הפעלת עובד" : "השבתת עובד"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={resettingPermissions}
                    onClick={handleResetPermissions}
                  >
                    <KeyRoundIcon data-icon="inline-start" />
                    איפוס הרשאות
                  </Button>
                </div>
              </div>

              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>סגירה</DialogClose>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
