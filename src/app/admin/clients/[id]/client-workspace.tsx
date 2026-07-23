"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { addDays } from "date-fns";
import { MapPinIcon, PlusIcon, SendIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { submitReportAction } from "@/lib/actions/report-actions";
import { db } from "@/lib/firebase";
import { ClientDoc, HazardDoc, ReportDoc, ScheduleDoc, UserDoc } from "@/lib/types";

type ClientRow = ClientDoc & { id: string };
type ScheduleRow = ScheduleDoc & { id: string };
type ReportRow = ReportDoc & { id: string };

const PAGE_SIZE = 5;

export function ClientWorkspace({ clientId }: { clientId: string }) {
  const { user } = useAuth();
  const [client, setClient] = useState<ClientRow | null>(null);
  const [todaySchedules, setTodaySchedules] = useState<ScheduleRow[]>([]);
  const [officers, setOfficers] = useState<Record<string, UserDoc>>({});
  const [openHazardCount, setOpenHazardCount] = useState<number | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [reportPageSize, setReportPageSize] = useState(PAGE_SIZE);
  const [reportsExhausted, setReportsExhausted] = useState(false);
  const [newRequiredCert, setNewRequiredCert] = useState("");
  const [sendingReportId, setSendingReportId] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(doc(db, "clients", clientId), (snap) => {
      if (snap.exists()) setClient({ id: snap.id, ...(snap.data() as ClientDoc) });
    });
  }, [clientId]);

  useEffect(() => {
    return onSnapshot(collection(db, "users"), (snapshot) => {
      setOfficers(Object.fromEntries(snapshot.docs.map((d) => [d.id, d.data() as UserDoc])));
    });
  }, []);

  // Live Site Pulse - who (if anyone) is checked in at this client today.
  useEffect(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const q = query(
      collection(db, "schedules"),
      where("clientId", "==", clientId),
      where("scheduledDate", ">=", Timestamp.fromDate(todayStart)),
      where("scheduledDate", "<", Timestamp.fromDate(addDays(todayStart, 1)))
    );
    return onSnapshot(q, (snapshot) => {
      setTodaySchedules(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as ScheduleDoc) })));
    });
  }, [clientId]);

  useEffect(() => {
    return onSnapshot(query(collection(db, "hazards"), where("clientId", "==", clientId)), (snapshot) => {
      setOpenHazardCount(
        snapshot.docs.filter((d) => (d.data() as HazardDoc).status !== "RESOLVED").length
      );
    });
  }, [clientId]);

  useEffect(() => {
    const q = query(
      collection(db, "reports"),
      where("clientId", "==", clientId),
      orderBy("createdAt", "desc"),
      limit(reportPageSize)
    );
    return onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as ReportDoc) })));
      setReportsExhausted(snapshot.docs.length < reportPageSize);
    });
  }, [clientId, reportPageSize]);

  const checkedInSchedule = useMemo(
    () => todaySchedules.find((s) => s.status === "scheduled" && s.checkedInAt),
    [todaySchedules]
  );

  async function addRequiredCert() {
    if (!client || !newRequiredCert.trim()) return;
    const next = [...(client.requiredCertTypes ?? []), newRequiredCert.trim()];
    await updateDoc(doc(db, "clients", clientId), {
      requiredCertTypes: next,
      updatedAt: serverTimestamp(),
    });
    setNewRequiredCert("");
  }

  async function removeRequiredCert(value: string) {
    if (!client) return;
    const next = (client.requiredCertTypes ?? []).filter((c) => c !== value);
    await updateDoc(doc(db, "clients", clientId), {
      requiredCertTypes: next,
      updatedAt: serverTimestamp(),
    });
  }

  async function handleSendReport(reportId: string) {
    if (!user) return;
    setSendingReportId(reportId);
    try {
      const idToken = await user.getIdToken();
      const result = await submitReportAction(reportId, idToken);
      if (result.ok) {
        toast.success("הדוח נשלח ללקוח");
      } else {
        toast.error(result.error ?? "שליחת הדוח נכשלה");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שליחת הדוח נכשלה");
    } finally {
      setSendingReportId(null);
    }
  }

  if (!client) {
    return <p className="text-sm text-muted-foreground">טוען...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{client.companyName}</h1>
          <p className="text-sm text-muted-foreground">{client.address}</p>
        </div>
        <Button variant="outline" render={<Link href="/admin/clients" />}>
          עריכה בעמוד הלקוחות
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>דופק האתר בזמן אמת</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {checkedInSchedule ? (
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-3">
              <div>
                <div className="font-medium text-emerald-800">
                  {officers[checkedInSchedule.userId]?.fullName ?? "ממונה"} - בשטח כעת
                </div>
                <div className="text-emerald-700">
                  צ׳ק-אין בשעה{" "}
                  {checkedInSchedule.checkedInAt?.toDate().toLocaleTimeString("he-IL", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
              {checkedInSchedule.checkedInLocation && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  render={
                    <a
                      href={`https://maps.google.com/?q=${checkedInSchedule.checkedInLocation.lat},${checkedInSchedule.checkedInLocation.lng}`}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  <MapPinIcon />
                </Button>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">אין ממונה בשטח כרגע</p>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">מפגעים פתוחים באתר</span>
            <Badge variant={openHazardCount ? "destructive" : "outline"}>
              {openHazardCount ?? "—"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>דרישות תעודה לשיבוץ באתר זה</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {(client.requiredCertTypes ?? []).map((cert) => (
              <Badge key={cert} variant="outline" className="gap-1">
                {cert}
                <button type="button" onClick={() => removeRequiredCert(cert)}>
                  <XIcon className="size-3" />
                </button>
              </Badge>
            ))}
            {(client.requiredCertTypes ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">אין דרישות תעודה מיוחדות</p>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={newRequiredCert}
              onChange={(e) => setNewRequiredCert(e.target.value)}
              placeholder="לדוגמה: תעודת גובה"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRequiredCert())}
            />
            <Button type="button" variant="outline" onClick={addRequiredCert}>
              <PlusIcon data-icon="inline-start" />
              הוספה
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            שיבוץ ממונה ללא אחת מהתעודות הנדרשות (בתוקף) ייחסם אוטומטית בלוח השיבוצים.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ארכיון דוחות ביקורת</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {reports.length === 0 && (
            <p className="text-sm text-muted-foreground">אין דוחות עדיין</p>
          )}
          {reports.map((report) => (
            <div
              key={report.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
            >
              <div>
                <div className="font-medium">
                  {officers[report.userId]?.fullName ?? "ממונה"} ·{" "}
                  {report.createdAt.toDate().toLocaleDateString("he-IL")}
                </div>
                <div className="line-clamp-1 text-muted-foreground">{report.summary}</div>
              </div>
              <div className="flex gap-1.5">
                {report.pdfUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<a href={report.pdfUrl} target="_blank" rel="noreferrer" />}
                  >
                    הורדת PDF
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={sendingReportId === report.id}
                  onClick={() => handleSendReport(report.id)}
                >
                  <SendIcon data-icon="inline-start" />
                  שליחה ללקוח
                </Button>
              </div>
            </div>
          ))}
          {!reportsExhausted && reports.length > 0 && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setReportPageSize((n) => n + PAGE_SIZE)}
            >
              טעינת דוחות נוספים
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
