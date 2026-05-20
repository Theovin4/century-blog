import Image from "next/image";
import Link from "next/link";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import { AdPlaceholder } from "@/components/site/AdPlaceholder";
import { FeaturedStoryCarousel } from "@/components/site/FeaturedStoryCarousel";
import { PostFilters } from "@/components/site/PostFilters";
import { PostCard } from "@/components/site/PostCard";
import { SiteFooter } from "@/components/site/SiteFooter";
import { getPosts } from "@/lib/posts-store";
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

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Century Blog",
  description:
    "Century Blog covers Nigeria news, world updates, business, technology, entertainment, health, lifestyle, education, and daily gist in a clear reader-first format.",
  path: "/",
  keywords: [
    "Century Blog",
    "Nigeria news",
    "world news",
    "business news",
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
            alt={post.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 25vw"
            className="mini-post-card__media"
            unoptimized={String(media.url || "").startsWith("data:")}
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
  const posts = await getPosts();
  const prioritizedPosts = prioritizePosts(posts);
  const recentPosts = sortPostsByRecency(posts);
  const filteredPosts = sortPostsByRecency(filterPosts(recentPosts, { query }));
  const visiblePosts = filteredPosts.length ? filteredPosts : recentPosts;
  const mostReadPosts = getMostReadPosts(prioritizedPosts, 5);
  const editorPicks = prioritizedPosts.filter((post) => !post.featured).slice(0, 3);
  const secondaryPosts = visiblePosts.slice(0, 18);
  const activeCategories = getActiveCategories(prioritizedPosts);
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
        "Century Blog is a Nigeria-first digital publication covering breaking Nigerian news, world updates, business, technology, health, entertainment, lifestyle, education, and daily gist.",
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
              <p className="brand-copy__tag">Nigeria-first reporting on world news, business, technology, entertainment, health, lifestyle, and daily gist.</p>
            </div>
          </div>
          <h1>Breaking Nigeria news, global updates, and stories that matter</h1>
          <div className="hero-highlights" aria-label="Century Blog highlights">
            <span className="hero-highlight">Breaking Nigeria and world headlines</span>
            <span className="hero-highlight">Clear business, tech, health, and lifestyle coverage</span>
            <span className="hero-highlight">Fast mobile-friendly reading experience</span>
          </div>
          <div className="hero-actions">
            <a href="#latest" className="button button-primary">
              Read Latest News Now
            </a>
            <Link href="/about" className="button button-secondary">
              About Century Blog
            </Link>
          </div>
        </div>

        <FeaturedStoryCarousel posts={visiblePosts} />
      </section>

      <section className="section-block section-card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Browse Sections</span>
            <h2>Follow the topics you care about most</h2>
          </div>
          <p>Jump straight into the sections readers explore most, from Nigeria headlines and business updates to technology, health, lifestyle, and daily gist.</p>
        </div>
        <PostFilters query={query} category="" action="/" categories={activeCategories} />
      </section>

      <section id="latest" className="section-block">
        <div className="section-header">
          <div>
            <span className="eyebrow">Latest Headlines</span>
            <h2>Latest breaking news and fresh stories</h2>
          </div>
          <p>The newest reports and breaking updates from Nigeria and beyond, shown in true publishing order so readers see the freshest stories first.</p>
        </div>

        <div className="post-grid">
          {secondaryPosts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
        {secondaryPosts.length === 0 ? (
          <p className="empty-state">No posts matched your search yet. Try another keyword.</p>
        ) : null}
      </section>

      {mostReadPosts.length ? (
        <section className="section-block section-card top-stories-panel">
          <div className="section-header">
            <div>
              <span className="eyebrow">Most Read</span>
              <h2>Most read stories on Century Blog right now</h2>
            </div>
            <p>The stories drawing the strongest reader attention across the site, from major developments to useful catch-up pieces.</p>
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
              <h2>Selected stories with stronger context and lasting value</h2>
            </div>
            <p>Handpicked stories worth spending more time on, with sharper reporting, broader context, and clearer reader relevance.</p>
          </div>
          <div className="mini-post-grid">
            {editorPicks.map((post) => (
              <StoryHighlightCard key={post.slug} post={post} meta={`${getCategoryMeta(post.category).label} | Editor&apos;s pick`} />
            ))}
          </div>
        </section>
      ) : null}

      <AdPlaceholder label="Homepage ad slot" variant="homepage" />

      <section className="newsletter-panel section-card">
        <div>
          <span className="eyebrow">Newsletter</span>
          <h2>Get fresh posts and updates in your inbox</h2>
          <p className="hero-text">
            Subscribe for breaking headlines, useful explainers, and selected updates across Nigeria, world news, business, technology, entertainment, lifestyle, health, and education.
          </p>
        </div>
        <NewsletterForm />
      </section>

      <SiteFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  );
}

