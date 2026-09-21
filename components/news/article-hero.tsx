import Image from "next/image";

export type ArticleHeroProps = {
  imageUrl: string;
  imageAlt: string;
  /** Neither caption nor credit is stored yet (AGENTS.md section 7). */
  caption?: string | null;
  credit?: string | null;
};

/** The lead photograph with its caption and photo credit. */
export function ArticleHero({
  imageUrl,
  imageAlt,
  caption,
  credit,
}: ArticleHeroProps) {
  return (
    <figure className="mt-4">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md">
        <Image
          src={imageUrl}
          alt={imageAlt}
          fill
          priority
          sizes="(min-width: 1024px) 832px, 100vw"
          className="object-cover"
        />
      </div>

      {caption || credit ? (
        <figcaption className="text-caption mt-2 text-text-secondary">
          {caption ? <span className="block">{caption}</span> : null}
          {credit ? <span className="block">{credit}</span> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}
