import { ChevronDown, Globe } from "lucide-react";
import { ThemeSwitch } from "@/components/theme/theme-switch";

/** Rendered server-side, so it reflects render time rather than the viewer's clock. */
function formatToday(): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date());
}

/**
 * The thin near-black strip above the masthead. Stays inverted in both themes,
 * so it paints from the inverse tokens. The theme switch is the one live
 * control here - the edition picker and location are static until those
 * features exist - and it stays visible at every width, since it is the only
 * way to change the theme.
 */
export function UtilityBar() {
  return (
    <div className="bg-inverse-surface">
      <div className="container-biasly flex h-9 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <span className="text-caption hidden text-inverse-text/70 md:inline">
            Browser Extension
          </span>

          <div className="flex items-center gap-2">
            {/* Dropped below sm so the switch and the date share 375px without
                overflowing the bar. */}
            <span className="text-caption hidden text-inverse-text/70 sm:inline">
              Theme:
            </span>
            <ThemeSwitch />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-6">
          <span className="text-caption text-inverse-text/70">
            {formatToday()}
          </span>
          <span className="text-caption hidden text-inverse-text/70 sm:inline">
            Set Location
          </span>
          <span className="text-caption hidden items-center gap-1.5 text-inverse-text sm:inline-flex">
            <Globe size={12} strokeWidth={2} aria-hidden />
            International Edition
            <ChevronDown size={12} strokeWidth={2} aria-hidden />
          </span>
        </div>
      </div>
    </div>
  );
}
