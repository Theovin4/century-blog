import Link from "next/link";
import { formatLongDate, getCategoryMeta } from "@/lib/site";

export function PostCard({ post }) {
  const category = getCategoryMeta(post.category);

  return (
    <article className="post-card">
      <div className={`post-card__cover ${post.coverStyle}`}>
        <span className="pill">{category.label}</span>
      </div>
      <div className="post-card__body">
        <p className="muted">
          {formatLongDate(post.publishedAt)} | {post.readTime}
        </p>
        <h3>{post.title}</h3>
        <p>{post.excerpt}</p>
        <Link href={`/news/${post.slug}`} className="text-link">
          Continue reading
        </Link>
      </div>
    </article>
  );
}
