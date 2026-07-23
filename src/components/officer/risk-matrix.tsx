"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type RiskLevel = "low" | "medium" | "high" | "critical";

const LEVEL_LABELS: Record<RiskLevel, string> = {
  low: "סיכון נמוך",
  medium: "סיכון בינוני",
  high: "סיכון גבוה",
  critical: "סיכון קריטי",
};

// Standard 5x5 risk-matrix bucketing: score = likelihood x severity (1-25).
const LEVEL_CLASSES: Record<RiskLevel, string> = {
  low: "bg-emerald-500 text-white",
  medium: "bg-amber-400 text-amber-950",
  high: "bg-orange-500 text-white",
  critical: "bg-red-600 text-white",
};

function riskLevel(score: number): RiskLevel {
  if (score <= 4) return "low";
  if (score <= 9) return "medium";
  if (score <= 15) return "high";
  return "critical";
}

const SCALE = [1, 2, 3, 4, 5];

export function RiskMatrix() {
  const [likelihood, setLikelihood] = useState<number | null>(null);
  const [severity, setSeverity] = useState<number | null>(null);

  const score = likelihood && severity ? likelihood * severity : null;
  const level = score ? riskLevel(score) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>מטריצת הערכת סיכונים</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <div className="text-sm font-medium">סבירות (Likelihood)</div>
          <div className="grid grid-cols-5 gap-1.5">
            {SCALE.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setLikelihood(value)}
                className={cn(
                  "min-h-11 rounded-lg border text-sm font-semibold transition",
                  likelihood === value
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-sm font-medium">חומרה (Severity)</div>
          <div className="grid grid-cols-5 gap-1.5">
            {SCALE.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSeverity(value)}
                className={cn(
                  "min-h-11 rounded-lg border text-sm font-semibold transition",
                  severity === value
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-sm font-medium">מפת חום (סבירות × חומרה)</div>
          <div className="grid grid-cols-5 gap-1">
            {SCALE.slice()
              .reverse()
              .map((sev) =>
                SCALE.map((lik) => {
                  const cellScore = sev * lik;
                  const isSelected = likelihood === lik && severity === sev;
                  return (
                    <div
                      key={`${sev}-${lik}`}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded text-[0.65rem] font-semibold",
                        LEVEL_CLASSES[riskLevel(cellScore)],
                        isSelected && "ring-2 ring-offset-2 ring-foreground"
                      )}
                    >
                      {cellScore}
                    </div>
                  );
                })
              )}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <span className="text-sm text-muted-foreground">תוצאה</span>
          {level && score ? (
            <Badge className={LEVEL_CLASSES[level]}>
              {LEVEL_LABELS[level]} ({score})
            </Badge>
          ) : (
            <Badge variant="outline">יש לבחור סבירות וחומרה</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
