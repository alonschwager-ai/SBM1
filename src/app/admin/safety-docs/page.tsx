"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { PlusIcon, Trash2Icon } from "lucide-react";
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
import { db, storage } from "@/lib/firebase";
import { INDUSTRY_SECTOR_LABELS, IndustrySector, SafetyDocDoc } from "@/lib/types";

type SafetyDocRow = SafetyDocDoc & { id: string };

const FIRST_SECTOR = Object.keys(INDUSTRY_SECTOR_LABELS)[0] as IndustrySector;
const EMPTY_FORM = { title: "", sector: FIRST_SECTOR };

export default function SafetyDocsPage() {
  const [docs, setDocs] = useState<SafetyDocRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SafetyDocRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    return onSnapshot(query(collection(db, "safetyDocs"), orderBy("title")), (snapshot) => {
      setDocs(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as SafetyDocDoc) })));
    });
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFile(null);
    setDialogOpen(true);
  }

  function openEdit(safetyDoc: SafetyDocRow) {
    setEditing(safetyDoc);
    setForm({ title: safetyDoc.title, sector: safetyDoc.sector });
    setFile(null);
    setDialogOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      let docId = editing?.id;
      if (editing) {
        await updateDoc(doc(db, "safetyDocs", editing.id), {
          ...form,
          updatedAt: serverTimestamp(),
        });
      } else {
        const newDoc = await addDoc(collection(db, "safetyDocs"), {
          ...form,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        docId = newDoc.id;
      }

      if (file && docId) {
        const fileRef = ref(storage, `safety-docs/${docId}/${Date.now()}-${file.name}`);
        await uploadBytes(fileRef, file);
        const fileUrl = await getDownloadURL(fileRef);
        await updateDoc(doc(db, "safetyDocs", docId), { fileUrl });
      }

      toast.success(editing ? "המסמך עודכן" : "המסמך נוצר");
      setDialogOpen(false);
    } catch {
      toast.error("שמירת המסמך נכשלה");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(safetyDoc: SafetyDocRow) {
    if (!confirm(`למחוק את "${safetyDoc.title}"?`)) return;
    try {
      await deleteDoc(doc(db, "safetyDocs", safetyDoc.id));
      toast.success("המסמך נמחק");
    } catch {
      toast.error("מחיקת המסמך נכשלה");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">מסמכי בטיחות</h1>
          <p className="text-sm text-muted-foreground">
            הנחיות ותקנות המוצגות לממונים ב״ארגז הכלים״ לפי תחום העיסוק של הלקוח.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button onClick={openCreate} />}>
            <PlusIcon data-icon="inline-start" />
            מסמך חדש
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{editing ? "עריכת מסמך" : "מסמך חדש"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="title">כותרת</Label>
                  <Input
                    id="title"
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>תחום עיסוק</Label>
                  <Select
                    value={form.sector}
                    onValueChange={(value) =>
                      setForm({ ...form, sector: (value ?? FIRST_SECTOR) as IndustrySector })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(INDUSTRY_SECTOR_LABELS) as IndustrySector[]).map((sector) => (
                        <SelectItem key={sector} value={sector}>
                          {INDUSTRY_SECTOR_LABELS[sector]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="file">קובץ PDF</Label>
                  <Input
                    id="file"
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  {editing?.fileUrl && !file && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      render={<a href={editing.fileUrl} target="_blank" rel="noreferrer" />}
                    >
                      צפייה בקובץ הקיים
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
              <TableHead>כותרת</TableHead>
              <TableHead>תחום עיסוק</TableHead>
              <TableHead>קובץ</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((safetyDoc) => (
              <TableRow key={safetyDoc.id} className="cursor-pointer" onClick={() => openEdit(safetyDoc)}>
                <TableCell className="font-medium">{safetyDoc.title}</TableCell>
                <TableCell>
                  <Badge>{INDUSTRY_SECTOR_LABELS[safetyDoc.sector]}</Badge>
                </TableCell>
                <TableCell>
                  {safetyDoc.fileUrl ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                      הועלה
                    </Badge>
                  ) : (
                    <Badge variant="outline">לא הועלה</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(safetyDoc);
                    }}
                  >
                    <Trash2Icon className="text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {docs.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  אין מסמכים עדיין
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
