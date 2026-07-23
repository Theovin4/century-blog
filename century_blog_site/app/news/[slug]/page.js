import fs from "node:fs/promises";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AdPlaceholder } from "@/components/site/AdPlaceholder";
import { AudienceGrowthPanel } from "@/components/site/AudienceGrowthPanel";
import { PostEngagement } from "@/components/site/PostEngagement";
import { PostShareBar } from "@/components/site/PostShareBar";
import { SiteFooter } from "@/components/site/SiteFooter";
import { filterIndexablePosts, getIndexingAssessment, shouldNoIndexPost } from "@/lib/content-quality";
import { getPostBySlug, getPostSummaries } from "@/lib/posts-store";
import {
  extractMarkdownHeadings,
  getArticleSchemaType,
  getArticleDisclaimer,
  getAuthorProfile,
  buildBreadcrumbJsonLd,
  buildPostKeywords,
  extractMentionedCountries,
  formatLongDate,
  getCategoryMeta,
  getDisplayMedia,
  getRelatedPosts,
  getSensitiveSourceNote,
  getOptimizedImageUrl,
  getProxiedImageUrl,
  getRenderableContent,
  getSiteUrl,
  isImageMedia,
  normalizeMarkdownContent,
  normalizeStoredText,
  sortPostsByRecency,
  slugify,
  toAbsoluteUrl
} from "@/lib/site";

export const revalidate = 900;
const STATIC_NEWS_PRERENDER_LIMIT = 24;

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

function buildHeadingIds(headings) {
  const seen = new Map();

  return headings.map((heading) => {
    const baseId = slugify(heading.text || "section") || "section";
    const count = (seen.get(baseId) || 0) + 1;
    seen.set(baseId, count);

    return {
      ...heading,
      id: count === 1 ? baseId : `${baseId}-${count}`
    };
  });
}

function extractFaqItemsFromContent(content) {
  const lines = String(content || "").split("\n");
  const items = [];
  let insideFaq = false;
  let currentQuestion = "";
  let currentAnswer = [];

  const flush = () => {
    if (!currentQuestion || !currentAnswer.length) {
      return;
    }

    items.push({
      question: currentQuestion.trim(),
      answer: currentAnswer.join(" ").replace(/\s+/g, " ").trim()
    });
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^##\s+(Frequently asked questions|FAQ)\s*$/i.test(trimmed)) {
      insideFaq = true;
      continue;
    }

    if (insideFaq && /^##\s+/.test(trimmed)) {
      flush();
      break;
    }

    if (!insideFaq) {
      continue;
    }

    const match = /^###\s+(.+?)\s*$/.exec(trimmed);

    if (match) {
      flush();
      currentQuestion = match[1];
      currentAnswer = [];
      continue;
    }

    if (trimmed && currentQuestion) {
      currentAnswer.push(trimmed.replace(/^[-*]\s+/, ""));
    }
  }

  flush();
  return items.filter((item) => item.question && item.answer).slice(0, 10);
}

function buildFallbackWhyItMatters(post, categoryMeta) {
  const title = String(post?.title || "this story").trim();

  switch (post?.category) {
    case "business":
      return `${title} matters because business and policy developments usually reach readers through prices, confidence, jobs, transport costs, and everyday financial decisions. The most useful reading is the one that separates the first headline from the practical effect on households and businesses.`;
    case "sports":
      return `${title} matters because major sports stories rarely stay confined to a single match or quote. They often influence fan expectations, club momentum, tournament narratives, and the wider culture of how the sport is followed in Nigeria and beyond.`;
    case "tech":
      return `${title} matters because technology stories become meaningful only when readers understand adoption, access, regulation, and who benefits in practice. That bigger context is what turns a product update or platform shift into something genuinely relevant.`;
    case "health":
      return `${title} matters because health coverage shapes how readers understand risk, daily habits, and official guidance. A useful interpretation focuses on practical implications, what is confirmed, and what readers should treat with caution.`;
    case "nigeria":
      return `${title} matters because Nigeria stories often affect public trust, institutional credibility, and the way readers interpret wider national decisions. The deeper value comes from understanding what may change after the first burst of reaction.`;
    case "world":
      return `${title} matters because international developments can shape diplomacy, markets, migration, security, or public opinion far beyond the country where the story began. That broader lens helps readers understand why the headline deserves attention locally too.`;
    default:
      return `${title} matters because ${categoryMeta.label.toLowerCase()} stories become more useful when they explain consequences, context, and what readers should watch after the initial headline.`;
  }
}

function buildFallbackWhatNext(post) {
  const title = String(post?.title || "this story").trim();

  return `The next meaningful updates around ${title} will usually come from official statements, confirmed follow-up reporting, and the practical response of the people or institutions involved. Readers should watch for what changes after the first reactions, not just the first reactions themselves.`;
}

