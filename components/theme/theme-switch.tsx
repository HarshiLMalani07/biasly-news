"use client";

import { useId } from "react";
import { InlineScript } from "@/components/theme/inline-script";
import { useTheme } from "@/components/theme/theme-provider";
import { DEFAULT_THEME, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

/** "Auto" is the reader-facing name for the stored "system" value. */
const options = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Auto" },
] as const satisfies readonly { value: Theme; label: string }[];

/**
 * Every option renders the same class string; which one reads as selected is
 * driven by `data-active`, so the inline script below can correct the markup
 * without knowing any Tailwind classes.
 */
const optionClassName = [
  "text-caption cursor-pointer rounded-sm text-inverse-text/60 outline-none transition-colors",
  "hover:text-inverse-text",
  "data-[active=true]:font-semibold data-[active=true]:text-inverse-text",
  "focus-visible:ring-2 focus-visible:ring-inverse-text/40 focus-visible:ring-offset-2 focus-visible:ring-offset-inverse-surface",
].join(" ");

/**
 * Corrects `aria-checked` / `data-active` during HTML parsing. The server has
 * no way to know the stored choice, so it renders the default and this script
 * fixes the DOM before React hydrates - React then compares its render against
 * the corrected DOM and finds no mismatch (Next.js "preventing flash before
 * hydration", the lazy-state section). Reads the same key as the provider.
 */
function buildSwitchScript(ids: readonly (readonly [Theme, string])[]): string {
  return `{var t=null;try{t=localStorage.getItem(${JSON.stringify(
    THEME_STORAGE_KEY
  )})}catch(e){}if(t!=="light"&&t!=="dark"&&t!=="system"){t=${JSON.stringify(
    DEFAULT_THEME
  )}}${JSON.stringify(ids)}.forEach(function(p){var el=document.getElementById(p[1]);if(el){var a=p[0]===t?"true":"false";el.setAttribute("aria-checked",a);el.setAttribute("data-active",a)}})}`;
}

/**
 * The Light / Dark / Auto control in the utility bar. Carries no background of
 * its own - it inherits the bar's inverted surface.
 */
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const id = useId();

  const optionId = (value: Theme): string => `${id}-${value}`;

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="flex items-center gap-2"
    >
      {options.map((option) => {
        const selected = theme === option.value;

        return (
          <button
            key={option.value}
            id={optionId(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            data-active={selected}
            onClick={() => setTheme(option.value)}
            className={optionClassName}
            suppressHydrationWarning
          >
            {option.label}
          </button>
        );
      })}

      <InlineScript
        html={buildSwitchScript(
          options.map((option) => [option.value, optionId(option.value)] as const)
        )}
      />
    </div>
  );
}
