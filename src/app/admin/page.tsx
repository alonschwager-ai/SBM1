"use client";

import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CertAlertBar } from "@/components/admin/cert-alert-bar";
import { HazardCategoryWidget } from "@/components/admin/hazard-category-widget";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [officerCount, setOfficerCount] = useState<number | null>(null);
  const [clientCount, setClientCount] = useState<number | null>(null);
  const [expiringCount, setExpiringCount] = useState<number | null>(null);

  useEffect(() => {
    const officersQuery = query(
      collection(db, "users"),
      where("role", "==", "safety_officer")
    );
    const unsubscribeOfficers = onSnapshot(officersQuery, (snapshot) => {
      setOfficerCount(snapshot.size);
      setExpiringCount(
        snapshot.docs.filter((doc) => {
          const status = doc.data().certStatus;
          return status === "expired" || status === "expiring_soon";
        }).length
      );
    });

    const unsubscribeClients = onSnapshot(collection(db, "clients"), (snapshot) => {
      setClientCount(snapshot.size);
    });

    return () => {
      unsubscribeOfficers();
      unsubscribeClients();
    };
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">דשבורד מנהל</h1>
      <CertAlertBar />
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/admin/officers">
          <Card className="transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle className="text-3xl">{officerCount ?? "—"}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              ממוני בטיחות
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/clients">
          <Card className="transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle className="text-3xl">{clientCount ?? "—"}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">לקוחות</CardContent>
          </Card>
        </Link>
        <Link href="/admin/schedule">
          <Card className="transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle className="text-3xl">{expiringCount ?? "—"}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              תעודות שפגות/פגות בקרוב
            </CardContent>
          </Card>
        </Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <HazardCategoryWidget />
        <Card>
          <CardHeader>
            <CardTitle>ברוך הבא, {user?.email}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            נהל לקוחות, עובדים ולוח שיבוצים מהתפריט למעלה.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
