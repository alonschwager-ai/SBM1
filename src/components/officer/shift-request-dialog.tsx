"use client";

import { FormEvent, useState } from "react";
import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { ScheduleChangeRequestType, ScheduleDoc } from "@/lib/types";

export interface ShiftRequestTarget {
  schedule: ScheduleDoc & { id: string };
  clientName: string;
}

const TYPE_OPTIONS: { value: ScheduleChangeRequestType; label: string }[] = [
  { value: "reschedule", label: "הזזת תאריך" },
  { value: "swap", label: "החלפה עם עמית" },
  { value: "absence", label: "היעדרות" },
];

export function ShiftRequestDialog({
  target,
  onClose,
}: {
  target: ShiftRequestTarget | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>{target && <ShiftRequestForm target={target} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function ShiftRequestForm({
  target,
  onClose,
}: {
  target: ShiftRequestTarget;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [type, setType] = useState<ScheduleChangeRequestType>("reschedule");
  const [note, setNote] = useState("");
  const [requestedDate, setRequestedDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    if (type === "reschedule" && !requestedDate) {
      toast.error("יש לבחור תאריך מבוקש");
      return;
    }
    if (!note.trim()) {
      toast.error("יש להוסיף הערה קצרה");
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, "scheduleChangeRequests"), {
        scheduleId: target.schedule.id,
        userId: user.uid,
        clientId: target.schedule.clientId,
        scheduledDate: target.schedule.scheduledDate,
        type,
        note: note.trim(),
        requestedDate:
          type === "reschedule" ? Timestamp.fromDate(new Date(requestedDate)) : null,
        status: "PENDING_ADMIN_APPROVAL",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success("הבקשה נשלחה לאישור מנהל");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שליחת הבקשה נכשלה");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>בקשת שינוי שיבוץ</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="rounded-lg bg-muted p-3 text-sm">
          <div className="font-medium">{target.clientName}</div>
          <div className="text-muted-foreground">
            {target.schedule.scheduledDate.toDate().toLocaleDateString("he-IL")}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>סוג הבקשה</Label>
          <Select value={type} onValueChange={(value) => setType(value as ScheduleChangeRequestType)}>
            <SelectTrigger className="w-full min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {type === "reschedule" && (
          <div className="space-y-1.5">
            <Label htmlFor="requestedDate">תאריך מבוקש</Label>
            <Input
              id="requestedDate"
              type="date"
              className="min-h-11"
              value={requestedDate}
              onChange={(e) => setRequestedDate(e.target.value)}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="note">
            {type === "swap" ? "עם מי להחליף ולמה" : "הערה"}
          </Label>
          <Textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              type === "swap"
                ? "לדוגמה: החלפה עם דנה כהן בשל אירוע משפחתי"
                : "פירוט קצר לבקשה..."
            }
          />
        </div>
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" className="min-h-11" />}>
          ביטול
        </DialogClose>
        <Button type="submit" disabled={submitting} className="min-h-11">
          {submitting ? "שולח..." : "שליחת בקשה"}
        </Button>
      </DialogFooter>
    </form>
  );
}
