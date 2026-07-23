"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/firebase";
import { HazardDoc, SAFETY_CATEGORY_LABELS, SafetyCategory } from "@/lib/types";

const UNCATEGORIZED = "uncategorized" as const;

interface CategoryCount {
  key: SafetyCategory | typeof UNCATEGORIZED;
  label: string;
  count: number;
}

// Counts hazards still awaiting a fix (OPEN or IN_PROGRESS - see
// /admin/hazards for the full resolution workflow), grouped by the
// SafetyCategory each was tagged with (see HazardDoc.category).
export function HazardCategoryWidget() {
  const [counts, setCounts] = useState<CategoryCount[] | null>(null);

  useEffect(() => {
    return onSnapshot(collection(db, "hazards"), (snapshot) => {
      const tally = new Map<string, number>();
      snapshot.forEach((doc) => {
        const hazard = doc.data() as HazardDoc;
        if (hazard.status === "RESOLVED") return;
        const category = hazard.category ?? UNCATEGORIZED;
        tally.set(category, (tally.get(category) ?? 0) + 1);
      });

      const rows: CategoryCount[] = [...tally.entries()]
        .map(([key, count]) => ({
          key: key as SafetyCategory | typeof UNCATEGORIZED,
          label: key === UNCATEGORIZED ? "לא מסווג" : SAFETY_CATEGORY_LABELS[key as SafetyCategory],
          count,
        }))
        .sort((a, b) => b.count - a.count);

      setCounts(rows);
    });
  }, []);

  const maxCount = counts?.[0]?.count ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>מפגעים פתוחים לפי קטגוריה</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {counts === null && <p className="text-sm text-muted-foreground">טוען...</p>}
        {counts?.length === 0 && (
          <p className="text-sm text-muted-foreground">לא נרשמו מפגעים</p>
        )}
        {counts?.map((row) => (
          <div key={row.key} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>{row.label}</span>
              <span className="font-semibold">{row.count}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-red-500"
                style={{ width: `${maxCount ? (row.count / maxCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
