import Image from "next/image";
import Link from "next/link";
import { AudienceGrowthPanel } from "@/components/site/AudienceGrowthPanel";
import { AdPlaceholder } from "@/components/site/AdPlaceholder";
import { AdSenseScript } from "@/components/site/AdSenseScript";
import { FeaturedStoryCarousel } from "@/components/site/FeaturedStoryCarousel";
import { PostFilters } from "@/components/site/PostFilters";
import { PostCard } from "@/components/site/PostCard";
import { SiteFooter } from "@/components/site/SiteFooter";
import { getPostSummaries } from "@/lib/posts-store";
import {
  getActiveCategories,
  buildPageMetadata,
  buildBreadcrumbJsonLd,
  filterPosts,
  getCategoryMeta,
  getDisplayMedia,
  getMostReadPosts,
  getSiteUrl,
  isImageMedia,
  prioritizePosts,
  sortPostsByRecency,
  socialLinks,
  toAbsoluteUrl
} from "@/lib/site";

export const revalidate = 120;

export const metadata = buildPageMetadata({
  title: "Century Blog",
  description:
    "Breaking Nigeria news, global updates, and stories that matter across business, sports, technology, entertainment, health, lifestyle, and education.",
  path: "/",
  keywords: [
    "Century Blog",
    "Nigeria news",
    "world news",
    "business news",
    "sports news",
    "technology news",
    "entertainment news",
    "lifestyle stories"
  ]
});

function StoryHighlightCard({ post, meta }) {
  const media = getDisplayMedia(post, "story");

  return (
    <Link
      href={`/news/${post.slug}`}
      className={`mini-post-card ${media.kind !== "none" ? "mini-post-card--with-media" : ""}`}
    >
      {media.kind === "image" ? (
        <div className="mini-post-card__media-shell">
          <Image
            src={media.url}
            alt={post.imageAlt || post.title}
            fill
            quality={72}
            sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 25vw"
            className="mini-post-card__media"
            unoptimized={media.generated || String(media.url || "").startsWith("data:")}
          />
        </div>
      ) : null}
      {media.kind === "video" ? (
        <video className="mini-post-card__media" muted playsInline preload="none" poster={media.posterUrl || undefined}>
          <source src={media.url} type={media.type} />
        </video>
      ) : null}
      <div className="mini-post-card__content">
        <span className="mini-post-card__label">{meta}</span>
        <strong>{post.title}</strong>
        <span>{post.excerpt}</span>
      </div>
    </Link>
  );
}

