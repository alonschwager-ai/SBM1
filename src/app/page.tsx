"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export default function RootPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (role === "admin") {
      router.replace("/admin");
    } else if (role === "safety_officer") {
      router.replace("/officer/dashboard");
    }
  }, [user, role, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      טוען...
    </div>
  );
}
