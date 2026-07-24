"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { addDays, endOfWeek, startOfWeek } from "date-fns";
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
import { CertificateDoc, ClientDoc, ScheduleDoc, UserDoc } from "@/lib/types";
import { cn } from "@/lib/utils";

type OfficerOption = UserDoc & { id: string };
type ClientOption = ClientDoc & { id: string };
type CertRow = CertificateDoc & { id: string };
type ScheduleRow = ScheduleDoc & { id: string };

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
  const [certificates, setCertificates] = useState<CertRow[]>([]);

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
    const unsubCerts = onSnapshot(collection(db, "certificates"), (snapshot) =>
      setCertificates(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as CertificateDoc) })))
    );
    return () => {
      unsubOfficers();
      unsubClients();
      unsubCerts();
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
            certificates={certificates}
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
  certificates,
  onClose,
}: {
  target: AssignScheduleTarget;
  officers: OfficerOption[];
  clients: ClientOption[];
  certificates: CertRow[];
  onClose: () => void;
}) {
  const [clientId, setClientId] = useState(target.clientId ?? "");
  const [officerId, setOfficerId] = useState(target.officerId ?? "");
  const [date, setDate] = useState(target.date);
  const [submitting, setSubmitting] = useState(false);
  const [weekSchedules, setWeekSchedules] = useState<ScheduleRow[]>([]);

  const selectedClient = clients.find((c) => c.id === clientId);

  // Certificates held per officer that are not expired/expiring soon, used
  // for a client-side heads-up only - assignSchedule (Admin SDK) is the
  // authoritative enforcement of both this and the 7-day expiry rule.
  const validCertTypesByOfficer = useMemo(() => {
    const now = Timestamp.now().toMillis();
    const map = new Map<string, Set<string>>();
    for (const cert of certificates) {
      if (cert.expirationDate.toMillis() < now) continue;
      const set = map.get(cert.userId) ?? new Set<string>();
      set.add(cert.certType.trim().toLowerCase());
      map.set(cert.userId, set);
    }
    return map;
  }, [certificates]);

  function missingCertsFor(officer: OfficerOption): string[] {
    const required = selectedClient?.requiredCertTypes ?? [];
    if (required.length === 0) return [];
    const held = validCertTypesByOfficer.get(officer.id) ?? new Set<string>();
    return required.filter((req) => !held.has(req.trim().toLowerCase()));
  }

  // Weekly quota pre-check - counts this client's other scheduled/completed
  // visits in the same week as the chosen date (Sunday-start, matching the
  // board's week view and assignSchedule's server-side check).
  useEffect(() => {
    if (!clientId || !date) return;
    const anchor = new Date(date);
    const weekStart = startOfWeek(anchor, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(anchor, { weekStartsOn: 0 });
    const q = query(
      collection(db, "schedules"),
      where("clientId", "==", clientId),
      where("scheduledDate", ">=", Timestamp.fromDate(weekStart)),
      where("scheduledDate", "<", Timestamp.fromDate(addDays(weekEnd, 1)))
    );
    return onSnapshot(q, (snapshot) => {
      setWeekSchedules(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as ScheduleDoc) })));
    });
  }, [clientId, date]);

  const weeklyQuota = selectedClient?.weeklyDaysCount;
  const usedThisWeek = weekSchedules.filter(
    (s) => s.id !== target.scheduleId && s.status !== "canceled"
  ).length;
  const quotaExceeded = weeklyQuota != null && usedThisWeek + 1 > weeklyQuota;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!clientId || !officerId || !date) return;
    if (quotaExceeded) {
      toast.error("לא ניתן לשבץ: חריגה ממכסת הימים השבועית של הלקוח");
      return;
    }
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

        {selectedClient && weeklyQuota != null && (
          <p className={cn("text-xs", quotaExceeded ? "font-medium text-destructive" : "text-muted-foreground")}>
            ימי שיבוץ השבוע עבור {selectedClient.companyName}: {usedThisWeek}/{weeklyQuota}
            {quotaExceeded && " - חריגה ממכסת הימים השבועית!"}
          </p>
        )}

        <div className="space-y-1.5">
          <Label>ממונה בטיחות</Label>
          <Select value={officerId} onValueChange={(value) => setOfficerId(value ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="בחירת ממונה" />
            </SelectTrigger>
            <SelectContent>
              {officers.map((officer) => {
                const expiryBlocked =
                  officer.certStatus === "expired" || officer.certStatus === "expiring_soon";
                const missing = missingCertsFor(officer);
                const blocked = expiryBlocked || missing.length > 0;
                return (
                  <SelectItem key={officer.id} value={officer.id} disabled={blocked}>
                    <span className="flex items-center gap-2">
                      {officer.fullName}
                      <CertStatusBadge status={officer.certStatus} />
                      {missing.length > 0 && (
                        <span className="text-xs text-destructive">(חסר: {missing.join(", ")})</span>
                      )}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            לא ניתן לשבץ ממונה עם תעודה שפגה או שתפוג תוך פחות מ-7 ימים, או ללא תעודה הנדרשת עבור לקוח זה.
          </p>
        </div>
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>ביטול</DialogClose>
        <Button type="submit" disabled={submitting || !clientId || !officerId || !date || quotaExceeded}>
          {submitting ? "משבץ..." : "שיבוץ"}
        </Button>
      </DialogFooter>
    </form>
  );
}
