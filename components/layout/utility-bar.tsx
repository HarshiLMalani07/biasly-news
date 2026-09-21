import { ChevronDown, Globe } from "lucide-react";

const themeOptions = ["Light", "Dark", "Auto"] as const;

/** Rendered server-side, so it reflects render time rather than the viewer's clock. */
function formatToday(): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date());
}

/**
 * The thin near-black strip above the masthead. Presentational only: the theme
 * switch and edition picker are static labels until those features exist.
 */
export function UtilityBar() {
  return (
    <div className="bg-text-primary">
      <div className="container-biasly flex h-9 items-center justify-between">
        <div className="hidden items-center gap-6 md:flex">
          <span className="text-caption text-bg-primary/70">
            Browser Extension
          </span>

          <div className="flex items-center gap-2">
            <span className="text-caption text-bg-primary/70">Theme:</span>
            {themeOptions.map((option) => (
              <span
                key={option}
                className={
                  option === "Light"
                    ? "text-caption font-semibold text-bg-primary"
                    : "text-caption text-bg-primary/60"
                }
              >
                {option}
              </span>
            ))}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-6">
          <span className="text-caption text-bg-primary/70">
            {formatToday()}
          </span>
          <span className="hidden text-caption text-bg-primary/70 sm:inline">
            Set Location
          </span>
          <span className="hidden items-center gap-1.5 text-caption text-bg-primary sm:inline-flex">
            <Globe size={12} strokeWidth={2} aria-hidden />
            International Edition
            <ChevronDown size={12} strokeWidth={2} aria-hidden />
          </span>
        </div>
      </div>
    </div>
  );
}
