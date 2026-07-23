"use client";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { AlertTriangleIcon, OctagonXIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { db } from "@/lib/firebase";
import { UserDoc } from "@/lib/types";

interface OfficerAlert {
  id: string;
  fullName: string;
  nearestCertExpiration: Date | null;
}

export function CertAlertBar() {
  const [expired, setExpired] = useState<OfficerAlert[]>([]);
  const [expiringSoon, setExpiringSoon] = useState<OfficerAlert[]>([]);

  useEffect(() => {
    const officersQuery = query(
      collection(db, "users"),
      where("role", "==", "safety_officer")
    );

    const unsubscribe = onSnapshot(officersQuery, (snapshot) => {
      const nextExpired: OfficerAlert[] = [];
      const nextExpiringSoon: OfficerAlert[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data() as UserDoc;
        const alert: OfficerAlert = {
          id: doc.id,
          fullName: data.fullName,
          nearestCertExpiration: data.nearestCertExpiration?.toDate() ?? null,
        };
        if (data.certStatus === "expired") nextExpired.push(alert);
        else if (data.certStatus === "expiring_soon") nextExpiringSoon.push(alert);
      });

      setExpired(nextExpired);
      setExpiringSoon(nextExpiringSoon);
    });

    return unsubscribe;
  }, []);

  if (expired.length === 0 && expiringSoon.length === 0) return null;

  return (
    <div className="space-y-2">
      {expired.length > 0 && (
        <Alert variant="destructive">
          <OctagonXIcon />
          <AlertTitle>תעודות שפג תוקפן</AlertTitle>
          <AlertDescription>
            {expired
              .map(
                (officer) =>
                  `${officer.fullName}${
                    officer.nearestCertExpiration
                      ? ` (${officer.nearestCertExpiration.toLocaleDateString("he-IL")})`
                      : ""
                  }`
              )
              .join(", ")}
          </AlertDescription>
        </Alert>
      )}
      {expiringSoon.length > 0 && (
        <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-400">
          <AlertTriangleIcon />
          <AlertTitle>תעודות שיפוגו בקרוב</AlertTitle>
          <AlertDescription className="text-amber-800/80 dark:text-amber-400/80">
            {expiringSoon
              .map(
                (officer) =>
                  `${officer.fullName}${
                    officer.nearestCertExpiration
                      ? ` (${officer.nearestCertExpiration.toLocaleDateString("he-IL")})`
                      : ""
                  }`
              )
              .join(", ")}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
