import { ChevronRight } from "lucide-react";
import { Chip } from "@/components/ui/chip";

const topics = [
  "World Cup",
  "IPL",
  "Social Media",
  "Business & Markets",
  "Health & Medicine",
  "Soccer",
  "Artificial Intelligence",
  "Arsenal FC",
  "Extreme Weather and Disasters",
] as const;

/**
 * The followable-topic rail under the masthead. Scrolls with CSS only - the
 * chevron marks the overflow and is not a control.
 */
export function TopicRail() {
  return (
    <div className="border-y border-border bg-surface">
      <div className="container-biasly relative py-2">
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {topics.map((topic) => (
            <Chip key={topic} label={topic} className="shrink-0" />
          ))}
          {/* Keeps the last chip clear of the chevron's fade. */}
          <span aria-hidden className="w-8 shrink-0" />
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 flex items-center bg-linear-to-l from-surface from-60% to-transparent pr-6 pl-8"
        >
          <ChevronRight size={16} strokeWidth={2} className="text-text-secondary" />
        </div>
      </div>
    </div>
  );
}
