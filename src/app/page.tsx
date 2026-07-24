"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeftIcon, Building2Icon, HardHatIcon, ShieldCheckIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const PORTALS = [
  {
    href: "/login?portal=officer",
    icon: HardHatIcon,
    title: "כניסת עובד / ממונה בטיחות",
    description: "צפייה בשיבוצים, מילוי דוחות ביקורת וניהול הלקוחות שלך.",
    cta: "כניסה כממונה בטיחות",
  },
  {
    href: "/login?portal=admin",
    icon: Building2Icon,
    title: "כניסת מעסיק / מנהל מערכת",
    description: "ניהול לקוחות, עובדים, לוח שיבוצים ומעקב בטיחות בארגון.",
    cta: "כניסה כמנהל מערכת",
  },
];

export default function RootPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;
    if (role === "admin") {
      router.replace("/admin");
    } else if (role === "safety_officer") {
      router.replace("/officer/dashboard");
    }
  }, [user, role, loading, router]);

  // Already signed in - the effect above is about to redirect to the
  // right dashboard, so just show a loading state instead of the portal
  // picker below.
  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        טוען...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <ShieldCheckIcon className="size-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ניהול ממוני בטיחות</h1>
          <p className="mt-1 text-sm text-muted-foreground">מערכת ניהול לשירותי ממוני בטיחות</p>
        </div>
      </div>

      <div className="w-full max-w-2xl space-y-3">
        <p className="text-center text-sm font-medium text-muted-foreground">
          בחרו את סוג הכניסה שלכם למערכת
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {PORTALS.map(({ href, icon: Icon, title, description, cta }) => (
            <Link
              key={href}
              href={href}
              className="group focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-xl"
            >
              <Card className="h-full border-2 transition-all duration-200 group-hover:-translate-y-1 group-hover:border-primary group-hover:shadow-lg">
                <CardHeader>
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="size-6" />
                  </div>
                  <CardTitle className="pt-2 text-lg">{title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{description}</p>
                  <span
                    className={cn(
                      buttonVariants({ size: "lg" }),
                      "w-full justify-between"
                    )}
                  >
                    {cta}
                    <ArrowLeftIcon className="size-4 transition-transform group-hover:-translate-x-1" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
