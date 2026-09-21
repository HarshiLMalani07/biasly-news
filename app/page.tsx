import {
  BarChart3,
  Bell,
  Bookmark,
  Calendar,
  CircleCheck,
  Clock,
  Ellipsis,
  ExternalLink,
  Info,
  Menu,
  Search,
  Share,
  SlidersHorizontal,
  Tag,
  User,
} from "lucide-react";
import { Panel, Subhead } from "./_components/panel";
import { Logo } from "@/components/brand/logo";
import { BiasMeter } from "@/components/bias/bias-meter";
import { ArticleCard } from "@/components/news/article-card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Separator } from "@/components/ui/separator";

/* ---------------------------------------------------------------- COLORS */

type Swatch = { name: string; hex: string; className: string };

const primaryColors: Swatch[] = [
  { name: "Text Primary", hex: "#0D0D0F", className: "bg-text-primary" },
  { name: "Text Secondary", hex: "#6B7280", className: "bg-text-secondary" },
  { name: "Surface", hex: "#F6F6F6", className: "bg-surface" },
];

const semanticColors: Swatch[] = [
  { name: "Left Bias", hex: "#B42318", className: "bg-bias-left" },
  { name: "Center", hex: "#E5E7EB", className: "bg-bias-center" },
  { name: "Right Bias", hex: "#1D4ED8", className: "bg-bias-right" },
];

const neutralColors: Swatch[] = [
  { name: "BG Primary", hex: "#FFFFFF", className: "bg-bg-primary" },
  { name: "BG Secondary", hex: "#F0F0F0", className: "bg-bg-secondary" },
  { name: "Border", hex: "#E5E7EB", className: "bg-border" },
  { name: "Divider", hex: "#E5E7EB", className: "bg-divider" },
];

