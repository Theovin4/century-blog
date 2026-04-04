import Image from "next/image";
import Link from "next/link";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import { PostFilters } from "@/components/site/PostFilters";
import { PostCard } from "@/components/site/PostCard";
import { NewsTicker } from "@/components/site/NewsTicker";
import { getPosts } from "@/lib/posts-store";
import { filterPosts, formatLongDate, getCategoryMeta, getSiteUrl } from "@/lib/site";

export const revalidate = 300;

export default async function HomePage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const query = String(resolvedSearchParams?.q || "").trim();
  const posts = await getPosts();
  const filteredPosts = filterPosts(posts, { query });
  const featuredPost = filteredPosts.find((post) => post.featured) || filteredPosts[0] || posts[0];
  const secondaryPosts = filteredPosts.filter((post) => post.slug !== featuredPost?.slug);
  const siteUrl = getSiteUrl();

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Century Blog",
      url: siteUrl,
      logo: `${siteUrl}/century-blog-logo.png`
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
        "Century Blog is a Nigerian blog focused on lifestyle, health, education, and daily gist.",
      url: siteUrl,
      inLanguage: "en-NG",
      blogPost: posts.slice(0, 8).map((post) => ({
        "@type": "BlogPosting",
        headline: post.title,
        datePublished: post.publishedAt,
        image: post.mediaUrl ? [`${siteUrl}${post.mediaUrl}`] : undefined,
        author: {
          "@type": "Organization",
          name: "Century Blog"
        },
        url: `${siteUrl}/news/${post.slug}`
      }))
    }
  ];

  const featuredHasImage = featuredPost?.mediaUrl && featuredPost.mediaType?.startsWith("image/");

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
              <p className="brand-copy__tag">Lifestyle, health, education and daily gist</p>
            </div>
          </div>
          <h1>
            Dark, sharp, and built for the stories Nigerians are actually talking about.
          </h1>
          <p className="hero-text">
            A dynamic blog covering lifestyle, health, education, and daily gist with a polished
            reading experience designed for discovery, search, and daily return visits.
          </p>
          <div className="hero-actions">
            <a href="#latest" className="button button-primary">
              Explore latest posts
            </a>
            <Link href="/about" className="button button-secondary">
              Learn about us
            </Link>
          </div>
        </div>

        {featuredPost ? (
          <article className={`feature-card ${featuredPost.coverStyle}`}>
            {featuredHasImage ? (
              <Image
                src={featuredPost.mediaUrl}
                alt={featuredPost.title}
                fill
                priority
                sizes="(max-width: 980px) 100vw, 50vw"
                className="feature-card__image"
              />
            ) : null}
            <div className="feature-card__inner">
              <span className="pill">{getCategoryMeta(featuredPost.category).label}</span>
              <p className="muted">
                {formatLongDate(featuredPost.publishedAt)} | {featuredPost.readTime}
              </p>
              <h2>{featuredPost.title}</h2>
              <p>{featuredPost.excerpt}</p>
              <Link href={`/news/${featuredPost.slug}`} className="text-link">
                Read full story
              </Link>
            </div>
          </article>
        ) : null}
      </section>

      <NewsTicker posts={posts} />

      <section className="category-strip">
        {["lifestyle", "health", "education", "daily-gist"].map((category) => {
          const meta = getCategoryMeta(category);
          return (
            <article key={category} className="category-card">
              <span className="category-card__accent" style={{ background: meta.accent }} />
              <h3>{meta.label}</h3>
              <p>{meta.description}</p>
              <Link href={`/category/${category}`} className="text-link">
                Browse {meta.label}
              </Link>
            </article>
          );
        })}
      </section>

      <PostFilters query={query} category="" />

      <section id="latest" className="section-block">
        <div className="section-header">
          <div>
            <span className="eyebrow">Trending in Nigeria</span>
            <h2>Fresh stories for your readers</h2>
          </div>
          <p>
            Search across the blog or jump into category pages to find the stories readers care
            about most.
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
            Join the Century Blog newsletter list for new stories on lifestyle, health, education,
            and daily gist.
          </p>
        </div>
        <NewsletterForm />
      </section>

      <section className="footer-links">
        <Link href="/about">About</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/privacy-policy">Privacy Policy</Link>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  );
}
