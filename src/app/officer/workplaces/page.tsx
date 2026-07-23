"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { MapPinIcon, PhoneIcon, TriangleAlertIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HazardResolveDialog, HazardRow } from "@/components/hazard-resolve-dialog";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import {
  ClientDoc,
  HAZARD_SEVERITY_LABELS,
  HazardDoc,
  INDUSTRY_SECTOR_LABELS,
  IndustrySector,
} from "@/lib/types";

type ClientRow = ClientDoc & { id: string };

export default function OfficerWorkplacesPage() {
  const { user } = useAuth();
  const [byPrimary, setByPrimary] = useState<Record<string, ClientRow>>({});
  const [bySchedule, setBySchedule] = useState<Record<string, ClientRow>>({});
  const [openHazards, setOpenHazards] = useState<HazardRow[]>([]);
  const [resolving, setResolving] = useState<HazardRow | null>(null);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(query(collection(db, "hazards"), where("userId", "==", user.uid)), (snapshot) => {
      setOpenHazards(
        snapshot.docs
          .map((d) => ({ id: d.id, ...(d.data() as HazardDoc) }))
          .filter((h) => h.status !== "RESOLVED")
      );
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsubPrimary = onSnapshot(
      query(collection(db, "clients"), where("assignedOfficerId", "==", user.uid)),
      (snapshot) => {
        setByPrimary(
          Object.fromEntries(
            snapshot.docs.map((d) => [d.id, { id: d.id, ...(d.data() as ClientDoc) }])
          )
        );
      }
    );
    const unsubSchedule = onSnapshot(
      query(collection(db, "clients"), where("assignedOfficerIds", "array-contains", user.uid)),
      (snapshot) => {
        setBySchedule(
          Object.fromEntries(
            snapshot.docs.map((d) => [d.id, { id: d.id, ...(d.data() as ClientDoc) }])
          )
        );
      }
    );
    return () => {
      unsubPrimary();
      unsubSchedule();
    };
  }, [user]);

  const clients = useMemo(
    () => Object.values({ ...bySchedule, ...byPrimary }).sort((a, b) => a.companyName.localeCompare(b.companyName, "he")),
    [byPrimary, bySchedule]
  );

  const clientNameById = useMemo(() => new Map(clients.map((c) => [c.id, c.companyName])), [clients]);

  return (
    <div className="mx-auto max-w-md space-y-3 p-4">
      <h1 className="text-xl font-bold">הממשקים שלי</h1>

      {openHazards.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-base">
              <TriangleAlertIcon className="size-4 text-destructive" />
              מפגעים פתוחים שלי
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {openHazards.map((hazard) => (
              <div key={hazard.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm">
                <div>
                  <div className="font-medium">{clientNameById.get(hazard.clientId) ?? "לקוח"}</div>
                  <div className="text-muted-foreground">
                    {HAZARD_SEVERITY_LABELS[hazard.severity]} · {hazard.description}
                  </div>
                </div>
                <Button size="sm" onClick={() => setResolving(hazard)}>
                  סימון כטופל
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {clients.length === 0 && (
        <p className="text-sm text-muted-foreground">עדיין לא שויכו אליך לקוחות</p>
      )}
      {clients.map((client) => {
        const mapsUrl =
          client.googleMapsUrl ||
          (client.address
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}`
            : undefined);
        const callPhone = client.clientSafetyContactPhone || client.phone;

        return (
          <Card key={client.id}>
            <CardHeader>
              <CardTitle>{client.companyName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {client.industrySector && (
                <Badge variant="outline">
                  {INDUSTRY_SECTOR_LABELS[client.industrySector as IndustrySector]}
                </Badge>
              )}
              {(client.contactPerson || client.phone) && (
                <div>
                  איש קשר ראשי: {[client.contactPerson, client.phone].filter(Boolean).join(" · ")}
                </div>
              )}
              {(client.clientSafetyContactName || client.clientSafetyContactPhone) && (
                <div>
                  איש קשר לבטיחות:{" "}
                  {[client.clientSafetyContactName, client.clientSafetyContactPhone]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              )}
              {client.address && <div>כתובת: {client.address}</div>}
              {typeof client.weeklyDaysCount === "number" && (
                <div>ימי עבודה בשבוע: {client.weeklyDaysCount}</div>
              )}

              <div className="flex gap-2 pt-2">
                {mapsUrl && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    render={<a href={mapsUrl} target="_blank" rel="noreferrer" />}
                  >
                    <MapPinIcon data-icon="inline-start" />
                    ניווט ב-Google Maps
                  </Button>
                )}
                {callPhone && (
                  <Button className="flex-1" render={<a href={`tel:${callPhone}`} />}>
                    <PhoneIcon data-icon="inline-start" />
                    התקשרות
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <HazardResolveDialog hazard={resolving} onClose={() => setResolving(null)} />
    </div>
  );
}
