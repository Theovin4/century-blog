import Image from "next/image";
import Link from "next/link";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import { FeaturedStoryCarousel } from "@/components/site/FeaturedStoryCarousel";
import { PostFilters } from "@/components/site/PostFilters";
import { PostCard } from "@/components/site/PostCard";
import { NewsTicker } from "@/components/site/NewsTicker";
import { SiteFooter } from "@/components/site/SiteFooter";
import { getPosts } from "@/lib/posts-store";
import {
  buildBreadcrumbJsonLd,
  filterPosts,
  getCategoryMeta,
  getDisplayMedia,
  getMostReadPosts,
  getSiteUrl,
  isImageMedia,
  prioritizePosts,
  socialLinks,
  toAbsoluteUrl
} from "@/lib/site";

export const dynamic = "force-dynamic";

function StoryHighlightCard({ post, meta }) {
  const media = getDisplayMedia(post, "story");

  return (
    <Link
      href={`/news/${post.slug}`}
      className={`mini-post-card ${media.kind !== "none" ? "mini-post-card--with-media" : ""}`}
    >
      {media.kind === "image" ? (
        <img
          src={media.url}
          alt={post.title}
          className="mini-post-card__media"
          loading="lazy"
          decoding="async"
        />
      ) : null}
      {media.kind === "video" ? (
        <video className="mini-post-card__media" muted playsInline preload="metadata" poster={media.posterUrl || undefined}>
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
  const filteredPosts = prioritizePosts(filterPosts(prioritizedPosts, { query }));
  const visiblePosts = filteredPosts.length ? filteredPosts : prioritizedPosts;
  const mostReadPosts = getMostReadPosts(prioritizedPosts, 4);
  const secondaryPosts = visiblePosts.slice(0, 18);
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
        "Century Blog is a Nigeria-first news and culture blog covering breaking Nigerian news, world updates, business, tech, health, sports, and entertainment.",
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
              <p className="brand-copy__tag">Nigeria-first reporting with fast updates on world news, business, sports, lifestyle, tech, and culture.</p>
            </div>
          </div>
          <p className="hero-kicker">Independent digital news platform for readers who want clear updates without clutter.</p>
          <h1>Breaking news, daily gist, and current stories made easier to follow</h1>
          <p className="hero-text">
            Read the latest stories from Nigeria and beyond in a cleaner format built for mobile and desktop. Century Blog brings together timely headlines, explainers, and culture stories in one place.
          </p>
          <div className="hero-highlights" aria-label="Century Blog highlights">
            <span className="hero-highlight">Nigeria and world headlines</span>
            <span className="hero-highlight">Fast-loading reading experience</span>
            <span className="hero-highlight">Business, sports, tech, health, and lifestyle</span>
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

      {prioritizedPosts.length > 1 ? <NewsTicker posts={prioritizedPosts.slice(0, 10)} /> : null}

      <section className="section-block section-card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Browse Sections</span>
            <h2>Follow the topics you care about most</h2>
          </div>
          <p>Move quickly from Nigeria and world headlines into business, tech, entertainment, and health updates.</p>
        </div>
        <PostFilters query={query} category="" action="/" />
      </section>

      {mostReadPosts.length ? (
        <section className="section-block section-card top-stories-panel">
          <div className="section-header">
            <div>
              <span className="eyebrow">Most Read</span>
              <h2>Most read news and trending stories right now</h2>
            </div>
            <p>Catch the biggest stories readers are opening most across Nigeria news, world updates, business, sports, entertainment, and culture.</p>
          </div>
          <div className="mini-post-grid">
            {mostReadPosts.map((post) => (
              <StoryHighlightCard key={post.slug} post={post} meta={`${getCategoryMeta(post.category).label} | Popular`} />
            ))}
          </div>
        </section>
      ) : null}

      <section id="latest" className="section-block">
        <div className="section-header">
          <div>
            <span className="eyebrow">Latest Headlines</span>
            <h2>Latest breaking news and new stories</h2>
          </div>
          <p>Follow the newest breaking news, trending Nigeria headlines, global updates, and timely explainers as soon as they go live.</p>
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

      <section className="newsletter-panel section-card">
        <div>
          <span className="eyebrow">Newsletter</span>
          <h2>Get fresh posts and updates in your inbox</h2>
          <p className="hero-text">
            Join the Century Blog newsletter list for new stories on Nigeria, world news, business, tech, health, sports, and entertainment.
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

