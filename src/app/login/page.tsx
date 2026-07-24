"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { Building2Icon, HardHatIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";

type Portal = "officer" | "admin";

const PORTAL_COPY: Record<Portal, { title: string; subtitle: string }> = {
  officer: {
    title: "כניסת ממונה בטיחות",
    subtitle: "שיבוצים, דוחות ביקורת והלקוחות שלך",
  },
  admin: {
    title: "כניסת מנהל מערכת",
    subtitle: "ניהול לקוחות, עובדים ולוח שיבוצים",
  },
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          טוען...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { signIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPortal = searchParams.get("portal") === "admin" ? "admin" : "officer";

  const [portal, setPortal] = useState<Portal>(initialPortal);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      // The account's real role (not the portal tab selected here, which
      // is just a copy/branding hint) decides where "/" sends them next -
      // see RootPage and RouteGuard.
      router.replace("/");
    } catch {
      setError("אימייל או סיסמה שגויים");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-4">
          <Tabs value={portal} onValueChange={(v) => setPortal((v as Portal) ?? "officer")}>
            <TabsList className="w-full">
              <TabsTrigger value="officer" className="flex-1 gap-1.5">
                <HardHatIcon className="size-4" />
                ממונה בטיחות
              </TabsTrigger>
              <TabsTrigger value="admin" className="flex-1 gap-1.5">
                <Building2Icon className="size-4" />
                מנהל מערכת
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div>
            <CardTitle>{PORTAL_COPY[portal].title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{PORTAL_COPY[portal].subtitle}</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">סיסמה</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "מתחבר..." : "התחברות"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
