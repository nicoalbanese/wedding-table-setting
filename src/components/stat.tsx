export function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid min-h-[52px] gap-0.5 border-r border-[#d8d1c2] px-3 py-[9px] last:border-r-0 max-sm:[&:nth-child(2)]:border-r-0 max-sm:[&:nth-child(n+3)]:border-t">
      <strong className="text-[22px] leading-none">{value}</strong>
      <span className="text-xs text-[#6f6a60]">{label}</span>
    </div>
  );
}
