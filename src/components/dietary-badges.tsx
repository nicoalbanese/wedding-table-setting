import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getDietaryBadges } from "@/planner/utils";

const badgeClassNames: Record<string, string> = {
  vegetarian: "border-[#095f35] bg-[#0f7a45] text-white",
  vegan: "border-[#095f35] bg-[#0f7a45] text-white",
  celiac: "border-[#0f448f] bg-[#1559b7] text-white",
  "gluten-free": "border-[#0f448f] bg-[#1559b7] text-white",
  nut: "border-[#7c2d12] bg-[#9a3412] text-white",
  dairy: "border-[#5b21b6] bg-[#6d28d9] text-white",
  halal: "border-[#115e59] bg-[#0f766e] text-white",
  kosher: "border-[#115e59] bg-[#0f766e] text-white",
  other: "border-[#27272a] bg-[#3f3f46] text-white",
};

export function DietaryBadges({ compact = false, dietary }: { compact?: boolean; dietary: string }) {
  const badges = getDietaryBadges(dietary);
  if (badges.length === 0) return null;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center justify-end gap-1",
        compact && "justify-center gap-0.5",
      )}
      aria-label={`Dietary: ${dietary}`}
    >
      {badges.slice(0, compact ? 2 : 4).map((badge) => (
        <Badge
          className={cn(
            "h-6 min-w-[30px] rounded-[5px] border px-[5px] py-0 text-xs leading-none font-black tracking-normal uppercase",
            compact && "h-[18px] min-w-6 rounded px-1 text-[11px]",
            badgeClassNames[badge.className] ?? badgeClassNames.other,
          )}
          key={badge.code}
          title={dietary.trim()}
        >
          {badge.code}
        </Badge>
      ))}
    </div>
  );
}
