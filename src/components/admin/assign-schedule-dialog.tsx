"use client";

import { FormEvent, useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
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
import { CertStatusBadge } from "@/components/cert-status-badge";
import { db, functions } from "@/lib/firebase";
import { ClientDoc, UserDoc } from "@/lib/types";

type OfficerOption = UserDoc & { id: string };
type ClientOption = ClientDoc & { id: string };

export interface AssignScheduleTarget {
  scheduleId?: string;
  clientId?: string;
  date: string; // yyyy-mm-dd
  officerId?: string;
}

export function AssignScheduleDialog({
  target,
  onClose,
}: {
  target: AssignScheduleTarget | null;
  onClose: () => void;
}) {
  const [officers, setOfficers] = useState<OfficerOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);

  useEffect(() => {
    const unsubOfficers = onSnapshot(
      query(collection(db, "users"), where("role", "==", "safety_officer"), orderBy("fullName")),
      (snapshot) =>
        setOfficers(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as UserDoc) })))
    );
    const unsubClients = onSnapshot(
      query(collection(db, "clients"), orderBy("companyName")),
      (snapshot) =>
        setClients(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as ClientDoc) })))
    );
    return () => {
      unsubOfficers();
      unsubClients();
    };
  }, []);

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {target && (
          <AssignScheduleForm
            key={`${target.scheduleId ?? ""}-${target.clientId ?? ""}-${target.date}-${target.officerId ?? ""}`}
            target={target}
            officers={officers}
            clients={clients}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AssignScheduleForm({
  target,
  officers,
  clients,
  onClose,
}: {
  target: AssignScheduleTarget;
  officers: OfficerOption[];
  clients: ClientOption[];
  onClose: () => void;
}) {
  const [clientId, setClientId] = useState(target.clientId ?? "");
  const [officerId, setOfficerId] = useState(target.officerId ?? "");
  const [date, setDate] = useState(target.date);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!clientId || !officerId || !date) return;
    setSubmitting(true);
    try {
      const assignSchedule = httpsCallable(functions, "assignSchedule");
      await assignSchedule({
        scheduleId: target.scheduleId,
        userId: officerId,
        clientId,
        scheduledDate: new Date(date).toISOString(),
      });
      toast.success("השיבוץ נשמר");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "השיבוץ נכשל");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{target.scheduleId ? "עריכת שיבוץ" : "שיבוץ חדש"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>לקוח</Label>
          <Select value={clientId} onValueChange={(value) => setClientId(value ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="בחירת לקוח" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.companyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="assign-date">תאריך</Label>
          <Input
            id="assign-date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>ממונה בטיחות</Label>
          <Select value={officerId} onValueChange={(value) => setOfficerId(value ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="בחירת ממונה" />
            </SelectTrigger>
            <SelectContent>
              {officers.map((officer) => {
                const blocked =
                  officer.certStatus === "expired" || officer.certStatus === "expiring_soon";
                return (
                  <SelectItem key={officer.id} value={officer.id} disabled={blocked}>
                    <span className="flex items-center gap-2">
                      {officer.fullName}
                      <CertStatusBadge status={officer.certStatus} />
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            לא ניתן לשבץ ממונה עם תעודה שפגה או שתפוג תוך פחות מ-7 ימים.
          </p>
        </div>
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>ביטול</DialogClose>
        <Button type="submit" disabled={submitting || !clientId || !officerId || !date}>
          {submitting ? "משבץ..." : "שיבוץ"}
        </Button>
      </DialogFooter>
    </form>
  );
}
