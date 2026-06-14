import { Badge } from "@/components/ui/badge";
import { getDietaryBadges } from "@/planner/utils";

export function DietaryBadges({ compact = false, dietary }: { compact?: boolean; dietary: string }) {
  const badges = getDietaryBadges(dietary);
  if (badges.length === 0) return null;

  return (
    <div className={`dietary-badges ${compact ? "compact" : ""}`} aria-label={`Dietary: ${dietary}`}>
      {badges.slice(0, compact ? 2 : 4).map((badge) => (
        <Badge className={`dietary-badge ${badge.className}`} key={badge.code} title={dietary.trim()}>
          {badge.code}
        </Badge>
      ))}
    </div>
  );
}
