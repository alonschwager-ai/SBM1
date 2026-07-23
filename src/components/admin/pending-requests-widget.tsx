"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { CheckIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db, functions } from "@/lib/firebase";
import {
  ClientDoc,
  SCHEDULE_CHANGE_TYPE_LABELS,
  ScheduleChangeRequestDoc,
  UserDoc,
} from "@/lib/types";

type RequestRow = ScheduleChangeRequestDoc & { id: string };

export function PendingRequestsWidget() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [officers, setOfficers] = useState<Record<string, UserDoc>>({});
  const [clients, setClients] = useState<Record<string, ClientDoc>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(
      query(collection(db, "scheduleChangeRequests"), where("status", "==", "PENDING_ADMIN_APPROVAL")),
      (snapshot) => {
        setRequests(
          snapshot.docs
            .map((d) => ({ id: d.id, ...(d.data() as ScheduleChangeRequestDoc) }))
            .sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis())
        );
      }
    );
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, "users"), (snapshot) => {
      setOfficers(Object.fromEntries(snapshot.docs.map((d) => [d.id, d.data() as UserDoc])));
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, "clients"), (snapshot) => {
      setClients(Object.fromEntries(snapshot.docs.map((d) => [d.id, d.data() as ClientDoc])));
    });
  }, []);

  async function handleApprove(request: RequestRow) {
    setResolvingId(request.id);
    try {
      if (request.type === "reschedule" && request.requestedDate) {
        const assignSchedule = httpsCallable(functions, "assignSchedule");
        await assignSchedule({
          scheduleId: request.scheduleId,
          userId: request.userId,
          clientId: request.clientId,
          scheduledDate: request.requestedDate.toDate().toISOString(),
        });
      } else {
        await updateDoc(doc(db, "schedules", request.scheduleId), {
          status: "canceled",
          updatedAt: serverTimestamp(),
        });
      }
      await updateDoc(doc(db, "scheduleChangeRequests", request.id), {
        status: "approved",
        updatedAt: serverTimestamp(),
      });
      toast.success("הבקשה אושרה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "אישור הבקשה נכשל");
    } finally {
      setResolvingId(null);
    }
  }

  async function handleReject(request: RequestRow) {
    setResolvingId(request.id);
    try {
      await updateDoc(doc(db, "scheduleChangeRequests", request.id), {
        status: "rejected",
        updatedAt: serverTimestamp(),
      });
      toast.success("הבקשה נדחתה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "דחיית הבקשה נכשלה");
    } finally {
      setResolvingId(null);
    }
  }

  if (requests.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>בקשות שינוי שיבוץ ממתינות ({requests.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {requests.map((request) => {
          const officer = officers[request.userId];
          const client = clients[request.clientId];
          const busy = resolvingId === request.id;
          return (
            <div
              key={request.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{officer?.fullName ?? request.userId}</span>
                  <Badge variant="outline">{SCHEDULE_CHANGE_TYPE_LABELS[request.type]}</Badge>
                </div>
                <div className="text-muted-foreground">
                  {client?.companyName ?? request.clientId} ·{" "}
                  {request.scheduledDate.toDate().toLocaleDateString("he-IL")}
                  {request.type === "reschedule" && request.requestedDate && (
                    <> ← {request.requestedDate.toDate().toLocaleDateString("he-IL")}</>
                  )}
                </div>
                <div className="text-muted-foreground">{request.note}</div>
              </div>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => handleApprove(request)}
                >
                  <CheckIcon data-icon="inline-start" className="text-emerald-600" />
                  אישור
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => handleReject(request)}
                >
                  <XIcon data-icon="inline-start" className="text-destructive" />
                  דחייה
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
