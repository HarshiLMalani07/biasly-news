import Image from "next/image";

export type ArticleHeroProps = {
  imageUrl: string;
  imageAlt: string;
  caption: string;
  credit: string;
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

      <figcaption className="text-caption mt-2 text-text-secondary">
        <span className="block">{caption}</span>
        <span className="block">{credit}</span>
      </figcaption>
    </figure>
  );
}
