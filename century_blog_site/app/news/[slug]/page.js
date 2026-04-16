import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PostEngagement } from "@/components/site/PostEngagement";
import { PostShareBar } from "@/components/site/PostShareBar";
import { SiteFooter } from "@/components/site/SiteFooter";
import { getEngagementBySlug } from "@/lib/engagement-store";
import { getPostBySlug, getPosts } from "@/lib/posts-store";
import {
  buildBreadcrumbJsonLd,
  buildPostKeywords,
  extractMentionedCountries,
  formatLongDate,
  getCategoryMeta,
  getDisplayMedia,
  getRenderableContent,
  getSiteUrl,
  isImageMedia,
  normalizeStoredText,
  toAbsoluteUrl
} from "@/lib/site";

export const dynamic = "force-dynamic";

async function getLocalPostFallback(slug) {
  try {
    const filePath = path.join(process.env.INIT_CWD || process.cwd(), "data", "posts.json");
    const payload = JSON.parse(await fs.readFile(filePath, "utf8"));

    if (!Array.isArray(payload)) {
      return null;
    }

    const post = payload.find((entry) => entry?.slug === slug);

    if (!post) {
      return null;
    }

    return {
      ...post,
      title: normalizeStoredText(post.title),
      excerpt: normalizeStoredText(post.excerpt),
      content: normalizeStoredText(post.content),
      author: normalizeStoredText(post.author) || "Century Blog Editorial Team",
      type: post.type || "manual",
      readTime: post.readTime || "1 min read",
      coverStyle: post.coverStyle || "cover-violet"
    };
  } catch {
    return null;
  }
}

async function getPostForSlug(slug) {
  return (await getPostBySlug(slug)) || getLocalPostFallback(slug);
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await getPostForSlug(slug);

  if (!post) {
    return {
      title: "Post Not Found"
    };
  }

  const siteUrl = getSiteUrl();
  const countries = extractMentionedCountries(`${post.title} ${post.excerpt} ${post.content}`);
  const metadata = {
    title: post.title,
    description: post.excerpt,
    keywords: buildPostKeywords(post),
    authors: [{ name: post.author || "Century Blog Editorial Team" }],
    category: getCategoryMeta(post.category).label,
    alternates: {
      canonical: `/news/${post.slug}`
    },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `${siteUrl}/news/${post.slug}`,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt || post.publishedAt,
      section: getCategoryMeta(post.category).label,
      authors: [post.author || "Century Blog Editorial Team"],
      tags: countries
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt
    }
  };

  if (isImageMedia(post.mediaUrl, post.mediaType)) {
    const imageUrl = toAbsoluteUrl(post.mediaUrl);
    metadata.openGraph.images = [{ url: imageUrl, alt: post.title }];
    metadata.twitter.images = [imageUrl];
  }

  return metadata;
}

export default async function PostPage({ params }) {
  const { slug } = await params;
  const post = await getPostForSlug(slug);

  if (!post) {
    notFound();
  }

  let engagement = { slug, likes: 0, comments: [] };

  try {
    engagement = await getEngagementBySlug(slug);
  } catch {
    engagement = { slug, likes: 0, comments: [] };
  }

  const allPosts = await getPosts();
  const currentCountries = extractMentionedCountries(`${post.title} ${post.excerpt} ${post.content}`);
  const relatedPosts = allPosts
    .filter((candidate) => candidate.slug !== post.slug)
    .filter(
      (candidate) =>
        candidate.category === post.category ||
        extractMentionedCountries(`${candidate.title} ${candidate.excerpt}`).some((country) =>
          currentCountries.includes(country)
        )
    )
    .slice(0, 3);
  const siteUrl = getSiteUrl();
  const categoryMeta = getCategoryMeta(post.category);
  const articleMedia = getDisplayMedia(post, "article");
  const renderedContent = getRenderableContent(post);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.excerpt,
      datePublished: post.publishedAt,
      dateModified: post.updatedAt || post.publishedAt,
      keywords: buildPostKeywords(post).join(", "),
      articleSection: categoryMeta.label,
      about: currentCountries.map((country) => ({
        "@type": "Place",
        name: country
      })),
      author: {
        "@type": "Organization",
        name: post.author || "Century Blog Editorial Team"
      },
      publisher: {
        "@type": "Organization",
        name: "Century Blog"
      },
      mainEntityOfPage: `${siteUrl}/news/${post.slug}`,
      image: isImageMedia(post.mediaUrl, post.mediaType) ? [toAbsoluteUrl(post.mediaUrl)] : undefined
    },
    buildBreadcrumbJsonLd([
      { name: "Home", url: siteUrl },
      { name: categoryMeta.label, url: `${siteUrl}/category/${post.category}` },
      { name: post.title, url: `${siteUrl}/news/${post.slug}` }
    ])
  ];

  return (
    <main className="page-shell article-shell">
      <article className="article">
        <div className={`article-hero ${post.coverStyle}`}>
          <Link href="/" className="back-home-button back-home-button--article">
            Back to Home
          </Link>
          <span className="pill">{categoryMeta.label}</span>
          <h1>{post.title}</h1>
          <p className="article-excerpt">{post.excerpt}</p>
          <div className="article-meta">
            <span>{formatLongDate(post.publishedAt)}</span>
            <span>{post.readTime}</span>
            <span>{post.author || "Century Blog Editorial Team"}</span>
          </div>
        </div>

        {articleMedia.kind !== "none" ? (
          <div className="article-media-wrap">
            {articleMedia.kind === "video" ? (
              <video
                className="article-media"
                controls
                preload="metadata"
                playsInline
                poster={articleMedia.posterUrl || undefined}
              >
                <source src={articleMedia.url} type={articleMedia.type} />
              </video>
            ) : (
              <img className="article-media" src={articleMedia.url} alt={post.title} />
            )}
            {post.imageCreditName || post.imageCreditUrl ? (
              <p className="article-media__credit">
                Media credit: {post.imageCreditUrl ? (
                  <a href={post.imageCreditUrl} target="_blank" rel="noreferrer">
                    {post.imageCreditName || "Source"}
                  </a>
                ) : (
                  post.imageCreditName
                )}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="article-body blog-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{renderedContent}</ReactMarkdown>
        </div>
      </article>

      {relatedPosts.length ? (
        <section className="section-card article-related">
          <span className="eyebrow">Keep Reading</span>
          <h2>Related stories readers may also enjoy</h2>
          <div className="article-related__links">
            {relatedPosts.map((relatedPost) => (
              <Link key={relatedPost.slug} href={`/news/${relatedPost.slug}`} className="article-related__item">
                <strong>{relatedPost.title}</strong>
                <span>{relatedPost.excerpt}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <PostEngagement slug={post.slug} initialEngagement={engagement} />
      <PostShareBar post={post} />
      <SiteFooter showSocial={false} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  );
}