function SwatchGroup({
  label,
  items,
  columns,
}: {
  label: string;
  items: Swatch[];
  columns: 3 | 4;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Subhead>{label}</Subhead>
      <div
        className={
          columns === 4 ? "grid grid-cols-4 gap-2" : "grid grid-cols-3 gap-2"
        }
      >
        {items.map((swatch) => (
          <div key={swatch.name} className="flex w-full flex-col gap-2">
            <div
              className={`h-14 w-full rounded-md border border-border ${swatch.className}`}
            />
            <div className="flex flex-col">
              <span className="text-caption uppercase text-text-primary">
                {swatch.name}
              </span>
              <span className="text-caption text-text-secondary">
                {swatch.hex}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ TYPOGRAPHY */

type TypeRow = {
  style: string;
  sample: string;
  size: string;
  weight: string;
  lineHeight: string;
  className: string;
  labelClassName: string;
};

const typeScale: TypeRow[] = [
  {
    style: "H1",
    sample: "Page / Screen Title",
    size: "32px",
    weight: "Bold",
    lineHeight: "1.2",
    className: "text-body-sm",
    labelClassName: "text-h1",
  },
  {
    style: "H2",
    sample: "Section Title",
    size: "24px",
    weight: "SemiBold",
    lineHeight: "1.3",
    className: "text-body-sm",
    labelClassName: "text-h2",
  },
  {
    style: "H3",
    sample: "Card / Module Title",
    size: "20px",
    weight: "SemiBold",
    lineHeight: "1.3",
    className: "text-body-sm",
    labelClassName: "text-h3",
  },
  {
    style: "H4",
    sample: "Subheading",
    size: "16px",
    weight: "Medium",
    lineHeight: "1.4",
    className: "text-body-sm",
    labelClassName: "text-h4",
  },
  {
    style: "Body Large",
    sample: "Important content",
    size: "16px",
    weight: "Regular",
    lineHeight: "1.6",
    className: "text-body-lg",
    labelClassName: "text-body-sm font-semibold",
  },
  {
    style: "Body Medium",
    sample: "Body text",
    size: "14px",
    weight: "Regular",
    lineHeight: "1.6",
    className: "text-body-md",
    labelClassName: "text-body-sm font-semibold",
  },
  {
    style: "Body Small",
    sample: "Supporting text",
    size: "13px",
    weight: "Regular",
    lineHeight: "1.6",
    className: "text-body-sm",
    labelClassName: "text-body-sm font-semibold",
  },
  {
    style: "Caption",
    sample: "Labels, meta text",
    size: "11px",
    weight: "Regular",
    lineHeight: "1.4",
    className: "text-caption",
    labelClassName: "text-body-sm font-semibold",
  },
];

/* ----------------------------------------------------------------- ICONS */

const icons = [
  { name: "Menu", Icon: Menu },
  { name: "Search", Icon: Search },
  { name: "Bookmark", Icon: Bookmark },
  { name: "Clock", Icon: Clock },
  { name: "Info", Icon: Info },
  { name: "Share", Icon: Share },
  { name: "External link", Icon: ExternalLink },
  { name: "Calendar", Icon: Calendar },
  { name: "Analytics", Icon: BarChart3 },
  { name: "Tag", Icon: Tag },
  { name: "User", Icon: User },
  { name: "Bell", Icon: Bell },
  { name: "Filters", Icon: SlidersHorizontal },
  { name: "Check", Icon: CircleCheck },
  { name: "More", Icon: Ellipsis },
];

/* --------------------------------------------------------------- SPACING */

const spacingScale = [4, 8, 16, 24, 32, 40, 64];

const shadowTokens = [
  { name: "Small", value: "0px 1px 2px rgba(0,0,0,0.05)", className: "shadow-sm" },
  { name: "Medium", value: "0px 4px 12px rgba(0,0,0,0.08)", className: "shadow-md" },
  { name: "Large", value: "0px 12px 24px rgba(0,0,0,0.12)", className: "shadow-lg" },
];

const radiusTokens = [
  { name: "Small", value: "4px", className: "rounded-sm" },
  { name: "Medium", value: "8px", className: "rounded-md" },
  { name: "Large", value: "12px", className: "rounded-lg" },
  { name: "Full", value: "9999px", className: "rounded-full" },
];

/* ------------------------------------------------------------------ PAGE */

export default function Home() {
  return (
    <main className="min-h-screen bg-bg-secondary py-8">
      <div className="mx-auto flex w-full max-w-[1536px] flex-col gap-6 px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3.4fr)_minmax(0,4.3fr)_minmax(0,4.6fr)]">
          {/* Column 1 — Brand + Colors */}
          <div className="flex min-w-0 flex-col gap-6">
            <Panel title="Brand">
              <div className="flex flex-col items-center gap-4 py-6">
                <Logo size="lg" />
                <p className="text-body-md max-w-56 text-center text-text-secondary">
                  Balanced news coverage, powered by AI.
                </p>
              </div>
            </Panel>

            <Panel title="Colors">
              <div className="flex min-w-0 flex-col gap-6">
                <SwatchGroup label="Primary" items={primaryColors} columns={3} />
                <SwatchGroup label="Semantic" items={semanticColors} columns={3} />
                <SwatchGroup label="Neutrals" items={neutralColors} columns={4} />
              </div>
            </Panel>
          </div>

          {/* Column 2 — Typography + Icons */}
          <div className="flex min-w-0 flex-col gap-6">
            <Panel title="Typography">
              <div className="flex min-w-0 flex-col gap-6">
                <div className="flex min-w-0 flex-col gap-2">
                  <Subhead>Font family</Subhead>
                  <p className="text-h1">Poppins</p>
                  <p className="text-body-sm max-w-72 text-text-secondary">
                    Poppins is a modern geometric sans-serif typeface that
                    ensures clarity and excellent readability.
                  </p>
                </div>

                <div className="w-full max-w-full overflow-x-auto">
                  <table className="w-full min-w-[360px] border-collapse text-left">
                    <thead>
                      <tr className="text-caption uppercase tracking-[0.1em] text-text-secondary">
                        <th className="pb-2 font-medium whitespace-nowrap">Style</th>
                        <th className="pb-2 font-medium whitespace-nowrap">Size</th>
                        <th className="pb-2 font-medium whitespace-nowrap">Weight</th>
                        <th className="pb-2 font-medium whitespace-nowrap">Line height</th>
                      </tr>
                    </thead>
                    <tbody>
                      {typeScale.map((row) => (
                        <tr
                          key={row.style}
                          className="border-t border-divider align-middle"
                        >
                          <td className="py-2 pr-4">
                            <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
                              <span
                                className={`${row.labelClassName} text-text-primary`}
                              >
                                {row.style}
                              </span>
                              <span
                                className={`${row.className} text-text-secondary`}
                              >
                                {row.sample}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 pr-4 text-body-sm text-text-primary">
                            {row.size}
                          </td>
                          <td className="py-2 pr-4 text-body-sm text-text-primary">
                            {row.weight}
                          </td>
                          <td className="py-2 text-body-sm text-text-primary">
                            {row.lineHeight}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Panel>

            <Panel title="Icons">
              <div className="flex min-w-0 flex-col gap-4">
                <div className="grid grid-cols-5 gap-4">
                  {icons.map(({ name, Icon }) => (
                    <div
                      key={name}
                      title={name}
                      className="flex items-center justify-center py-2 text-text-primary"
                    >
                      <Icon size={24} strokeWidth={2} aria-hidden />
                    </div>
                  ))}
                </div>
                <Separator className="bg-divider" />
                <p className="text-body-sm text-text-secondary">
                  Line style &middot; 2px stroke &middot; Rounded caps
                </p>
              </div>
            </Panel>
          </div>

          {/* Column 3 — UI elements + Card */}
          <div className="flex min-w-0 flex-col gap-6">
            <Panel title="UI Elements">
              <div className="flex min-w-0 flex-col gap-6">
                <div className="flex min-w-0 flex-col gap-3">
                  <Subhead>Buttons</Subhead>
                  <div className="w-full max-w-full overflow-x-auto">
                    <table className="w-full min-w-[380px] border-collapse">
                      <thead>
                        <tr className="text-caption text-text-secondary">
                          <th className="w-24 pb-2 text-left font-medium" />
                          <th className="pb-2 font-medium whitespace-nowrap">Default</th>
                          <th className="pb-2 font-medium whitespace-nowrap">Hover</th>
                          <th className="pb-2 font-medium whitespace-nowrap">Outline</th>
                          <th className="pb-2 font-medium whitespace-nowrap">Disabled</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="py-2 pr-2 text-body-sm text-text-secondary">
                            Primary
                          </td>
                          <td className="px-1 py-2 text-center">
                            <Button variant="primary">Button</Button>
                          </td>
                          <td className="px-1 py-2 text-center">
                            <Button variant="primary" forceHover>
                              Button
                            </Button>
                          </td>
                          <td className="px-1 py-2 text-center">
                            <Button variant="outline">Button</Button>
                          </td>
                          <td className="px-1 py-2 text-center">
                            <Button variant="primary" disabled>
                              Button
                            </Button>
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 pr-2 text-body-sm text-text-secondary">
                            Secondary
                          </td>
                          <td className="px-1 py-2 text-center">
                            <Button variant="secondary">Button</Button>
                          </td>
                          <td className="px-1 py-2 text-center">
                            <Button variant="secondary" forceHover>
                              Button
                            </Button>
                          </td>
                          <td className="px-1 py-2 text-center">
                            <Button variant="outline">Button</Button>
                          </td>
                          <td className="px-1 py-2 text-center">
                            <Button variant="secondary" disabled>
                              Button
                            </Button>
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 pr-2 text-body-sm text-text-secondary">
                            Text
                          </td>
                          <td className="px-1 py-2 text-center">
                            <Button variant="text">Button</Button>
                          </td>
                          <td className="px-1 py-2 text-center">
                            <Button variant="text" forceHover>
                              Button
                            </Button>
                          </td>
                          <td className="px-1 py-2 text-center text-body-md text-text-secondary">
                            &mdash;
                          </td>
                          <td className="px-1 py-2 text-center text-body-md text-text-secondary">
                            &mdash;
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex min-w-0 flex-col gap-3">
                  <Subhead>Chip / Category</Subhead>
                  <div className="flex flex-wrap gap-2">
                    <Chip label="World Cup" />
                    <Chip label="IPL" />
                    <Chip label="Business & Markets" />
                    <Chip label="More" />
                  </div>
                </div>

                <div className="flex min-w-0 flex-col gap-3">
                  <Subhead>Bias meter</Subhead>
                  <BiasMeter left={25} center={50} right={25} variant="full" />
                </div>
              </div>
            </Panel>

            <Panel title="Card Example">
              <ArticleCard
                category="Politics"
                country="United States"
                title="Trump Sends Iran Revised Peace Proposal With Tougher Terms: Report"
                description="The proposal includes stricter limits on uranium enrichment and enhanced verification measures."
                imageUrl="/demo/article-placeholder.png"
                imageAlt="Placeholder image for the sample news article"
                publishedLabel="2h ago"
                readTimeLabel="12 min read"
                bias={{ left: 25, center: 26, right: 49 }}
                className="border-border"
              />
            </Panel>
          </div>
        </div>

        {/* Bottom row — spacing, grid, shadows, radius */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_1.15fr_0.85fr_0.85fr]">
          <Panel title="Spacing System (4px base unit)" className="lg:col-span-1">
            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-wrap items-end gap-4">
                {spacingScale.map((step) => (
                  <div key={step} className="flex flex-col items-center gap-2">
                    <div
                      style={{ width: step, height: step }}
                      className="rounded-sm bg-bias-right/20"
                    />
                    <span className="text-caption text-text-secondary">
                      {step}px
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-body-sm text-text-secondary">
                Consistent spacing scale based on 4px base unit
              </p>
            </div>
          </Panel>

          <Panel title="Grid System">
            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex h-32 w-full gap-1 overflow-hidden">
                {Array.from({ length: 12 }, (_, column) => (
                  <div
                    key={column}
                    className="h-full flex-1 rounded-sm bg-bias-right/20"
                  />
                ))}
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-caption">
                <div>
                  <dt className="text-text-primary">Container</dt>
                  <dd className="text-text-secondary">1280px</dd>
                </div>
                <div>
                  <dt className="text-text-primary">Columns</dt>
                  <dd className="text-text-secondary">12</dd>
                </div>
                <div>
                  <dt className="text-text-primary">Gutter</dt>
                  <dd className="text-text-secondary">24px</dd>
                </div>
                <div>
                  <dt className="text-text-primary">Margin</dt>
                  <dd className="text-text-secondary">24px</dd>
                </div>
              </dl>
            </div>
          </Panel>

          <Panel title="Shadows">
            <div className="flex min-w-0 flex-col gap-4">
              {shadowTokens.map((token) => (
                <div key={token.name} className="flex items-center gap-4">
                  <div
                    className={`size-10 shrink-0 rounded-md bg-bg-primary ${token.className}`}
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-caption uppercase text-text-primary">
                      {token.name}
                    </span>
                    <span className="text-caption break-words text-text-secondary">
                      {token.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Border Radius">
            <div className="flex min-w-0 flex-col gap-4">
              {radiusTokens.map((token) => (
                <div key={token.name} className="flex items-center gap-4">
                  <div
                    className={`size-10 shrink-0 border border-border bg-bg-primary shadow-sm ${token.className}`}
                  />
                  <div className="flex flex-1 items-center justify-between gap-4">
                    <span className="text-caption uppercase text-text-primary">
                      {token.name}
                    </span>
                    <span className="text-caption text-text-secondary">
                      {token.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-8 bg-text-primary py-8">
        <div className="mx-auto flex w-full max-w-[1536px] flex-col items-start gap-6 px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Logo size="sm" inverted />
            <p className="text-body-sm max-w-48 text-bg-primary/70">
              Balanced news coverage, powered by AI.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-body-sm text-bg-primary/70">
            <span>Design System v1.0</span>
            <span>June 1, 2026</span>
          </div>
          <p className="text-body-sm text-bg-primary/70">
            Stay consistent. Stay unbiased.
          </p>
        </div>
      </footer>
    </main>
  );
}
