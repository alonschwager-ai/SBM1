"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { UserRole, useAuth } from "@/lib/auth-context";

const HOME_ROUTE_BY_ROLE: Record<UserRole, string> = {
  admin: "/admin",
  safety_officer: "/officer/dashboard",
};

export function RouteGuard({
  allowedRole,
  children,
}: {
  allowedRole: UserRole;
  children: React.ReactNode;
}) {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (role && role !== allowedRole) {
      router.replace(HOME_ROUTE_BY_ROLE[role]);
    }
  }, [user, role, loading, allowedRole, router]);

  if (loading || !user || role !== allowedRole) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        טוען...
      </div>
    );
  }

  return <>{children}</>;
}
