import fs from "node:fs/promises";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AdPlaceholder } from "@/components/site/AdPlaceholder";
import { PostEngagement } from "@/components/site/PostEngagement";
import { PostShareBar } from "@/components/site/PostShareBar";
import { SiteFooter } from "@/components/site/SiteFooter";
import { shouldNoIndexPost } from "@/lib/content-quality";
import { getEngagementBySlug } from "@/lib/engagement-store";
import { getPostBySlug, getPosts } from "@/lib/posts-store";
import {
  getArticleSchemaType,
  getAuthorProfile,
  buildBreadcrumbJsonLd,
  buildPostKeywords,
  extractMentionedCountries,
  formatLongDate,
  getCategoryMeta,
  getDisplayMedia,
  getOptimizedImageUrl,
  getProxiedImageUrl,
  getRenderableContent,
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
  const noIndex = shouldNoIndexPost(post);
  const articleUrl = `${siteUrl}/news/${post.slug}`;
  const defaultImage = `${siteUrl}/century-blog-logo.png`;
  const metadata = {
    title: post.seoTitle || post.title,
    description: post.metaDescription || post.excerpt,
    keywords: buildPostKeywords(post),
    authors: [{ name: post.author || "Century Blog Editorial Team" }],
    category: getCategoryMeta(post.category).label,
    alternates: {
      canonical: articleUrl
    },
    openGraph: {
      title: post.title,
      description: post.metaDescription || post.excerpt,
      url: articleUrl,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt || post.publishedAt,
      section: getCategoryMeta(post.category).label,
      authors: [post.author || "Century Blog Editorial Team"],
      tags: countries,
      images: [{ url: defaultImage, alt: post.imageAlt || post.title }]
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.metaDescription || post.excerpt,
      images: [defaultImage]
    },
    robots: noIndex
      ? {
          index: false,
          follow: true,
          googleBot: {
            index: false,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1
          }
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1
          }
        }
  };

  if (isImageMedia(post.mediaUrl, post.mediaType)) {
    const imageUrl = toAbsoluteUrl(post.mediaUrl);
    metadata.openGraph.images = [{ url: imageUrl, alt: post.imageAlt || post.title }];
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
  const articleSchemaType = getArticleSchemaType(post);
  const updatedLabel = post.updatedAt && post.updatedAt !== post.publishedAt ? formatLongDate(post.updatedAt) : "";
  const sourceLinks = Array.isArray(post.sourceLinks) ? post.sourceLinks.filter((item) => item?.url) : [];
  const hasSourceAttribution = Boolean(post.sourceName || post.sourceUrl || sourceLinks.length);
  const internalLinkTargets = [
    {
      href: `/category/${post.category}`,
      label: `More in ${categoryMeta.label}`,
      description: categoryMeta.description
    },
    {
      href: "/blog",
      label: "Browse the latest stories",
      description: "See the newest published stories across Century Blog in one place."
    },
    ...relatedPosts.slice(0, 2).map((relatedPost) => ({
      href: `/news/${relatedPost.slug}`,
      label: relatedPost.title,
      description: relatedPost.excerpt
    }))
  ].filter((item, index, items) => items.findIndex((candidate) => candidate.href === item.href) === index);
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
        <Image
          className="blog-content__image"
          src={displaySrc}
          alt={alt || post.title}
          width={1400}
          height={900}
          sizes="(max-width: 768px) 100vw, 760px"
          unoptimized={String(displaySrc || "").startsWith("data:")}
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
          <Image
            className="blog-content__image"
            src={displaySrc}
            alt={post.title}
            width={1400}
            height={900}
            sizes="(max-width: 768px) 100vw, 760px"
            unoptimized={String(displaySrc || "").startsWith("data:")}
            referrerPolicy="no-referrer"
          />
        );
      }

      return (
        <a
          href={!isExternal && resolvedHref.startsWith(siteUrl) ? resolvedHref.slice(siteUrl.length) || "/" : resolvedHref || href}
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

  const citations = [
    ...(post.sourceUrl ? [post.sourceUrl] : []),
    ...sourceLinks.map((item) => item.url)
  ];

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
      citation: citations.length ? citations : undefined
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
              <Image
                className="article-media"
                src={articleMedia.url}
                alt={post.imageAlt || post.title}
                width={1600}
                height={1100}
                sizes="(max-width: 900px) 100vw, 760px"
                priority
                unoptimized={String(articleMedia.url || "").startsWith("data:")}
              />
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
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{renderedContent}</ReactMarkdown>
          {hasSourceAttribution ? (
            <aside className="source-box source-box--sources">
              <span className="eyebrow">Sources</span>
              <p>
                {post.sourceUrl ? (
                  <a href={post.sourceUrl} target="_blank" rel="noreferrer">
                    {post.sourceName || "Primary source"}
                  </a>
                ) : (
                  post.sourceName
                )}
              </p>
              {sourceLinks.length ? (
                <ul className="source-box__list">
                  {sourceLinks.map((item) => (
                    <li key={`${item.url}-${item.label || "source"}`} className="source-box__list-item">
                      <a href={item.url} target="_blank" rel="noreferrer">
                        {item.label || item.url}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </aside>
          ) : null}
          {internalLinkTargets.length ? (
            <aside className="source-box source-box--internal">
              <span className="eyebrow">Continue Reading</span>
              <ul className="source-box__list">
                {internalLinkTargets.map((item) => (
                  <li key={`footer-${item.href}`} className="source-box__list-item">
                    <Link href={item.href}>{item.label}</Link>
                    {item.description ? <span>{item.description}</span> : null}
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}
          <AdPlaceholder label="Article inline ad slot" variant="inline" />
          <p className="article-author-line">Author: {authorProfile.name}</p>
        </div>
      </article>

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


