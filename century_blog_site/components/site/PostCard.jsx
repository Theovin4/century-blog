import Link from "next/link";
import { formatLongDate, getCategoryMeta, getPostTypeMeta, isImageMedia, isVideoMedia } from "@/lib/site";

export function PostCard({ post }) {
  const category = getCategoryMeta(post.category);
  const postType = getPostTypeMeta(post.type || "manual");
  const hasImage = isImageMedia(post.mediaUrl, post.mediaType);
  const hasVideo = isVideoMedia(post.mediaUrl, post.mediaType);

  return (
    <article className="post-card">
      <div className={`post-card__cover ${post.coverStyle}`}>
        {hasImage ? (
          <img
            src={post.mediaUrl}
            alt={post.title}
            className="post-card__media post-card__image"
            loading="lazy"
            decoding="async"
          />
        ) : null}
        {hasVideo ? (
          <video
            className="post-card__media post-card__video"
            muted
            playsInline
            preload="metadata"
            poster={post.posterUrl || undefined}
          >
            <source src={post.mediaUrl} type={post.mediaType} />
          </video>
        ) : null}
        <div className="post-card__pills">
          <span className="pill">{category.label}</span>
          <span className={`pill pill-type pill-type--${post.type || "manual"}`}>{postType.label}</span>
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
