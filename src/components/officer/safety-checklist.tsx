"use client";

import { TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChecklistItem,
  INDUSTRY_CHECKLISTS,
  getIndustryCategories,
} from "@/lib/constants/industryChecklists";
import {
  CHECKLIST_STATUS_LABELS,
  ChecklistStatus,
  IndustrySector,
  SAFETY_CATEGORY_LABELS,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export interface ChecklistEntryState {
  status: ChecklistStatus;
  note: string;
}

const STATUS_ORDER: ChecklistStatus[] = ["pass", "fail", "na"];

// The `!` (important) prefix is required here: the outline variant already
// sets its own `bg-background`, and plain utility classes appended via
// `className` aren't guaranteed to win over a variant's classes based on
// where each utility happens to land in Tailwind's generated stylesheet.
const STATUS_ACTIVE_CLASS: Record<ChecklistStatus, string> = {
  pass: "!bg-emerald-600 !text-white !border-transparent hover:!bg-emerald-600",
  fail: "!bg-destructive !text-white !border-transparent hover:!bg-destructive",
  na: "!bg-gray-500 !text-white !border-transparent hover:!bg-gray-500",
};

export function SafetyChecklist({
  industrySector,
  results,
  onStatusChange,
  onNoteChange,
  onCreateHazard,
}: {
  industrySector: IndustrySector;
  results: Record<string, ChecklistEntryState>;
  onStatusChange: (item: ChecklistItem, status: ChecklistStatus) => void;
  onNoteChange: (itemId: string, note: string) => void;
  onCreateHazard: (item: ChecklistItem) => void;
}) {
  const categories = getIndustryCategories(industrySector);
  const items = INDUSTRY_CHECKLISTS[industrySector];

  return (
    <div className="space-y-4">
      {categories.map((category) => (
        <div key={category} className="space-y-2.5">
          <h4 className="text-sm font-semibold text-muted-foreground">
            {SAFETY_CATEGORY_LABELS[category]}
          </h4>
          {items
            .filter((item) => item.category === category)
            .map((item) => {
              const entry = results[item.id];
              return (
                <div key={item.id} className="space-y-2 rounded-lg border p-3">
                  <p className="text-sm">{item.label}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {STATUS_ORDER.map((status) => (
                      <Button
                        key={status}
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn(entry?.status === status && STATUS_ACTIVE_CLASS[status])}
                        onClick={() => onStatusChange(item, status)}
                      >
                        {CHECKLIST_STATUS_LABELS[status]}
                      </Button>
                    ))}
                    {entry?.status === "fail" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => onCreateHazard(item)}
                      >
                        <TriangleAlertIcon data-icon="inline-start" />
                        יצירת מפגע
                      </Button>
                    )}
                  </div>
                  <Input
                    placeholder="הערה (לא חובה)"
                    value={entry?.note ?? ""}
                    onChange={(e) => onNoteChange(item.id, e.target.value)}
                  />
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
}
