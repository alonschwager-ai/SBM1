import { Badge } from "@/components/ui/badge";
import { CERT_STATUS_LABELS, CertStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const VARIANT_CLASS: Record<CertStatus, string> = {
  expired: "bg-destructive/10 text-destructive",
  expiring_soon: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  valid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  none: "",
};

export function CertStatusBadge({
  status,
  className,
}: {
  status: CertStatus;
  className?: string;
}) {
  return (
    <Badge
      variant={status === "none" ? "outline" : undefined}
      className={cn(VARIANT_CLASS[status], className)}
    >
      {CERT_STATUS_LABELS[status]}
    </Badge>
  );
}
