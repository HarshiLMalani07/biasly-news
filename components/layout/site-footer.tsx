import { Logo } from "@/components/brand/logo";
import {
  InstagramIcon,
  LinkedInIcon,
  XIcon,
  YouTubeIcon,
} from "@/components/brand/social-icons";

type FooterColumn = {
  heading: string;
  links: readonly string[];
};

const footerColumns: readonly FooterColumn[] = [
  { heading: "Company", links: ["About", "Careers", "Press", "Contact"] },
  {
    heading: "Help",
    links: ["Help Center", "Guides", "Privacy Policy", "Terms of Service"],
  },
];

const socialLinks = [
  { name: "X", Icon: XIcon },
  { name: "LinkedIn", Icon: LinkedInIcon },
  { name: "Instagram", Icon: InstagramIcon },
  { name: "YouTube", Icon: YouTubeIcon },
] as const;

/** Dark site footer. Every link is a placeholder until those pages exist. */
export function SiteFooter() {
  return (
    <footer className="mt-auto bg-text-primary">
      <div className="container-biasly py-10">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo size="sm" inverted />
            <p className="text-body-sm mt-4 max-w-40 text-bg-primary/60">
              Balanced news coverage powered by AI.
            </p>
          </div>

          {footerColumns.map((column) => (
            <div key={column.heading}>
              <h2 className="text-body-sm font-semibold text-bg-primary">
                {column.heading}
              </h2>
              <ul className="mt-4 flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-body-sm text-bg-primary/60 transition-colors hover:text-bg-primary"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h2 className="text-body-sm font-semibold text-bg-primary">
              Connect
            </h2>
            <ul className="mt-4 flex items-center gap-4">
              {socialLinks.map(({ name, Icon }) => (
                <li key={name}>
                  <a
                    href="#"
                    aria-label={`biasly News on ${name}`}
                    className="inline-flex text-bg-primary/70 transition-colors hover:text-bg-primary"
                  >
                    <Icon className="size-[18px]" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-bg-primary/10 pt-6">
          <p className="text-caption text-bg-primary/50">
            &copy; 2026 Biasly News. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
