"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import Link from "next/link";
import { ExternalLinkIcon, PlusIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CERTIFICATION_TYPES } from "@/lib/constants/certificationTypes";
import { db, storage } from "@/lib/firebase";
import { ClientDoc, INDUSTRY_SECTOR_LABELS, IndustrySector, UserDoc } from "@/lib/types";
import { cn } from "@/lib/utils";

type ClientRow = ClientDoc & { id: string };
type OfficerOption = UserDoc & { id: string };

const NO_OFFICER = "none";
const NO_SECTOR = "none";

const EMPTY_FORM = {
  companyName: "",
  contactPerson: "",
  contactEmail: "",
  phone: "",
  address: "",
  region: "",
  assignedOfficerId: NO_OFFICER,
  clientSafetyContactName: "",
  clientSafetyContactPhone: "",
  googleMapsUrl: "",
  weeklyDaysCount: "",
  industrySector: NO_SECTOR,
  requiredCertTypes: [] as string[],
};

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [officers, setOfficers] = useState<OfficerOption[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "clients"), orderBy("companyName"));
    return onSnapshot(q, (snapshot) => {
      setClients(
        snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as ClientDoc) }))
      );
    });
  }, []);

  useEffect(() => {
    return onSnapshot(
      query(collection(db, "users"), where("role", "==", "safety_officer"), orderBy("fullName")),
      (snapshot) =>
        setOfficers(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as UserDoc) })))
    );
  }, []);

  function toggleFormCert(type: string) {
    setForm((prev) => ({
      ...prev,
      requiredCertTypes: prev.requiredCertTypes.includes(type)
        ? prev.requiredCertTypes.filter((c) => c !== type)
        : [...prev.requiredCertTypes, type],
    }));
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setContractFile(null);
    setDialogOpen(true);
  }

  function openEdit(client: ClientRow) {
    setEditing(client);
    setForm({
      companyName: client.companyName,
      contactPerson: client.contactPerson ?? "",
      contactEmail: client.contactEmail ?? "",
      phone: client.phone ?? "",
      address: client.address ?? "",
      region: client.region ?? "",
      assignedOfficerId: client.assignedOfficerId ?? NO_OFFICER,
      clientSafetyContactName: client.clientSafetyContactName ?? "",
      clientSafetyContactPhone: client.clientSafetyContactPhone ?? "",
      googleMapsUrl: client.googleMapsUrl ?? "",
      weeklyDaysCount: client.weeklyDaysCount ? String(client.weeklyDaysCount) : "",
      industrySector: client.industrySector ?? NO_SECTOR,
      requiredCertTypes: client.requiredCertTypes ?? [],
    });
    setContractFile(null);
    setDialogOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const { assignedOfficerId, weeklyDaysCount, industrySector, ...rest } = form;

      let clientId = editing?.id;
      if (editing) {
        // deleteField() is only legal against an existing document - clears
        // the field when the admin unset it, rather than writing "".
        await updateDoc(doc(db, "clients", editing.id), {
          ...rest,
          assignedOfficerId: assignedOfficerId === NO_OFFICER ? deleteField() : assignedOfficerId,
          weeklyDaysCount: weeklyDaysCount ? Number(weeklyDaysCount) : deleteField(),
          industrySector: industrySector === NO_SECTOR ? deleteField() : industrySector,
          updatedAt: serverTimestamp(),
        });
        toast.success("הלקוח עודכן");
      } else {
        const newDoc = await addDoc(collection(db, "clients"), {
          ...rest,
          ...(assignedOfficerId !== NO_OFFICER ? { assignedOfficerId } : {}),
          ...(weeklyDaysCount ? { weeklyDaysCount: Number(weeklyDaysCount) } : {}),
          ...(industrySector !== NO_SECTOR ? { industrySector } : {}),
          assignedOfficerIds: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        clientId = newDoc.id;
        toast.success("הלקוח נוצר");
      }

      if (contractFile && clientId) {
        const fileRef = ref(storage, `contracts/${clientId}/${Date.now()}-${contractFile.name}`);
        await uploadBytes(fileRef, contractFile);
        const contractDocUrl = await getDownloadURL(fileRef);
        await updateDoc(doc(db, "clients", clientId), { contractDocUrl });
      }

      setDialogOpen(false);
    } catch {
      toast.error("שמירת הלקוח נכשלה");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(client: ClientRow) {
    if (!confirm(`למחוק את ${client.companyName}?`)) return;
    try {
      await deleteDoc(doc(db, "clients", client.id));
      toast.success("הלקוח נמחק");
    } catch {
      toast.error("מחיקת הלקוח נכשלה");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">לקוחות</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button onClick={openCreate} />}>
            <PlusIcon data-icon="inline-start" />
            לקוח חדש
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <form onSubmit={handleSubmit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{editing ? "עריכת לקוח" : "לקוח חדש"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="companyName">שם החברה</Label>
                  <Input
                    id="companyName"
                    required
                    value={form.companyName}
                    onChange={(e) =>
                      setForm({ ...form, companyName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contactPerson">איש קשר ראשי</Label>
                  <Input
                    id="contactPerson"
                    value={form.contactPerson}
                    onChange={(e) =>
                      setForm({ ...form, contactPerson: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contactEmail">אימייל איש קשר</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) =>
                      setForm({ ...form, contactEmail: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">טלפון ראשי</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
                  <div className="col-span-2 text-xs font-medium text-muted-foreground">
                    איש קשר לבטיחות אצל הלקוח
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="clientSafetyContactName">שם</Label>
                    <Input
                      id="clientSafetyContactName"
                      value={form.clientSafetyContactName}
                      onChange={(e) =>
                        setForm({ ...form, clientSafetyContactName: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="clientSafetyContactPhone">טלפון</Label>
                    <Input
                      id="clientSafetyContactPhone"
                      value={form.clientSafetyContactPhone}
                      onChange={(e) =>
                        setForm({ ...form, clientSafetyContactPhone: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="address">כתובת</Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="googleMapsUrl">קישור Google Maps</Label>
                  <Input
                    id="googleMapsUrl"
                    type="url"
                    placeholder="https://maps.google.com/..."
                    value={form.googleMapsUrl}
                    onChange={(e) => setForm({ ...form, googleMapsUrl: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="region">אזור</Label>
                  <Input
                    id="region"
                    value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label>תחום עיסוק</Label>
                    <Select
                      value={form.industrySector}
                      onValueChange={(value) =>
                        setForm({ ...form, industrySector: value ?? NO_SECTOR })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_SECTOR}>לא נבחר</SelectItem>
                        {(Object.keys(INDUSTRY_SECTOR_LABELS) as IndustrySector[]).map((sector) => (
                          <SelectItem key={sector} value={sector}>
                            {INDUSTRY_SECTOR_LABELS[sector]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="weeklyDaysCount">ימי עבודה בשבוע</Label>
                    <Input
                      id="weeklyDaysCount"
                      type="number"
                      min={0}
                      max={7}
                      value={form.weeklyDaysCount}
                      onChange={(e) => setForm({ ...form, weeklyDaysCount: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>תעודות נדרשות לממונה</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {CERTIFICATION_TYPES.map((type) => {
                      const active = form.requiredCertTypes.includes(type);
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => toggleFormCert(type)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium transition",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:bg-muted"
                          )}
                        >
                          {type}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>ממונה בטיחות קבוע</Label>
                  <Select
                    value={form.assignedOfficerId}
                    onValueChange={(value) =>
                      setForm({ ...form, assignedOfficerId: value ?? NO_OFFICER })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_OFFICER}>ללא שיוך קבוע</SelectItem>
                      {officers.map((officer) => (
                        <SelectItem key={officer.id} value={officer.id}>
                          {officer.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="contractFile">חוזה חתום (למנהל בלבד)</Label>
                  <Input
                    id="contractFile"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setContractFile(e.target.files?.[0] ?? null)}
                  />
                  {editing?.contractDocUrl && !contractFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      render={<a href={editing.contractDocUrl} target="_blank" rel="noreferrer" />}
                    >
                      <UploadIcon data-icon="inline-start" />
                      צפייה בחוזה הקיים
                    </Button>
                  )}
                </div>
              </div>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>
                  ביטול
                </DialogClose>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "שומר..." : "שמירה"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>חברה</TableHead>
              <TableHead>איש קשר</TableHead>
              <TableHead>טלפון</TableHead>
              <TableHead>אזור</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow
                key={client.id}
                className="cursor-pointer"
                onClick={() => openEdit(client)}
              >
                <TableCell className="font-medium">{client.companyName}</TableCell>
                <TableCell>{client.contactPerson || "—"}</TableCell>
                <TableCell>{client.phone || "—"}</TableCell>
                <TableCell>{client.region || "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => e.stopPropagation()}
                      render={<Link href={`/admin/clients/${client.id}`} />}
                    >
                      <ExternalLinkIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(client);
                      }}
                    >
                      <Trash2Icon className="text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  אין לקוחות עדיין
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
