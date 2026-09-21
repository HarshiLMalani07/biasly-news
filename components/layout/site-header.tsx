import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

type NavItem = {
  label: string;
  href: string;
  active?: boolean;
  /** Draws the small unread dot the mock shows on "For You". */
  dot?: boolean;
};

const navItems: NavItem[] = [
  { label: "Home", href: "/", active: true },
  { label: "For You", href: "/for-you", dot: true },
  { label: "Local", href: "/local" },
  { label: "Blindspot", href: "/blindspot" },
];

/**
 * Masthead: menu, wordmark, section nav, and the auth buttons. The nav targets
 * and the buttons are inert until those routes and Clerk exist.
 */
export function SiteHeader() {
  return (
    <header className="bg-surface">
      <div className="container-biasly flex h-18 items-center justify-between gap-4">
        <div className="flex h-full items-center gap-8">
          <div className="flex items-center gap-4">
            <Button
              variant="text"
              size="icon"
              aria-label="Open menu"
              className="-ml-2"
            >
              <Menu size={24} strokeWidth={2} aria-hidden className="size-6" />
            </Button>
            <Link href="/" aria-label="biasly News home">
              <Logo size="sm" />
            </Link>
          </div>

          <nav
            aria-label="Sections"
            className="hidden h-full items-stretch gap-8 lg:flex"
          >
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className={
                  item.active
                    ? "relative flex items-center border-b-2 border-text-primary text-body-md font-medium text-text-primary"
                    : "relative flex items-center border-b-2 border-transparent text-body-md text-text-secondary transition-colors hover:text-text-primary"
                }
              >
                {/* The link stretches the header's full height so its underline
                    sits on the bottom edge, so the dot anchors to the label. */}
                <span className="relative">
                  {item.label}
                  {item.dot ? (
                    <span
                      aria-hidden
                      className="absolute -top-1 -right-2 size-1.5 rounded-full bg-bias-left"
                    />
                  ) : null}
                </span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="primary" className="hidden sm:inline-flex">
            Subscribe
          </Button>
          <Button variant="secondary">Login</Button>
        </div>
      </div>
    </header>
  );
}
