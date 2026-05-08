import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AdPlaceholder } from "@/components/site/AdPlaceholder";
import { PostEngagement } from "@/components/site/PostEngagement";
import { PostShareBar } from "@/components/site/PostShareBar";
import { SiteFooter } from "@/components/site/SiteFooter";
import { getEngagementBySlug } from "@/lib/engagement-store";
import { getPostBySlug, getPosts } from "@/lib/posts-store";
import {
  getArticleDisclaimer,
  getArticleSchemaType,
  getAuthorProfile,
  buildBreadcrumbJsonLd,
  buildPostKeywords,
  extractMarkdownHeadings,
  extractMentionedCountries,
  formatLongDate,
  getCategoryMeta,
  getDisplayMedia,
  getOptimizedImageUrl,
  getProxiedImageUrl,
  getRenderableContent,
  getSensitiveSourceNote,
  getSiteUrl,
  isImageMedia,
  normalizeMarkdownContent,
  normalizeStoredText,
  slugify,
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
      content: normalizeMarkdownContent(post.content),
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
  const organizationId = `${siteUrl}#organization`;
  const categoryMeta = getCategoryMeta(post.category);
  const articleMedia = getDisplayMedia(post, "article");
  const renderedContent = getRenderableContent(post);
  const articleUrl = `${siteUrl}/news/${post.slug}`;
  const imageUrls = isImageMedia(post.mediaUrl, post.mediaType) ? [toAbsoluteUrl(post.mediaUrl)] : undefined;
  const authorProfile = getAuthorProfile(post.author);
  const articleDisclaimer = getArticleDisclaimer(post);
  const articleSchemaType = getArticleSchemaType(post);
  const updatedLabel = post.updatedAt && post.updatedAt !== post.publishedAt ? formatLongDate(post.updatedAt) : "";
  const hasSourceAttribution = Boolean(post.sourceName || post.sourceUrl);
  const sensitiveSourceNote = getSensitiveSourceNote(post);
  const contentHeadings = extractMarkdownHeadings(renderedContent).slice(0, 8);
  const headingIds = new Set();
  const toHeadingId = (value) => {
    const baseId = slugify(value || "section") || "section";

    if (!headingIds.has(baseId)) {
      headingIds.add(baseId);
      return baseId;
    }

    let suffix = 2;
    let candidate = `${baseId}-${suffix}`;

    while (headingIds.has(candidate)) {
      suffix += 1;
      candidate = `${baseId}-${suffix}`;
    }

    headingIds.add(candidate);
    return candidate;
  };
  const getNodeText = (children) =>
    React.Children.toArray(children)
      .map((child) => {
        if (typeof child === "string") {
          return child;
        }

        if (typeof child === "number") {
          return String(child);
        }

        if (React.isValidElement(child)) {
          return getNodeText(child.props?.children);
        }

        return "";
      })
      .join("")
      .trim();
  const markdownComponents = {
    img({ src, alt = "" }) {
      const resolvedSrc = toAbsoluteUrl(src || "");

      if (!resolvedSrc) {
        return null;
      }

      const fallbackToFeaturedImage = /source\.unsplash\.com/i.test(resolvedSrc) && articleMedia?.kind === "image" && articleMedia?.url;
      const targetSrc = fallbackToFeaturedImage ? articleMedia.url : resolvedSrc;
      const candidateSrc = fallbackToFeaturedImage ? targetSrc : getProxiedImageUrl(resolvedSrc);
      const displaySrc = isImageMedia(candidateSrc) ? getOptimizedImageUrl(candidateSrc, {
        width: 1400,
        height: 900,
        fit: "fit"
      }) : candidateSrc;

      return (
        <img
          className="blog-content__image"
          src={displaySrc}
          alt={alt || post.title}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      );
    },
    a({ href, children, ...props }) {
      const resolvedHref = href ? toAbsoluteUrl(href) : "";
      const isExternal = /^https?:\/\//i.test(resolvedHref) && !resolvedHref.startsWith(siteUrl);
      const childText = Array.isArray(children) ? children.join("").trim() : String(children || "").trim();
      const shouldRenderAsImage = resolvedHref && isImageMedia(resolvedHref) && (!childText || childText === href || childText === resolvedHref);

      if (shouldRenderAsImage) {
        const fallbackToFeaturedImage = /source\.unsplash\.com/i.test(resolvedHref) && articleMedia?.kind === "image" && articleMedia?.url;
        const targetSrc = fallbackToFeaturedImage ? articleMedia.url : resolvedHref;
        const proxiedSrc = fallbackToFeaturedImage ? targetSrc : getProxiedImageUrl(targetSrc);
        const displaySrc = getOptimizedImageUrl(proxiedSrc, {
          width: 1400,
          height: 900,
          fit: "fit"
        });

        return (
          <img
            className="blog-content__image"
            src={displaySrc}
            alt={post.title}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        );
      }

      return (
        <a
          href={resolvedHref || href}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noreferrer" : undefined}
          {...props}
        >
          {children}
        </a>
      );
    },
    h2({ children, ...props }) {
      const text = getNodeText(children);
      return (
        <h2 id={toHeadingId(text)} {...props}>
          {children}
        </h2>
      );
    },
    h3({ children, ...props }) {
      const text = getNodeText(children);
      return (
        <h3 id={toHeadingId(text)} {...props}>
          {children}
        </h3>
      );
    }
  };
  const authorEntity = {
    "@type": "Organization",
    name: post.author || "Century Blog Editorial Team",
    url: `${siteUrl}/about`
  };

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": articleSchemaType,
      headline: post.title,
      alternativeHeadline: post.excerpt,
      description: post.excerpt,
      datePublished: post.publishedAt,
      dateModified: post.updatedAt || post.publishedAt,
      keywords: buildPostKeywords(post).join(", "),
      articleSection: categoryMeta.label,
      inLanguage: "en-NG",
      isAccessibleForFree: true,
      author: authorEntity,
      creator: [authorEntity],
      copyrightHolder: {
        "@id": organizationId
      },
      about: currentCountries.map((country) => ({
        "@type": "Place",
        name: country
      })),
      publisher: {
        "@id": organizationId
      },
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": articleUrl
      },
      image: imageUrls,
      thumbnailUrl: imageUrls,
      url: articleUrl,
      isPartOf: {
        "@id": `${siteUrl}#website`
      },
      sourceOrganization: post.sourceName ? {
        "@type": "Organization",
        name: post.sourceName,
        url: post.sourceUrl || undefined
      } : undefined,
      citation: post.sourceUrl ? [post.sourceUrl] : undefined
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
            <span>Published {formatLongDate(post.publishedAt)}</span>
            {updatedLabel ? <span>Updated {updatedLabel}</span> : null}
            <span>{post.readTime}</span>
            <span>{authorProfile.name}</span>
            <span>{categoryMeta.label}</span>
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
          {contentHeadings.length >= 2 ? (
            <aside className="source-box source-box--toc">
              <span className="eyebrow">In This Article</span>
              <ul className="source-box__list">
                {contentHeadings.map((heading) => (
                  <li key={heading.id} className={`source-box__list-item source-box__list-item--depth-${heading.depth}`}>
                    <a href={`#${heading.id}`}>{heading.text}</a>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}
          {hasSourceAttribution ? (
            <aside className="source-box">
              <span className="eyebrow">Verified Source</span>
              <p>
                {post.sourceUrl ? (
                  <a href={post.sourceUrl} target="_blank" rel="noreferrer">
                    {post.sourceName || "Primary source"}
                  </a>
                ) : (
                  post.sourceName
                )}
              </p>
            </aside>
          ) : null}
          {sensitiveSourceNote ? (
            <aside className="source-box source-box--notice">
              <span className="eyebrow">Verification Note</span>
              <p>{sensitiveSourceNote}</p>
            </aside>
          ) : null}
          {articleDisclaimer ? (
            <aside className="source-box source-box--notice">
              <span className="eyebrow">{articleDisclaimer.title}</span>
              <p>{articleDisclaimer.body}</p>
            </aside>
          ) : null}
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{renderedContent}</ReactMarkdown>
          <AdPlaceholder label="Article inline ad slot" variant="inline" />
          <aside className="source-box source-box--author">
            <span className="eyebrow">Author</span>
            <h2>{authorProfile.name}</h2>
            <p>{authorProfile.bio}</p>
          </aside>
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

      <AdPlaceholder label="Sidebar ad slot" variant="sidebar" />
      <AdPlaceholder label="Footer ad slot" variant="footer" />
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


