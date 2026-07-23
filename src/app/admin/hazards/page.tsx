"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HazardResolveDialog, HazardRow } from "@/components/hazard-resolve-dialog";
import { db } from "@/lib/firebase";
import {
  ClientDoc,
  HAZARD_SEVERITY_LABELS,
  HAZARD_STATUS_LABELS,
  HazardDoc,
  HazardSeverity,
  HazardStatus,
} from "@/lib/types";

type ClientRow = ClientDoc & { id: string };

const ALL = "all";

const SEVERITY_CLASSES: Record<HazardSeverity, string> = {
  low: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-orange-50 text-orange-700",
  critical: "bg-red-50 text-red-700",
};

const STATUS_CLASSES: Record<HazardStatus, string> = {
  OPEN: "bg-red-50 text-red-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  RESOLVED: "bg-emerald-50 text-emerald-700",
};

export default function AdminHazardsPage() {
  const [hazards, setHazards] = useState<HazardRow[]>([]);
  const [clients, setClients] = useState<Record<string, ClientRow>>({});
  const [statusFilter, setStatusFilter] = useState<HazardStatus | typeof ALL>("OPEN");
  const [severityFilter, setSeverityFilter] = useState<HazardSeverity | typeof ALL>(ALL);
  const [clientFilter, setClientFilter] = useState<string>(ALL);
  const [resolving, setResolving] = useState<HazardRow | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(query(collection(db, "hazards"), orderBy("createdAt", "desc")), (snapshot) => {
      setHazards(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as HazardDoc) })));
    });
  }, []);

  useEffect(() => {
    return onSnapshot(query(collection(db, "clients"), orderBy("companyName")), (snapshot) => {
      setClients(
        Object.fromEntries(snapshot.docs.map((d) => [d.id, { id: d.id, ...(d.data() as ClientDoc) }]))
      );
    });
  }, []);

  const filtered = useMemo(
    () =>
      hazards.filter(
        (h) =>
          (statusFilter === ALL || h.status === statusFilter) &&
          (severityFilter === ALL || h.severity === severityFilter) &&
          (clientFilter === ALL || h.clientId === clientFilter)
      ),
    [hazards, statusFilter, severityFilter, clientFilter]
  );

  async function markInProgress(hazard: HazardRow) {
    setUpdatingId(hazard.id);
    try {
      await updateDoc(doc(db, "hazards", hazard.id), { status: "IN_PROGRESS" });
      toast.success("המפגע סומן כבטיפול");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "העדכון נכשל");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">ניהול מפגעים</h1>
        <p className="text-sm text-muted-foreground">מעקב אחר מפגעים שדווחו וטיפול בהם עד לסגירה.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter((v ?? ALL) as HazardStatus | typeof ALL)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>כל הסטטוסים</SelectItem>
            {(Object.keys(HAZARD_STATUS_LABELS) as HazardStatus[]).map((status) => (
              <SelectItem key={status} value={status}>
                {HAZARD_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={severityFilter}
          onValueChange={(v) => setSeverityFilter((v ?? ALL) as HazardSeverity | typeof ALL)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>כל רמות החומרה</SelectItem>
            {(Object.keys(HAZARD_SEVERITY_LABELS) as HazardSeverity[]).map((sev) => (
              <SelectItem key={sev} value={sev}>
                {HAZARD_SEVERITY_LABELS[sev]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={clientFilter} onValueChange={(v) => setClientFilter(v ?? ALL)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>כל הלקוחות</SelectItem>
            {Object.values(clients).map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.companyName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">אין מפגעים התואמים לסינון</Card>
        )}
        {filtered.map((hazard) => (
          <Card key={hazard.id} className="space-y-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge className={SEVERITY_CLASSES[hazard.severity]}>
                  {HAZARD_SEVERITY_LABELS[hazard.severity]}
                </Badge>
                <Badge className={STATUS_CLASSES[hazard.status]}>
                  {HAZARD_STATUS_LABELS[hazard.status]}
                </Badge>
                <span className="text-sm font-medium">
                  {clients[hazard.clientId]?.companyName ?? hazard.clientId}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                יעד לתיקון: {hazard.dueDate.toDate().toLocaleDateString("he-IL")}
              </span>
            </div>
            <p className="text-sm">{hazard.description}</p>
            {hazard.status === "RESOLVED" && (
              <div className="rounded-lg bg-emerald-50 p-2.5 text-sm text-emerald-800">
                <div className="font-medium">טופל {hazard.resolvedAt?.toDate().toLocaleDateString("he-IL")}</div>
                {hazard.resolutionComment && <div>{hazard.resolutionComment}</div>}
              </div>
            )}
            {hazard.status !== "RESOLVED" && (
              <div className="flex gap-2 pt-1">
                {hazard.status === "OPEN" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updatingId === hazard.id}
                    onClick={() => markInProgress(hazard)}
                  >
                    התחלת טיפול
                  </Button>
                )}
                <Button size="sm" onClick={() => setResolving(hazard)}>
                  סימון כטופל
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      <HazardResolveDialog hazard={resolving} onClose={() => setResolving(null)} />
    </div>
  );
}
