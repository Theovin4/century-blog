import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostBySlug, getPosts } from "@/lib/posts-store";
import { formatLongDate, getCategoryMeta, getSiteUrl } from "@/lib/site";

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return {
      title: "Post Not Found"
    };
  }

  const metadata = {
    title: post.title,
    description: post.excerpt,
    alternates: {
      canonical: `/news/${post.slug}`
    },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `${getSiteUrl()}/news/${post.slug}`,
      type: "article",
      publishedTime: post.publishedAt,
      section: getCategoryMeta(post.category).label
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt
    }
  };

  if (post.mediaUrl && post.mediaType?.startsWith("image/")) {
    metadata.openGraph.images = [{ url: post.mediaUrl, alt: post.title }];
    metadata.twitter.images = [post.mediaUrl];
  }

  return metadata;
}

export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export default async function PostPage({ params }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    author: {
      "@type": "Organization",
      name: "Century Blog"
    },
    publisher: {
      "@type": "Organization",
      name: "Century Blog"
    },
    mainEntityOfPage: `${getSiteUrl()}/news/${post.slug}`,
    articleSection: getCategoryMeta(post.category).label
  };

  if (post.mediaUrl && post.mediaType?.startsWith("image/")) {
    jsonLd.image = [post.mediaUrl];
  }

  return (
    <main className="page-shell article-shell">
      <article className="article">
        <div className={`article-hero ${post.coverStyle}`}>
          <Link href="/" className="back-home-button back-home-button--article">
            Back to Home
          </Link>
          <span className="pill">{getCategoryMeta(post.category).label}</span>
          <h1>{post.title}</h1>
          <p className="article-excerpt">{post.excerpt}</p>
          <div className="article-meta">
            <span>{formatLongDate(post.publishedAt)}</span>
            <span>{post.readTime}</span>
            <span>{post.author || "Century Blog Editorial Team"}</span>
          </div>
        </div>

        {post.mediaUrl ? (
          <div className="article-media-wrap">
            {post.mediaType?.startsWith("video/") ? (
              <video className="article-media" controls preload="metadata">
                <source src={post.mediaUrl} type={post.mediaType} />
              </video>
            ) : (
              <img className="article-media" src={post.mediaUrl} alt={post.title} />
            )}
          </div>
        ) : null}

        <div className="article-body">
          {post.content.split("\n\n").map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </article>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  );
}
