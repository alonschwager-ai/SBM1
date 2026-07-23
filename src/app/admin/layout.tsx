import { RouteGuard } from "@/components/route-guard";
import { AdminNav } from "@/components/admin/admin-nav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard allowedRole="admin">
      <AdminNav />
      <main className="mx-auto max-w-5xl space-y-4 p-4">{children}</main>
    </RouteGuard>
  );
}
