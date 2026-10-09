import type { Impact } from "@/lib/calendar/types";

const labels: Record<Impact, string> = {
  high: "ខ្លាំង",
  medium: "មធ្យម",
  low: "ខ្សោយ",
};

const styles: Record<Impact, string> = {
  high: "bg-[#e53935] text-white",
  medium: "bg-[#f9a825] text-[#3e2b00] [&_i:last-child]:opacity-25",
  low: "bg-[#29a3c7] text-white [&_i:nth-child(n+2)]:opacity-25",
};

export default function ImpactBadge({ impact }: { impact: Impact }) {
  return (
    <span className={`inline-flex items-center gap-[5px] rounded px-1.5 py-0.5 text-[14px] font-normal leading-[1.8] whitespace-nowrap ${styles[impact]}`}>
      <span className="inline-flex h-[11px] items-end gap-0.5 [&>i]:block [&>i]:w-0.5 [&>i]:rounded-[1px] [&>i]:bg-current [&>i:first-child]:h-1 [&>i:nth-child(2)]:h-[7px] [&>i:last-child]:h-2.5" aria-hidden="true">
        <i /><i /><i />
      </span>
      {labels[impact]}
    </span>
  );
}