function buildFallbackFaqItems(post, relatedPosts, hasSources) {
  const categoryLabel = getCategoryMeta(post.category).label;
  const sourceLabel = hasSources ? "Yes. Source links or source details are shown on this page." : "Not yet. This page currently relies on the published article body and available editorial context.";

  return [
    {
      question: `What is this ${categoryLabel.toLowerCase()} article about?`,
      answer: post.excerpt || post.title
    },
    {
      question: "Why does this story matter?",
      answer: buildFallbackWhyItMatters(post, getCategoryMeta(post.category))
    },
    {
      question: "When was this article published or updated?",
      answer: `It was published on ${formatLongDate(post.publishedAt)}${post.updatedAt && post.updatedAt !== post.publishedAt ? ` and last updated on ${formatLongDate(post.updatedAt)}` : ""}.`
    },
    {
      question: "Does this page include source references?",
      answer: sourceLabel
    },
    {
      question: "Where can readers find related Century Blog coverage?",
      answer: relatedPosts.length
        ? `Readers can continue with related coverage in the same topic area, including ${relatedPosts.slice(0, 2).map((item) => item.title).join(" and ")}.`
        : `Readers can continue with related coverage through the ${categoryLabel} section and the Century Blog homepage.`
    }
  ];
}

export async function generateStaticParams() {
  const posts = sortPostsByRecency(filterIndexablePosts(await getPostSummaries().catch(() => [])))
    .slice(0, STATIC_NEWS_PRERENDER_LIMIT);
  return posts.map((post) => ({ slug: post.slug }));
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
  const socialImage = isImageMedia(post.mediaUrl, post.mediaType)
    ? toAbsoluteUrl(post.mediaUrl)
    : post.posterUrl
      ? toAbsoluteUrl(post.posterUrl)
      : defaultImage;
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
      images: [{ url: socialImage, alt: post.imageAlt || post.title }]
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.metaDescription || post.excerpt,
      images: [socialImage]
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

  return metadata;
}

