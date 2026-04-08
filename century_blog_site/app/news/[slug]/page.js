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
  getSiteUrl,
  isImageMedia,
  isVideoMedia,
  toAbsoluteUrl
} from "@/lib/site";

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

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

  const engagement = await getEngagementBySlug(slug);
  const allPosts = await getPosts();
  const relatedPosts = allPosts
    .filter((candidate) => candidate.slug !== post.slug)
    .filter((candidate) => candidate.category === post.category || extractMentionedCountries(`${candidate.title} ${candidate.excerpt}`).some((country) => extractMentionedCountries(`${post.title} ${post.excerpt} ${post.content}`).includes(country)))
    .slice(0, 3);
  const siteUrl = getSiteUrl();
  const categoryMeta = getCategoryMeta(post.category);
  const countries = extractMentionedCountries(`${post.title} ${post.excerpt} ${post.content}`);

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
      about: countries.map((country) => ({
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

        {post.mediaUrl ? (
          <div className="article-media-wrap">
            {isVideoMedia(post.mediaUrl, post.mediaType) ? (
              <video className="article-media" controls preload="metadata" playsInline>
                <source src={post.mediaUrl} type={post.mediaType} />
              </video>
            ) : (
              <img className="article-media" src={post.mediaUrl} alt={post.title} />
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
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
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
