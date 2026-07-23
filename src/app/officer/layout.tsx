import { RouteGuard } from "@/components/route-guard";
import { OfficerNav } from "@/components/officer/officer-nav";

export default function OfficerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard allowedRole="safety_officer">
      <OfficerNav />
      {children}
    </RouteGuard>
  );
}
