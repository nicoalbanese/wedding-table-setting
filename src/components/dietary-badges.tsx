import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { getDietaryBadges } from "@/planner/utils";

const badgeClassNames: Record<string, string> = {
  vegetarian: "border-green-800 bg-green-700 text-white",
  vegan: "border-green-800 bg-green-700 text-white",
  celiac: "border-blue-800 bg-blue-700 text-white",
  "gluten-free": "border-blue-800 bg-blue-700 text-white",
  nut: "border-orange-900 bg-orange-700 text-white",
  dairy: "border-violet-800 bg-violet-700 text-white",
  halal: "border-teal-800 bg-teal-700 text-white",
  kosher: "border-teal-800 bg-teal-700 text-white",
  other: "border-zinc-800 bg-zinc-700 text-white",
};

export function DietaryBadges({ className, compact = false, dietary }: { className?: string; compact?: boolean; dietary: string }) {
  const { t } = useI18n();
  const badges = getDietaryBadges(dietary);
  if (badges.length === 0) return null;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center justify-end gap-1",
        compact && "flex-nowrap justify-center gap-0.5",
        className,
      )}
      aria-label={`${t.fields.dietary}: ${dietary}`}
    >
      {badges.slice(0, compact ? 2 : 4).map((badge) => (
        <Badge
          className={cn(
            "h-6 min-w-8 rounded-md border px-1.5 py-0 text-xs leading-none font-black tracking-normal uppercase",
            compact && "h-4 min-w-5 rounded px-1 text-[10px]",
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
