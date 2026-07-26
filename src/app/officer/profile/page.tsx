"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { PencilIcon, PlusIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { CertStatusBadge } from "@/components/cert-status-badge";
import { useAuth } from "@/lib/auth-context";
import { CERTIFICATION_TYPES, OTHER_CERTIFICATION } from "@/lib/constants/certificationTypes";
import { db, storage } from "@/lib/firebase";
import { CERT_EXPIRY_WARNING_DAYS, CertificateDoc, UserDoc } from "@/lib/types";

type CertRow = CertificateDoc & { id: string };

const CERT_FORM_EMPTY = { certType: "", customCertType: "", issueDate: "", expirationDate: "" };

export default function OfficerProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserDoc | null>(null);
  const [profileForm, setProfileForm] = useState({ fullName: "", phone: "", region: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  const [certs, setCerts] = useState<CertRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CertRow | null>(null);
  const [certForm, setCertForm] = useState(CERT_FORM_EMPTY);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "users", user.uid), (snap) => {
      const data = snap.data() as UserDoc | undefined;
      if (!data) return;
      setProfile(data);
      setProfileForm({
        fullName: data.fullName,
        phone: data.phone ?? "",
        region: data.region ?? "",
      });
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db, "certificates"), where("userId", "==", user.uid)),
      (snapshot) => {
        setCerts(
          snapshot.docs
            .map((d) => ({ id: d.id, ...(d.data() as CertificateDoc) }))
            .sort((a, b) => a.expirationDate.toMillis() - b.expirationDate.toMillis())
        );
      }
    );
    // orderBy would need a composite index for userId+expirationDate that
    // already exists, but sorting client-side avoids depending on it here.
  }, [user]);

  async function handleSaveProfile(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        ...profileForm,
        updatedAt: serverTimestamp(),
      });
      toast.success("הפרופיל עודכן");
    } catch {
      toast.error("עדכון הפרופיל נכשל");
    } finally {
      setSavingProfile(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setCertForm(CERT_FORM_EMPTY);
    setCertFile(null);
    setDialogOpen(true);
  }

  function openEdit(cert: CertRow) {
    const isPreset = (CERTIFICATION_TYPES as readonly string[]).includes(cert.certType);
    setEditing(cert);
    setCertForm({
      certType: isPreset ? cert.certType : OTHER_CERTIFICATION,
      customCertType: isPreset ? "" : cert.certType,
      issueDate: cert.issueDate.toDate().toISOString().slice(0, 10),
      expirationDate: cert.expirationDate.toDate().toISOString().slice(0, 10),
    });
    setCertFile(null);
    setDialogOpen(true);
  }

  async function handleSaveCert(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    const resolvedCertType =
      certForm.certType === OTHER_CERTIFICATION ? certForm.customCertType.trim() : certForm.certType;
    if (!resolvedCertType || !certForm.issueDate || !certForm.expirationDate) return;

    setSaving(true);
    try {
      let documentUrl: string | undefined;
      if (certFile) {
        const fileRef = ref(storage, `certificates/${user.uid}/${Date.now()}-${certFile.name}`);
        await uploadBytes(fileRef, certFile);
        documentUrl = await getDownloadURL(fileRef);
      }

      const data = {
        certType: resolvedCertType,
        issueDate: Timestamp.fromDate(new Date(certForm.issueDate)),
        expirationDate: Timestamp.fromDate(new Date(certForm.expirationDate)),
        ...(documentUrl ? { documentUrl } : {}),
      };

      if (editing) {
        await updateDoc(doc(db, "certificates", editing.id), {
          ...data,
          updatedAt: serverTimestamp(),
        });
        toast.success("התעודה עודכנה");
      } else {
        await addDoc(collection(db, "certificates"), {
          userId: user.uid,
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        toast.success("התעודה נוספה");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שמירת התעודה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  function certStatusClass(cert: CertRow): string {
    // certs (and therefore every call to this function) only ever exist
    // once the onSnapshot effect above has populated them - i.e. never
    // during SSR or the initial client hydration render - so reading the
    // current time here doesn't risk a hydration mismatch. Timestamp.now()
    // rather than Date.now() also keeps this consistent with the same
    // now-at-render-time pattern already used in assign-schedule-dialog.tsx.
    const now = Timestamp.now().toMillis();
    const warningCutoff = now + CERT_EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000;
    const expiration = cert.expirationDate.toMillis();
    if (expiration < now) return "text-destructive";
    if (expiration < warningCutoff) return "text-amber-600";
    return "text-muted-foreground";
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <h1 className="text-xl font-bold">הפרופיל שלי</h1>

      <Card>
        <CardHeader>
          <CardTitle>פרטים אישיים</CardTitle>
        </CardHeader>
        <CardContent>
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
            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <span>אימייל: {user?.email}</span>
              <span>תפקיד: ממונה בטיחות</span>
            </div>
            <Button type="submit" disabled={savingProfile} className="min-h-11 w-full">
              {savingProfile ? "שומר..." : "שמירת פרטים"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>התעודות שלי</CardTitle>
            {profile && <CertStatusBadge status={profile.certStatus} />}
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button size="sm" onClick={openCreate} />}>
              <PlusIcon data-icon="inline-start" />
              הוספה
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSaveCert} className="space-y-4">
                <DialogHeader>
                  <DialogTitle>{editing ? "עריכת תעודה" : "תעודה חדשה"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>סוג תעודה</Label>
                    <Select
                      value={certForm.certType}
                      onValueChange={(value) => setCertForm({ ...certForm, certType: value ?? "" })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="בחירת סוג תעודה" />
                      </SelectTrigger>
                      <SelectContent>
                        {CERTIFICATION_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                        <SelectItem value={OTHER_CERTIFICATION}>אחר (הזנה חופשית)</SelectItem>
                      </SelectContent>
                    </Select>
                    {certForm.certType === OTHER_CERTIFICATION && (
                      <Input
                        placeholder="סוג תעודה מותאם אישית"
                        required
                        value={certForm.customCertType}
                        onChange={(e) => setCertForm({ ...certForm, customCertType: e.target.value })}
                      />
                    )}
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
                    {editing?.documentUrl && !certFile && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        render={<a href={editing.documentUrl} target="_blank" rel="noreferrer" />}
                      >
                        <UploadIcon data-icon="inline-start" />
                        צפייה בקובץ הקיים
                      </Button>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose render={<Button type="button" variant="outline" className="min-h-11" />}>
                    ביטול
                  </DialogClose>
                  <Button type="submit" disabled={saving} className="min-h-11">
                    {saving ? "שומר..." : "שמירה"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-2">
          {certs.length === 0 && (
            <p className="text-sm text-muted-foreground">עדיין לא נוספו תעודות</p>
          )}
          {certs.map((cert) => (
            <button
              key={cert.id}
              type="button"
              onClick={() => openEdit(cert)}
              className="flex w-full min-h-11 items-center justify-between rounded-lg border px-3 py-2 text-start text-sm hover:bg-muted"
            >
              <div>
                <div className="font-medium">{cert.certType}</div>
                <div className={certStatusClass(cert)}>
                  בתוקף עד {cert.expirationDate.toDate().toLocaleDateString("he-IL")}
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                {cert.documentUrl && <Badge variant="outline">קובץ מצורף</Badge>}
                <PencilIcon className="size-4" />
              </span>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
