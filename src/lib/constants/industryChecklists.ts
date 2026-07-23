import { IndustrySector, SafetyCategory } from "@/lib/types";

export interface ChecklistItem {
  id: string;
  category: SafetyCategory;
  label: string;
}

// Single source of truth for which safety checklist an officer fills out
// during a visit, based on the client's industry sector. Each sector's
// active SafetyCategory list (used to group the checklist UI and to seed
// the "create hazard" category default) is derived from this - see
// getIndustryCategories() below - rather than maintained as a second,
// hand-kept list that could drift out of sync with the items themselves.
export const INDUSTRY_CHECKLISTS: Record<IndustrySector, ChecklistItem[]> = {
  high_tech_field: [
    { id: "htf-1", category: "ENVIRONMENT_CLIMATE", label: "עבודה בשמש/עומס חום - זמינות צל ומים" },
    { id: "htf-2", category: "ENVIRONMENT_CLIMATE", label: "ציוד עזר מותאם לעבודה בשטח (כובע, קרם הגנה)" },
    { id: "htf-3", category: "ROAD_SAFETY", label: "תקינות רכב השטח ורישיון נהיגה מתאים" },
    { id: "htf-4", category: "ROAD_SAFETY", label: "חגורות בטיחות ונהיגה בטוחה בשטח פתוח" },
    { id: "htf-5", category: "FIRE_EVACUATION", label: "שילוט יציאות חירום ונתיבי מילוט" },
    { id: "htf-6", category: "FIRE_EVACUATION", label: "תקינות מטפי כיבוי אש" },
  ],
  office_corporate: [
    { id: "oc-1", category: "ERGONOMICS_HEALTH", label: "תקינות עמדות עבודה (כיסא, מסך, מקלדת)" },
    { id: "oc-2", category: "ERGONOMICS_HEALTH", label: "תאורה נאותה בעמדות העבודה" },
    { id: "oc-3", category: "FIRE_EVACUATION", label: "שילוט יציאות חירום ותרגילי פינוי" },
    { id: "oc-4", category: "FIRE_EVACUATION", label: "נגישות תקינה למטפי כיבוי אש" },
    { id: "oc-5", category: "MACHINERY_FOOD", label: "תקינות לוחות חשמל ואי-החסמת גישה אליהם" },
    { id: "oc-6", category: "MACHINERY_FOOD", label: "בדיקת מפסק פחת (RCD) תקופתית" },
  ],
  logistics_warehousing: [
    { id: "lw-1", category: "LOGISTICS_LIFTING", label: "תקינות מלגזות ורישיון מפעיל בתוקף" },
    { id: "lw-2", category: "LOGISTICS_LIFTING", label: "יציבות מידוף ועמידה בעומסי אחסון מותרים" },
    { id: "lw-3", category: "FIRE_EVACUATION", label: "מרווחי בטיחות פנויים סביב ציוד כיבוי אש" },
    { id: "lw-4", category: "FIRE_EVACUATION", label: "שילוט ונתיבי מילוט פנויים ממכשולים" },
    { id: "lw-5", category: "ENVIRONMENT_CLIMATE", label: "אוורור ותנאי עבודה במחסני קירור/חימום" },
  ],
  labs_industry: [
    { id: "li-1", category: "HAZMAT_LABS", label: "אחסון תקין של חומרים מסוכנים ותיוג מתאים" },
    { id: "li-2", category: "HAZMAT_LABS", label: "זמינות מקלחות חירום ומתקני שטיפת עיניים" },
    { id: "li-3", category: "MACHINERY_FOOD", label: "תקינות מכונות וגנרטורים בהתאם לתקן" },
    { id: "li-4", category: "MACHINERY_FOOD", label: "בדיקת הארקה ותקינות לוחות חשמל" },
    { id: "li-5", category: "FIRE_EVACUATION", label: "זמינות ותקינות ציוד כיבוי אש ייעודי לחומרים מסוכנים" },
  ],
  food_hospitality: [
    { id: "fh-1", category: "MACHINERY_FOOD", label: "תקינות ציוד מטבח (כיריים, טוסטרים, פרייזרים)" },
    { id: "fh-2", category: "MACHINERY_FOOD", label: "בדיקת מערכת כיבוי אש ייעודית למטבח" },
    { id: "fh-3", category: "FIRE_EVACUATION", label: "שילוט ונתיבי מילוט פנויים באולם ובמטבח" },
    { id: "fh-4", category: "ERGONOMICS_HEALTH", label: "ציוד מגן אישי לעובדי מטבח (כפפות חום, נעליים)" },
  ],
};

/** The SafetyCategory list relevant to a sector, in first-seen checklist order. */
export function getIndustryCategories(sector: IndustrySector): SafetyCategory[] {
  const seen = new Set<SafetyCategory>();
  for (const item of INDUSTRY_CHECKLISTS[sector]) seen.add(item.category);
  return [...seen];
}

/** Look up a single checklist item by id within a sector's list. */
export function getIndustryChecklistItem(
  sector: IndustrySector,
  itemId: string
): ChecklistItem | undefined {
  return INDUSTRY_CHECKLISTS[sector].find((item) => item.id === itemId);
}