export default async function HomePage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const query = String(resolvedSearchParams?.q || "").trim();
  // Published stories should remain visible to readers even while a separate
  // indexing assessment keeps weaker pages out of search sitemaps.
  const posts = await getPostSummaries();
  const prioritizedPosts = prioritizePosts(posts);
  const recentPosts = sortPostsByRecency(posts);
  const filteredPosts = sortPostsByRecency(filterPosts(recentPosts, { query }));
  const visiblePosts = filteredPosts.length ? filteredPosts : recentPosts;
  const heroPosts = sortPostsByRecency(visiblePosts).slice(0, 5);
  const mostReadPosts = getMostReadPosts(prioritizedPosts, 5);
  const editorPicks = prioritizedPosts.filter((post) => !post.featured).slice(0, 3);
  const secondaryPosts = visiblePosts.slice(0, 18);
  const activeCategories = getActiveCategories(prioritizedPosts);
  const categorySpotlights = activeCategories
    .map((category) => ({
      category,
      meta: getCategoryMeta(category),
      posts: prioritizedPosts.filter((post) => post.category === category).slice(0, 3)
    }))
    .filter((section) => section.posts.length)
    .slice(0, 6);
  const siteUrl = getSiteUrl();

  const breadcrumbLd = buildBreadcrumbJsonLd([{ name: "Home", url: siteUrl }]);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Century Blog",
      url: siteUrl,
      logo: `${siteUrl}/century-blog-logo.png`,
      sameAs: socialLinks.map((link) => link.href)
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Century Blog",
      url: siteUrl,
      inLanguage: "en-NG",
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteUrl}/?q={search_term_string}`,
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "Century Blog",
      description:
        "Century Blog is a Nigeria-first digital publication covering breaking Nigerian news, world updates, business, sports, technology, health, entertainment, lifestyle, education, and daily gist.",
      url: siteUrl,
      inLanguage: "en-NG",
      blogPost: prioritizedPosts.slice(0, 8).map((post) => ({
        "@type": "BlogPosting",
        headline: post.title,
        datePublished: post.publishedAt,
        image: isImageMedia(post.mediaUrl, post.mediaType) ? [toAbsoluteUrl(post.mediaUrl)] : undefined,
        author: {
          "@type": "Organization",
          name: "Century Blog"
        },
        url: `${siteUrl}/news/${post.slug}`
      }))
    },
    breadcrumbLd
  ];

  return (
    <main className="page-shell">
      <AdSenseScript />
      <section className="hero-grid">
        <div className="hero-copy">
          <div className="brand-lockup">
            <div className="brand-mark">
              <Image
                src="/century-blog-logo.png"
                alt="Century Blog logo"
                width={140}
                height={140}
                priority
                className="brand-mark__image"
              />
            </div>
            <div className="brand-copy">
              <span className="eyebrow eyebrow-brand">Century Blog</span>
              <p className="brand-copy__tag">Nigeria-first news and useful global context.</p>
            </div>
          </div>
          <h1>Breaking Nigeria news, global updates, and stories that matter</h1>
          <div className="hero-actions">
            <a href="#latest" className="button button-primary">
              Read latest
            </a>
            <Link href="/about" className="button button-secondary">
              About Century Blog
            </Link>
          </div>
        </div>

        <FeaturedStoryCarousel posts={heroPosts} />
      </section>

      <section className="section-block section-card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Browse Sections</span>
            <h2>Browse by topic</h2>
          </div>
        </div>
        <PostFilters query={query} category="" action="/" categories={activeCategories} />
      </section>

      <section id="latest" className="section-block">
        <div className="section-header">
          <div>
            <span className="eyebrow">Latest Headlines</span>
            <h2>Latest stories</h2>
          </div>
        </div>

        <div className="post-grid">
          {secondaryPosts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
        {secondaryPosts.length === 0 ? (
          <p className="empty-state">No stories found. Try another keyword.</p>
        ) : null}
      </section>

      {mostReadPosts.length ? (
        <section className="section-block section-card top-stories-panel">
          <div className="section-header">
            <div>
              <span className="eyebrow">Most Read</span>
              <h2>Popular with readers</h2>
            </div>
          </div>
          <div className="mini-post-grid">
            {mostReadPosts.map((post) => (
              <StoryHighlightCard key={post.slug} post={post} meta={`${getCategoryMeta(post.category).label} | Popular`} />
            ))}
          </div>
        </section>
      ) : null}

      {editorPicks.length ? (
        <section className="section-block section-card top-stories-panel">
          <div className="section-header">
            <div>
              <span className="eyebrow">Editor&apos;s Picks</span>
              <h2>Selected by our editors</h2>
            </div>
          </div>
          <div className="mini-post-grid">
            {editorPicks.map((post) => (
              <StoryHighlightCard key={post.slug} post={post} meta={`${getCategoryMeta(post.category).label} | Editor&apos;s pick`} />
            ))}
          </div>
        </section>
      ) : null}

      {!query && categorySpotlights.length ? (
        <section className="section-block section-card top-stories-panel">
          <div className="section-header">
            <div>
              <span className="eyebrow">Major Sections</span>
              <h2>Explore more coverage</h2>
            </div>
          </div>
          <div className="category-spotlight-grid">
            {categorySpotlights.map((section) => (
              <section key={section.category} className="category-summary-card">
                <div className="category-summary-card__header">
                  <span className="pill">{section.meta.label}</span>
                  <Link href={`/category/${section.category}`} className="text-link">
                    View section
                  </Link>
                </div>
                <p>{section.meta.description}</p>
                <div className="article-related__links">
                  {section.posts.map((post) => (
                    <Link
                      key={`${section.category}-${post.slug}`}
                      href={`/news/${post.slug}`}
                      className="article-related__item"
                    >
                      <strong>{post.title}</strong>
                      <span>{post.excerpt}</span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      ) : null}

      <AdPlaceholder label="Homepage ad slot" variant="homepage" />

      <AudienceGrowthPanel
        eyebrow="Century Briefing"
        title="News worth opening"
        description="Selected Nigeria headlines, global updates, and useful explainers."
        actions={[
          { href: "/blog", label: "Browse stories" },
          { href: "/category/nigeria", label: "Nigeria", variant: "secondary" },
          { href: "/category/business", label: "Business", variant: "secondary" }
        ]}
        showSocial
      />

      <SiteFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  );
}

