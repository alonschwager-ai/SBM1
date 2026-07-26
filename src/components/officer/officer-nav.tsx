"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

const LINKS = [
  { href: "/officer/dashboard", label: "שיבוצים" },
  { href: "/officer/calendar", label: "לוח שנה" },
  { href: "/officer/workplaces", label: "לקוחות" },
  { href: "/officer/tools", label: "כלים" },
  { href: "/officer/profile", label: "פרופיל" },
];

export function OfficerNav() {
  const pathname = usePathname();
  const { signOutUser } = useAuth();

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-2 py-2">
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {LINKS.map((link) => (
            <Button
              key={link.href}
              render={<Link href={link.href} />}
              variant={pathname.startsWith(link.href) ? "secondary" : "ghost"}
              size="sm"
              className="min-h-11 shrink-0"
            >
              {link.label}
            </Button>
          ))}
        </nav>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 shrink-0"
          onClick={() => signOutUser()}
        >
          יציאה
        </Button>
      </div>
    </header>
  );
}