export default async function PostPage({ params }) {
  const { slug } = await params;
  const post = await getPostForSlug(slug);

  if (!post) {
    notFound();
  }
  const engagement = { slug, likes: 0, comments: [] };

  const allPosts = await getPostSummaries();
  const indexablePosts = filterIndexablePosts(allPosts);
  const currentCountries = extractMentionedCountries(`${post.title} ${post.excerpt} ${post.content}`);
  const relatedPosts = getRelatedPosts(indexablePosts, post, 4);
  const moreFromTopicPosts = indexablePosts
    .filter((candidate) => candidate.slug !== post.slug && candidate.category === post.category)
    .slice(0, 4);
  const siteUrl = getSiteUrl();
  const organizationId = `${siteUrl}#organization`;
  const categoryMeta = getCategoryMeta(post.category);
  const articleMedia = getDisplayMedia(post, "article");
  const renderedContent = getRenderableContent(post);
  const indexingAssessment = getIndexingAssessment(post);
  const articleUrl = `${siteUrl}/news/${post.slug}`;
  const imageUrls = isImageMedia(post.mediaUrl, post.mediaType) ? [toAbsoluteUrl(post.mediaUrl)] : undefined;
  const authorProfile = getAuthorProfile(post.author);
  const articleSchemaType = getArticleSchemaType(post);
  const updatedLabel = post.updatedAt && post.updatedAt !== post.publishedAt ? formatLongDate(post.updatedAt) : "";
  const sourceLinks = Array.isArray(post.sourceLinks) ? post.sourceLinks.filter((item) => item?.url) : [];
  const hasSourceAttribution = Boolean(post.sourceName || post.sourceUrl || sourceLinks.length);
  const articleDisclaimer = getArticleDisclaimer(post);
  const sensitiveSourceNote = getSensitiveSourceNote(post);
  const fallbackWhyItMatters = buildFallbackWhyItMatters(post, categoryMeta);
  const fallbackWhatNext = buildFallbackWhatNext(post);
  const rawHeadings = extractMarkdownHeadings(renderedContent);
  const tocItems = buildHeadingIds(rawHeadings);
  const parsedFaqItems = extractFaqItemsFromContent(renderedContent);
  const fallbackFaqItems = buildFallbackFaqItems(post, relatedPosts, hasSourceAttribution);
  const faqItems = (parsedFaqItems.length ? parsedFaqItems : fallbackFaqItems).slice(0, 8);
  const showFallbackWhyItMatters = !/##\s+Why this story matters/im.test(renderedContent);
  const showFallbackWhatNext = !/##\s+(What readers should watch next|What happens next)/im.test(renderedContent);
  const showFallbackFaq = !parsedFaqItems.length;
  const shouldShowToc = tocItems.length >= 4 && indexingAssessment.wordCount >= 1200;
  const internalLinkTargets = [
    {
      href: "/",
      label: "Century Blog homepage",
      description: "Go back to the main homepage for the latest major stories."
    },
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
    ...relatedPosts.map((relatedPost) => ({
      href: `/news/${relatedPost.slug}`,
      label: relatedPost.title,
      description: relatedPost.excerpt
    })),
    ...moreFromTopicPosts.map((relatedPost) => ({
      href: `/news/${relatedPost.slug}`,
      label: relatedPost.title,
      description: relatedPost.excerpt
    }))
  ]
    .filter((item, index, items) => items.findIndex((candidate) => candidate.href === item.href) === index)
    .slice(0, 8);
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
      const childText = getNodeText(children);
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
      wordCount: indexingAssessment.wordCount,
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
    faqItems.length ? {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer
        }
      }))
    } : null,
    buildBreadcrumbJsonLd([
      { name: "Home", url: siteUrl },
      { name: categoryMeta.label, url: `${siteUrl}/category/${post.category}` },
      { name: post.title, url: `${siteUrl}/news/${post.slug}` }
    ])
  ].filter(Boolean);

  return (
    <main className="page-shell article-shell">
      <article className="article">
        <div className={`article-hero ${post.coverStyle}`}>
          <nav className="article-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span>/</span>
            <Link href={`/category/${post.category}`}>{categoryMeta.label}</Link>
            <span>/</span>
            <span aria-current="page">{post.title}</span>
          </nav>
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
          {showFallbackWhyItMatters ? (
            <section className="source-box source-box--context">
              <span className="eyebrow">Why This Matters</span>
              <p>{fallbackWhyItMatters}</p>
            </section>
          ) : null}
          {showFallbackWhatNext ? (
            <section className="source-box source-box--context">
              <span className="eyebrow">What Happens Next</span>
              <p>{fallbackWhatNext}</p>
            </section>
          ) : null}
          {showFallbackFaq ? (
            <section className="source-box source-box--faq">
              <span className="eyebrow">FAQ</span>
              <div className="article-faq">
                {faqItems.map((item) => (
                  <div key={item.question} className="article-faq__item">
                    <h2>{item.question}</h2>
                    <p>{item.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {shouldShowToc ? (
            <aside className="source-box source-box--toc">
              <span className="eyebrow">Table of Contents</span>
              <ul className="source-box__list">
                {tocItems.map((item) => (
                  <li key={`toc-${item.id}`} className="source-box__list-item">
                    <a href={`#${item.id}`}>{item.text}</a>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}
          {hasSourceAttribution || articleDisclaimer || sensitiveSourceNote ? (
            <aside className="source-box source-box--sources">
              <span className="eyebrow">Sources and verification</span>
              {articleDisclaimer ? (
                <p className="article-inline-note">
                  <strong>{articleDisclaimer.title}:</strong> {articleDisclaimer.body}
                </p>
              ) : null}
              {sensitiveSourceNote ? <p className="article-inline-note">{sensitiveSourceNote}</p> : null}
              {hasSourceAttribution ? (
                <p>
                  {post.sourceUrl ? (
                    <a href={post.sourceUrl} target="_blank" rel="noreferrer">
                      {post.sourceName || "Primary source"}
                    </a>
                  ) : (
                    post.sourceName
                  )}
                </p>
              ) : (
                <p>Source details are still being reviewed for this article. Readers should rely on official updates and verified references where available.</p>
              )}
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
              <p>Continue with related Century Blog stories, topic pages, and the strongest follow-up coverage connected to this article.</p>
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
      <AudienceGrowthPanel
        eyebrow="Stay With The Story"
        title="Get the next important update before it disappears from the timeline"
        description={`Use the Century Briefing for selected coverage across ${categoryMeta.label.toLowerCase()} and the rest of Century Blog, then continue with stronger follow-up reporting in this topic area.`}
        actions={[
          { href: `/category/${post.category}`, label: `More in ${categoryMeta.label}` },
          internalLinkTargets[2]
            ? { href: internalLinkTargets[2].href, label: "Read another related story", variant: "secondary" }
            : { href: "/blog", label: "Browse latest coverage", variant: "secondary" },
          { href: "/blog", label: "Open the full archive", variant: "secondary" }
        ]}
        note="Century Blog focuses on readable follow-up reporting, practical context, and cleaner article journeys for readers on mobile and desktop."
      />
      <SiteFooter showSocial={false} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  );
}


