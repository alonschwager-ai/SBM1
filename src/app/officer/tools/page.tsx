"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, QuerySnapshot, where } from "firebase/firestore";
import { FileTextIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskMatrix } from "@/components/officer/risk-matrix";
import { SosWidget } from "@/components/officer/sos-widget";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { INDUSTRY_SECTOR_LABELS, IndustrySector, SafetyDocDoc } from "@/lib/types";

type SafetyDocRow = SafetyDocDoc & { id: string };

function addSectors(prev: Set<IndustrySector>, snapshot: QuerySnapshot): Set<IndustrySector> {
  const next = new Set(prev);
  snapshot.forEach((doc) => {
    const sector = doc.data().industrySector;
    if (sector) next.add(sector);
  });
  return next;
}

export default function OfficerToolsPage() {
  const { user } = useAuth();
  const [activeSectors, setActiveSectors] = useState<Set<IndustrySector>>(new Set());
  const [docs, setDocs] = useState<SafetyDocRow[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsubPrimary = onSnapshot(
      query(collection(db, "clients"), where("assignedOfficerId", "==", user.uid)),
      (snapshot) => {
        setActiveSectors((prev) => addSectors(prev, snapshot));
      }
    );
    const unsubSchedule = onSnapshot(
      query(collection(db, "clients"), where("assignedOfficerIds", "array-contains", user.uid)),
      (snapshot) => {
        setActiveSectors((prev) => addSectors(prev, snapshot));
      }
    );
    return () => {
      unsubPrimary();
      unsubSchedule();
    };
  }, [user]);

  useEffect(() => {
    return onSnapshot(collection(db, "safetyDocs"), (snapshot) => {
      setDocs(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as SafetyDocDoc) })));
    });
  }, []);

  // Fall back to every sector when the officer has no assigned clients yet
  // (or none with a sector set), so the hub isn't empty for new officers.
  const visibleDocs = useMemo(
    () =>
      activeSectors.size > 0 ? docs.filter((d) => activeSectors.has(d.sector)) : docs,
    [docs, activeSectors]
  );

  const docsBySector = useMemo(() => {
    const grouped = new Map<IndustrySector, SafetyDocRow[]>();
    for (const safetyDoc of visibleDocs) {
      const list = grouped.get(safetyDoc.sector) ?? [];
      list.push(safetyDoc);
      grouped.set(safetyDoc.sector, list);
    }
    return grouped;
  }, [visibleDocs]);

  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-24">
      <h1 className="text-xl font-bold">ארגז הכלים</h1>

      <Card>
        <CardHeader>
          <CardTitle>מסמכי בטיחות והנחיות</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {docsBySector.size === 0 && (
            <p className="text-sm text-muted-foreground">אין מסמכים זמינים כרגע</p>
          )}
          {[...docsBySector.entries()].map(([sector, sectorDocs]) => (
            <div key={sector} className="space-y-1.5">
              <div className="text-sm font-semibold text-muted-foreground">
                {INDUSTRY_SECTOR_LABELS[sector]}
              </div>
              <div className="space-y-1.5">
                {sectorDocs.map((safetyDoc) => (
                  <div
                    key={safetyDoc.id}
                    className="flex min-h-11 items-center justify-between gap-2 rounded-lg border p-2.5 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <FileTextIcon className="size-4 text-muted-foreground" />
                      {safetyDoc.title}
                    </span>
                    {safetyDoc.fileUrl ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-11"
                        render={<a href={safetyDoc.fileUrl} target="_blank" rel="noreferrer" />}
                      >
                        צפייה
                      </Button>
                    ) : (
                      <Badge variant="outline">בקרוב</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <RiskMatrix />

      <SosWidget />
    </div>
  );
}
