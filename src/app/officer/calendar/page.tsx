"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { he } from "date-fns/locale";
import { CalendarSyncIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShiftRequestDialog,
  ShiftRequestTarget,
} from "@/components/officer/shift-request-dialog";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { downloadIcsFile } from "@/lib/ical";
import { ClientDoc, ScheduleChangeRequestDoc, ScheduleDoc } from "@/lib/types";
import { cn } from "@/lib/utils";

type ScheduleRow = ScheduleDoc & { id: string };
type ClientRow = ClientDoc & { id: string };

const CLIENT_COLORS = [
  { chip: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  { chip: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  { chip: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  { chip: "bg-violet-100 text-violet-700", dot: "bg-violet-500" },
  { chip: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
  { chip: "bg-cyan-100 text-cyan-700", dot: "bg-cyan-500" },
];

export default function OfficerCalendarPage() {
  const { user } = useAuth();
  const [view, setView] = useState<"week" | "month">("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [clientsById, setClientsById] = useState<Record<string, ClientRow>>({});
  const [pendingScheduleIds, setPendingScheduleIds] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<ShiftRequestTarget | null>(null);
  const [exporting, setExporting] = useState(false);

  const rangeStart =
    view === "week" ? startOfWeek(anchor, { weekStartsOn: 0 }) : startOfMonth(anchor);
  const rangeEnd =
    view === "week" ? endOfWeek(anchor, { weekStartsOn: 0 }) : endOfMonth(anchor);
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "schedules"),
      where("userId", "==", user.uid),
      where("scheduledDate", ">=", Timestamp.fromDate(rangeStart)),
      where("scheduledDate", "<", Timestamp.fromDate(addDays(rangeEnd, 1)))
    );
    return onSnapshot(q, (snapshot) => {
      setSchedules(
        snapshot.docs
          .map((d) => ({ id: d.id, ...(d.data() as ScheduleDoc) }))
          .filter((s) => s.status === "scheduled")
      );
    });
  }, [user, rangeStart, rangeEnd]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db, "scheduleChangeRequests"), where("userId", "==", user.uid)),
      (snapshot) => {
        const pending = new Set<string>();
        snapshot.forEach((doc) => {
          const data = doc.data() as ScheduleChangeRequestDoc;
          if (data.status === "PENDING_ADMIN_APPROVAL") pending.add(data.scheduleId);
        });
        setPendingScheduleIds(pending);
      }
    );
  }, [user]);

  // The officer's full client list (independent of the visible calendar
  // range) so a given client always gets the same color, and the iCal
  // export can resolve names/addresses for shifts outside the loaded range.
  useEffect(() => {
    if (!user) return;
    const unsubPrimary = onSnapshot(
      query(collection(db, "clients"), where("assignedOfficerId", "==", user.uid)),
      (snapshot) => {
        setClientsById((prev) => ({
          ...prev,
          ...Object.fromEntries(
            snapshot.docs.map((d) => [d.id, { id: d.id, ...(d.data() as ClientDoc) }])
          ),
        }));
      }
    );
    const unsubSchedule = onSnapshot(
      query(collection(db, "clients"), where("assignedOfficerIds", "array-contains", user.uid)),
      (snapshot) => {
        setClientsById((prev) => ({
          ...prev,
          ...Object.fromEntries(
            snapshot.docs.map((d) => [d.id, { id: d.id, ...(d.data() as ClientDoc) }])
          ),
        }));
      }
    );
    return () => {
      unsubPrimary();
      unsubSchedule();
    };
  }, [user]);

  const clientColorById = useMemo(() => {
    const sortedIds = Object.values(clientsById)
      .sort((a, b) => a.companyName.localeCompare(b.companyName, "he"))
      .map((c) => c.id);
    return new Map(sortedIds.map((id, index) => [id, CLIENT_COLORS[index % CLIENT_COLORS.length]]));
  }, [clientsById]);

  function schedulesFor(day: Date) {
    return schedules.filter((s) => isSameDay(s.scheduledDate.toDate(), day));
  }

  function goPrev() {
    setAnchor((d) => (view === "week" ? subWeeks(d, 1) : subMonths(d, 1)));
  }
  function goNext() {
    setAnchor((d) => (view === "week" ? addWeeks(d, 1) : addMonths(d, 1)));
  }

  function openRequestFor(schedule: ScheduleRow) {
    if (pendingScheduleIds.has(schedule.id)) {
      toast.info("כבר קיימת בקשה ממתינה לאישור עבור ביקור זה");
      return;
    }
    const client = clientsById[schedule.clientId];
    setTarget({ schedule, clientName: client?.companyName ?? "לקוח" });
  }

  async function handleExport() {
    if (!user) return;
    setExporting(true);
    try {
      const today = startOfDay(new Date());
      const q = query(
        collection(db, "schedules"),
        where("userId", "==", user.uid),
        where("scheduledDate", ">=", Timestamp.fromDate(today)),
        where("scheduledDate", "<", Timestamp.fromDate(addDays(today, 90))),
        orderBy("scheduledDate")
      );
      const snapshot = await getDocs(q);
      const events = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as ScheduleDoc) }))
        .filter((s) => s.status === "scheduled")
        .map((s) => ({
          uid: `${s.id}@sbm-safety`,
          date: s.scheduledDate.toDate(),
          summary: `ביקור בטיחות - ${clientsById[s.clientId]?.companyName ?? "לקוח"}`,
          location: clientsById[s.clientId]?.address,
        }));

      if (events.length === 0) {
        toast.info("אין שיבוצים קרובים לייצוא");
        return;
      }
      downloadIcsFile("shifts.ics", events);
      toast.success("קובץ היומן הופק - ניתן לייבא ל-Google Calendar");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ייצוא היומן נכשל");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">לוח שנה שלי</h1>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11"
          onClick={handleExport}
          disabled={exporting}
        >
          <CalendarSyncIcon data-icon="inline-start" />
          {exporting ? "מייצא..." : "ייצוא ל-iCal"}
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Tabs value={view} onValueChange={(v) => setView(v as "week" | "month")}>
          <TabsList>
            <TabsTrigger value="week" className="min-h-11">
              שבועי
            </TabsTrigger>
            <TabsTrigger value="month" className="min-h-11">
              חודשי
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="min-h-11 min-w-11" onClick={goPrev}>
            <ChevronRightIcon />
          </Button>
          <span className="min-w-24 text-center text-sm font-medium">
            {format(rangeStart, "d MMM", { locale: he })} - {format(rangeEnd, "d MMM", { locale: he })}
          </span>
          <Button variant="outline" size="icon" className="min-h-11 min-w-11" onClick={goNext}>
            <ChevronLeftIcon />
          </Button>
        </div>
      </div>

      {view === "month" ? (
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const daySchedules = schedulesFor(day);
            const primary = daySchedules[0];
            const color = primary ? clientColorById.get(primary.clientId) : undefined;
            return (
              <button
                key={day.toISOString()}
                type="button"
                disabled={!primary}
                onClick={() => primary && openRequestFor(primary)}
                className={cn(
                  "flex min-h-[44px] flex-col items-center gap-0.5 rounded-lg border p-1 text-xs",
                  !isSameMonth(day, anchor) && "opacity-40",
                  isToday(day) && "border-brand-500",
                  primary ? "cursor-pointer hover:bg-muted" : "cursor-default"
                )}
              >
                <span className="font-medium">{format(day, "d")}</span>
                {primary && (
                  <span className={cn("size-1.5 rounded-full", color?.dot ?? "bg-primary")} />
                )}
                {pendingScheduleIds.has(primary?.id ?? "") && (
                  <span className="size-1 rounded-full bg-amber-500" />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {days.map((day) => {
            const daySchedules = schedulesFor(day);
            return (
              <Card key={day.toISOString()} className={cn(isToday(day) && "ring-1 ring-brand-500")}>
                <div className="flex items-center justify-between p-3">
                  <div className="text-sm font-medium">
                    {format(day, "EEEE, d MMMM", { locale: he })}
                  </div>
                  {daySchedules.length === 0 && (
                    <span className="text-xs text-muted-foreground">אין ביקור</span>
                  )}
                </div>
                {daySchedules.length > 0 && (
                  <div className="space-y-1.5 px-3 pb-3">
                    {daySchedules.map((schedule) => {
                      const client = clientsById[schedule.clientId];
                      const color = clientColorById.get(schedule.clientId);
                      const isPending = pendingScheduleIds.has(schedule.id);
                      return (
                        <button
                          key={schedule.id}
                          type="button"
                          onClick={() => openRequestFor(schedule)}
                          className={cn(
                            "flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2 text-start text-sm",
                            color?.chip ?? "bg-muted"
                          )}
                        >
                          <span className="font-medium">{client?.companyName ?? "לקוח"}</span>
                          {isPending && (
                            <Badge variant="outline" className="bg-white/60">
                              ממתין לאישור
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <ShiftRequestDialog target={target} onClose={() => setTarget(null)} />
    </div>
  );
}
