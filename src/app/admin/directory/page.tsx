"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { MapPinIcon } from "lucide-react";
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
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getIndustryCategories } from "@/lib/constants/industryChecklists";
import { db } from "@/lib/firebase";
import { ClientDoc, INDUSTRY_SECTOR_LABELS, SAFETY_CATEGORY_LABELS, UserDoc } from "@/lib/types";

type ClientRow = ClientDoc & { id: string };
type OfficerOption = UserDoc & { id: string };

export default function DirectoryPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [officers, setOfficers] = useState<OfficerOption[]>([]);
  const [selected, setSelected] = useState<ClientRow | null>(null);

  useEffect(() => {
    return onSnapshot(query(collection(db, "clients"), orderBy("companyName")), (snapshot) => {
      setClients(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as ClientDoc) })));
    });
  }, []);

  useEffect(() => {
    return onSnapshot(
      query(collection(db, "users"), where("role", "==", "safety_officer"), orderBy("fullName")),
      (snapshot) => setOfficers(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as UserDoc) })))
    );
  }, []);

  const officerById = useMemo(() => new Map(officers.map((o) => [o.id, o])), [officers]);

  const selectedOfficer = selected?.assignedOfficerId
    ? officerById.get(selected.assignedOfficerId)
    : undefined;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">דפי תקשורת</h1>
        <p className="text-sm text-muted-foreground">
          מבט מרוכז על פרטי הקשר של כל לקוח והממונה הקבוע מטעמנו.
        </p>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>חברה</TableHead>
              <TableHead>תחום עיסוק</TableHead>
              <TableHead>ממונה בטיחות קבוע</TableHead>
              <TableHead>אזור</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => {
              const officer = client.assignedOfficerId
                ? officerById.get(client.assignedOfficerId)
                : undefined;
              return (
                <TableRow
                  key={client.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(client)}
                >
                  <TableCell className="font-medium">{client.companyName}</TableCell>
                  <TableCell>
                    {client.industrySector ? (
                      <Badge>{INDUSTRY_SECTOR_LABELS[client.industrySector]}</Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {officer ? (
                      officer.fullName
                    ) : (
                      <Badge variant="outline">לא שויך</Badge>
                    )}
                  </TableCell>
                  <TableCell>{client.region || "—"}</TableCell>
                </TableRow>
              );
            })}
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  אין לקוחות עדיין
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {selected && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle>{selected.companyName}</DialogTitle>
              </DialogHeader>

              <div className="space-y-3 text-sm">
                <Field label="טלפון ראשי ואיש קשר">
                  {[selected.contactPerson, selected.phone].filter(Boolean).join(" · ") || "—"}
                </Field>
                <Field label="איש קשר לבטיחות אצל הלקוח">
                  {[selected.clientSafetyContactName, selected.clientSafetyContactPhone]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </Field>
                <Field label="ממונה בטיחות קבוע מטעמנו">
                  {selectedOfficer?.fullName ?? "לא שויך"}
                </Field>
                <Field label="טלפון הממונה">{selectedOfficer?.phone || "—"}</Field>
                <Field label="כתובת">
                  <div className="flex items-center gap-2">
                    <span>{selected.address || "—"}</span>
                    {selected.googleMapsUrl && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        render={
                          <a href={selected.googleMapsUrl} target="_blank" rel="noreferrer" />
                        }
                      >
                        <MapPinIcon />
                      </Button>
                    )}
                  </div>
                </Field>
                <Field label="ימי עבודה בשבוע">{selected.weeklyDaysCount ?? "—"}</Field>
                <Field label="תחום עיסוק">
                  {selected.industrySector ? (
                    <Badge>{INDUSTRY_SECTOR_LABELS[selected.industrySector]}</Badge>
                  ) : (
                    "—"
                  )}
                </Field>
                {selected.industrySector && (
                  <Field label="קטגוריות בטיחות פעילות (משפיע על שאלון הביקורת)">
                    <div className="flex flex-wrap gap-1.5">
                      {getIndustryCategories(selected.industrySector).map((category) => (
                        <Badge key={category} variant="outline">
                          {SAFETY_CATEGORY_LABELS[category]}
                        </Badge>
                      ))}
                    </div>
                  </Field>
                )}
                {selected.contractDocUrl && (
                  <Field label="חוזה חתום (למנהל בלבד)">
                    <Button
                      variant="outline"
                      size="sm"
                      render={<a href={selected.contractDocUrl} target="_blank" rel="noreferrer" />}
                    >
                      צפייה בחוזה
                    </Button>
                  </Field>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  render={<Link href="/admin/clients" />}
                >
                  עריכה בעמוד הלקוחות
                </Button>
                <DialogClose render={<Button type="button" />}>סגירה</DialogClose>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b pb-2 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}
