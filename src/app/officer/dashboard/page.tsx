"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { addDays, isToday } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { getCurrentPosition } from "@/lib/geolocation";
import { ClientDoc, ScheduleDoc } from "@/lib/types";

type ScheduleRow = ScheduleDoc & { id: string };
type ClientRow = ClientDoc & { id: string };

const UPCOMING_WINDOW_DAYS = 14;

export default function OfficerDashboardPage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [clients, setClients] = useState<Record<string, ClientRow>>({});
  const [checkingIn, setCheckingIn] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, "schedules"),
      where("userId", "==", user.uid),
      where("scheduledDate", ">=", Timestamp.fromDate(todayStart)),
      where("scheduledDate", "<", Timestamp.fromDate(addDays(todayStart, UPCOMING_WINDOW_DAYS))),
      orderBy("scheduledDate")
    );
    return onSnapshot(q, (snapshot) => {
      setSchedules(
        snapshot.docs
          .map((d) => ({ id: d.id, ...(d.data() as ScheduleDoc) }))
          .filter((s) => s.status === "scheduled")
      );
    });
  }, [user]);

  useEffect(() => {
    const clientIds = [...new Set(schedules.map((s) => s.clientId))];
    const unsubs = clientIds.map((clientId) =>
      onSnapshot(doc(db, "clients", clientId), (snap) => {
        if (!snap.exists()) return;
        setClients((prev) => ({
          ...prev,
          [clientId]: { id: snap.id, ...(snap.data() as ClientDoc) },
        }));
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [schedules]);

  const { today, upcoming } = useMemo(() => {
    const today: ScheduleRow[] = [];
    const upcoming: ScheduleRow[] = [];
    for (const s of schedules) {
      (isToday(s.scheduledDate.toDate()) ? today : upcoming).push(s);
    }
    return { today, upcoming };
  }, [schedules]);

  async function handleCheckIn(schedule: ScheduleRow) {
    setCheckingIn(schedule.id);
    try {
      // Best-effort: never block check-in on a denied/unavailable location.
      let checkedInLocation: { lat: number; lng: number } | undefined;
      try {
        const position = await getCurrentPosition();
        checkedInLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
      } catch {
        // location unavailable/denied - still check in without it
      }

      await updateDoc(doc(db, "schedules", schedule.id), {
        checkedInAt: serverTimestamp(),
        ...(checkedInLocation ? { checkedInLocation } : {}),
        updatedAt: serverTimestamp(),
      });
      toast.success("בוצע צ'ק-אין");
    } catch {
      toast.error("הצ'ק-אין נכשל");
    } finally {
      setCheckingIn(null);
    }
  }

  function AssignmentCard({ schedule }: { schedule: ScheduleRow }) {
    const client = clients[schedule.clientId];
    const checkedIn = !!schedule.checkedInAt;
    return (
      <Card>
        <CardHeader>
          <CardTitle>{client?.companyName ?? "טוען..."}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm text-muted-foreground">
            {schedule.scheduledDate.toDate().toLocaleDateString("he-IL")}
          </div>
          {client?.contactPerson && <div className="text-sm">איש קשר: {client.contactPerson}</div>}
          {client?.phone && <div className="text-sm">טלפון: {client.phone}</div>}
          {client?.address && <div className="text-sm">כתובת: {client.address}</div>}
          <div className="flex gap-2 pt-2">
            {!checkedIn ? (
              <Button
                onClick={() => handleCheckIn(schedule)}
                disabled={checkingIn === schedule.id}
                className="flex-1"
              >
                {checkingIn === schedule.id ? "מבצע צ'ק-אין..." : "צ'ק-אין"}
              </Button>
            ) : (
              <Button
                render={<Link href={`/officer/reports/new?scheduleId=${schedule.id}`} />}
                className="flex-1"
              >
                מילוי דוח
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <h1 className="text-xl font-bold">השיבוצים שלי</h1>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">היום</h2>
        {today.length === 0 && (
          <p className="text-sm text-muted-foreground">אין ביקורים היום</p>
        )}
        <div className="space-y-3">
          {today.map((s) => (
            <AssignmentCard key={s.id} schedule={s} />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">בקרוב</h2>
        {upcoming.length === 0 && (
          <p className="text-sm text-muted-foreground">אין ביקורים קרובים</p>
        )}
        <div className="space-y-3">
          {upcoming.map((s) => (
            <AssignmentCard key={s.id} schedule={s} />
          ))}
        </div>
      </div>
    </div>
  );
}
