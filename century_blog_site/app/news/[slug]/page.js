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

  return {
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

  return (
    <main className="page-shell article-shell">
      <article className="article">
        <div className={`article-hero ${post.coverStyle}`}>
          <span className="pill">{getCategoryMeta(post.category).label}</span>
          <h1>{post.title}</h1>
          <p className="article-excerpt">{post.excerpt}</p>
          <div className="article-meta">
            <span>{formatLongDate(post.publishedAt)}</span>
            <span>{post.readTime}</span>
            <span>{post.author || "Century Blog Editorial Team"}</span>
          </div>
        </div>

        <div className="article-body">
          {post.content.split("\n\n").map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        {post.sourceUrl ? (
          <div className="source-box">
            <h2>Source</h2>
            <p>
              This story was adapted from reporting by{" "}
              <a href={post.sourceUrl} target="_blank" rel="noreferrer">
                {post.sourceName}
              </a>
              .
            </p>
          </div>
        ) : null}
      </article>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  );
}
