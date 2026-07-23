"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

const LINKS = [
  { href: "/admin", label: "דשבורד" },
  { href: "/admin/clients", label: "לקוחות" },
  { href: "/admin/officers", label: "ממוני בטיחות" },
  { href: "/admin/schedule", label: "לוח שיבוצים" },
  { href: "/admin/hazards", label: "מפגעים" },
  { href: "/admin/directory", label: "דפי תקשורת" },
  { href: "/admin/safety-docs", label: "מסמכי בטיחות" },
];

export function AdminNav() {
  const pathname = usePathname();
  const { user, signOutUser } = useAuth();

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <nav className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active =
              link.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(link.href);
            return (
              <Button
                key={link.href}
                render={<Link href={link.href} />}
                variant={active ? "secondary" : "ghost"}
                size="sm"
              >
                {link.label}
              </Button>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="hidden sm:inline">{user?.email}</span>
          <Button variant="outline" size="sm" onClick={() => signOutUser()}>
            התנתקות
          </Button>
        </div>
      </div>
    </header>
  );
}
