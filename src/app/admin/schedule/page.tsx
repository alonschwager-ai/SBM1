"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
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
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { he } from "date-fns/locale";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AssignScheduleDialog,
  AssignScheduleTarget,
} from "@/components/admin/assign-schedule-dialog";
import { PendingRequestsWidget } from "@/components/admin/pending-requests-widget";
import { db } from "@/lib/firebase";
import { ClientDoc, ScheduleDoc, UserDoc } from "@/lib/types";
import { cn } from "@/lib/utils";

type ScheduleRow = ScheduleDoc & { id: string };
type ClientRow = ClientDoc & { id: string };
type OfficerRow = UserDoc & { id: string };

export default function SchedulePage() {
  const [view, setView] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [officers, setOfficers] = useState<OfficerRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [target, setTarget] = useState<AssignScheduleTarget | null>(null);

  const rangeStart =
    view === "week" ? startOfWeek(anchor, { weekStartsOn: 0 }) : startOfMonth(anchor);
  const rangeEnd =
    view === "week" ? endOfWeek(anchor, { weekStartsOn: 0 }) : endOfMonth(anchor);
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

  useEffect(() => {
    return onSnapshot(query(collection(db, "clients"), orderBy("companyName")), (snapshot) => {
      setClients(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as ClientDoc) })));
    });
  }, []);

  useEffect(() => {
    return onSnapshot(
      query(collection(db, "users"), where("role", "==", "safety_officer"), orderBy("fullName")),
      (snapshot) => {
        setOfficers(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as UserDoc) })));
      }
    );
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "schedules"),
      where("scheduledDate", ">=", Timestamp.fromDate(rangeStart)),
      where("scheduledDate", "<", Timestamp.fromDate(addDays(rangeEnd, 1)))
    );
    return onSnapshot(q, (snapshot) => {
      setSchedules(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as ScheduleDoc) })));
    });
  }, [rangeStart, rangeEnd]);

  const clientNameById = useMemo(
    () => new Map(clients.map((c) => [c.id, c.companyName])),
    [clients]
  );
  const officerNameById = useMemo(
    () => new Map(officers.map((o) => [o.id, o.fullName])),
    [officers]
  );

  function schedulesFor(day: Date, clientId?: string) {
    return schedules.filter(
      (s) =>
        isSameDay(s.scheduledDate.toDate(), day) &&
        (!clientId || s.clientId === clientId)
    );
  }

  function goPrev() {
    setAnchor((d) => (view === "week" ? subWeeks(d, 1) : subMonths(d, 1)));
  }
  function goNext() {
    setAnchor((d) => (view === "week" ? addWeeks(d, 1) : addMonths(d, 1)));
  }

  return (
    <div className="space-y-4">
      <PendingRequestsWidget />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">לוח שיבוצים</h1>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as "week" | "month")}>
            <TabsList>
              <TabsTrigger value="week">שבועי</TabsTrigger>
              <TabsTrigger value="month">חודשי</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="icon-sm" onClick={goPrev}>
            <ChevronRightIcon />
          </Button>
          <span className="min-w-32 text-center text-sm font-medium">
            {format(rangeStart, "d MMM", { locale: he })} - {format(rangeEnd, "d MMM yyyy", { locale: he })}
          </span>
          <Button variant="outline" size="icon-sm" onClick={goNext}>
            <ChevronLeftIcon />
          </Button>
        </div>
      </div>

      {view === "week" ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>לקוח</TableHead>
                {days.map((day) => (
                  <TableHead key={day.toISOString()} className="text-center">
                    {format(day, "EEEEEE d/M", { locale: he })}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.companyName}</TableCell>
                  {days.map((day) => {
                    const cellSchedules = schedulesFor(day, client.id);
                    return (
                      <TableCell key={day.toISOString()} className="align-top">
                        <button
                          type="button"
                          className="flex min-h-14 w-full min-w-24 flex-col gap-1 rounded-lg p-1 text-start hover:bg-muted"
                          onClick={() =>
                            setTarget({
                              scheduleId: cellSchedules[0]?.id,
                              clientId: client.id,
                              officerId: cellSchedules[0]?.userId,
                              date: format(day, "yyyy-MM-dd"),
                            })
                          }
                        >
                          {cellSchedules.length === 0 && (
                            <PlusIcon className="mx-auto size-3.5 text-muted-foreground" />
                          )}
                          {cellSchedules.map((s) => (
                            <span
                              key={s.id}
                              className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
                            >
                              {officerNameById.get(s.userId) ?? s.userId}
                            </span>
                          ))}
                        </button>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              {clients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={days.length + 1} className="text-center text-muted-foreground">
                    יש להוסיף לקוחות תחילה
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((day) => {
            const daySchedules = schedulesFor(day);
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() =>
                  setTarget({ date: format(day, "yyyy-MM-dd") })
                }
                className={cn(
                  "min-h-24 rounded-lg border p-1.5 text-start hover:bg-muted",
                  !isSameMonth(day, anchor) && "opacity-40"
                )}
              >
                <div className="text-xs font-medium">{format(day, "d")}</div>
                <div className="mt-1 space-y-0.5">
                  {daySchedules.slice(0, 3).map((s) => (
                    <div
                      key={s.id}
                      className="truncate rounded bg-primary/10 px-1 text-[0.7rem] text-primary"
                    >
                      {clientNameById.get(s.clientId) ?? s.clientId}
                    </div>
                  ))}
                  {daySchedules.length > 3 && (
                    <div className="text-[0.7rem] text-muted-foreground">
                      +{daySchedules.length - 3} נוספים
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <AssignScheduleDialog target={target} onClose={() => setTarget(null)} />
    </div>
  );
}
