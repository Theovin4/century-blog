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
  getMostReadPosts,
  getSiteUrl,
  getTopStories,
  isImageMedia,
  isVideoMedia,
  prioritizePosts,
  socialLinks,
  toAbsoluteUrl
} from "@/lib/site";

export const dynamic = "force-dynamic";

function getStoryCardMedia(post) {
  if (isImageMedia(post.mediaUrl, post.mediaType)) {
    return post.mediaUrl;
  }

  if (isVideoMedia(post.mediaUrl, post.mediaType) && post.posterUrl) {
    return post.posterUrl;
  }

  return "";
}

function StoryHighlightCard({ post, meta }) {
  const mediaUrl = getStoryCardMedia(post);

  return (
    <Link
      href={`/news/${post.slug}`}
      className={`mini-post-card ${mediaUrl ? "mini-post-card--with-media" : ""}`}
      style={mediaUrl ? { backgroundImage: `linear-gradient(180deg, rgba(7, 9, 14, 0.14), rgba(7, 9, 14, 0.88)), url(${mediaUrl})` } : undefined}
    >
      <span className="mini-post-card__label">{meta}</span>
      <strong>{post.title}</strong>
      <span>{post.excerpt}</span>
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
  const topStories = getTopStories(visiblePosts, 4);
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
            <div className="brand-mark brand-mark--round">
              <Image
                src="/century-blog-logo.png"
                alt="Century Blog logo"
                width={160}
                height={160}
                priority
                className="brand-mark__image brand-mark__image--round"
              />
            </div>
            <div className="brand-copy">
              <span className="eyebrow eyebrow-brand">Century Blog</span>
              <p className="brand-copy__tag">Lifestyle, Education, Daily gist, Nigeria, World, Sports & Entertainment, Tech, Health And Business</p>
            </div>
          </div>
          <h1>Breaking Nigerian News, Global Stories & Real-Time Updates That Matter</h1>
          <p className="hero-text">
            Stay ahead with trending stories from Nigeria and around the world, from politics and business to tech, health, sports, and entertainment. We deliver fast, reliable, and engaging news designed for readers who want to stay informed, inspired, and ahead of the conversation.
          </p>
          <div className="hero-actions">
            <a href="#latest" className="button button-primary">
              Read Latest News Now
            </a>
            <Link href="/about" className="button button-secondary">
              Learn about us
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

      {topStories.length ? (
        <section className="section-block section-card top-stories-panel">
          <div className="section-header">
            <div>
              <span className="eyebrow">Top Stories Today</span>
              <h2>Big headlines readers are opening first</h2>
            </div>
            <p>The strongest stories on Century Blog right now, selected for freshness, relevance, and visual impact.</p>
          </div>
          <div className="mini-post-grid">
            {topStories.map((post) => (
              <StoryHighlightCard key={post.slug} post={post} meta={getCategoryMeta(post.category).label} />
            ))}
          </div>
        </section>
      ) : null}

      {mostReadPosts.length ? (
        <section className="section-block section-card top-stories-panel">
          <div className="section-header">
            <div>
              <span className="eyebrow">Most Read</span>
              <h2>Stories with the strongest momentum on the site</h2>
            </div>
            <p>These are the stories drawing the most attention right now across the homepage and article pages.</p>
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
            <h2>Fresh stories for your readers</h2>
          </div>
          <p>
            Search across the blog and move from Nigeria headlines into world stories without losing context.
          </p>
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
