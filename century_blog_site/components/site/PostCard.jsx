import Image from "next/image";
import Link from "next/link";
import { formatLongDate, getCategoryMeta, getDisplayMedia } from "@/lib/site";

export function PostCard({ post }) {
  const category = getCategoryMeta(post.category);
  const media = getDisplayMedia(post, "card");
  const hasImage = media.kind === "image";
  const hasVideo = media.kind === "video";

  return (
    <article className="post-card">
      <div className={`post-card__cover ${post.coverStyle}`}>
        {hasImage ? (
          <div className="post-card__media-shell">
            <Image
              src={media.url}
              alt={post.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="post-card__media post-card__image"
              unoptimized={String(media.url || "").startsWith("data:")}
            />
          </div>
        ) : null}
        {hasVideo ? (
          <video
            className="post-card__media post-card__video"
            muted
            playsInline
            preload="metadata"
            poster={media.posterUrl || undefined}
          >
            <source src={media.url} type={media.type} />
          </video>
        ) : null}
        <div className="post-card__pills">
          <span className="pill">{category.label}</span>
        </div>
      </div>
      <div className="post-card__body">
        <p className="muted">
          {formatLongDate(post.publishedAt)} | {post.readTime}
        </p>
        <h3>{post.title}</h3>
        <p>{post.excerpt}</p>
        {post.sourceName ? <p className="post-card__source">Source: {post.sourceName}</p> : null}
        <Link href={`/news/${post.slug}`} className="text-link">
          Continue reading
        </Link>
      </div>
    </article>
  );
}
