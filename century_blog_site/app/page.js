import Image from "next/image";
import Link from "next/link";
import { PostCard } from "@/components/site/PostCard";
import { NewsTicker } from "@/components/site/NewsTicker";
import { getPosts } from "@/lib/posts-store";
import { formatLongDate, getCategoryMeta, getSiteUrl } from "@/lib/site";

export const revalidate = 300;

export default async function HomePage() {
  const posts = await getPosts();
  const featuredPost = posts.find((post) => post.featured) || posts[0];
  const secondaryPosts = posts.filter((post) => post.slug !== featuredPost?.slug);
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
        target: `${siteUrl}/news/{search_term_string}`,
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
      blogPost: posts.slice(0, 3).map((post) => ({
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
            reading experience designed for readers, not admin promotion.
          </p>
          <div className="hero-actions">
            <a href="#latest" className="button button-primary">
              Explore latest posts
            </a>
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
            </article>
          );
        })}
      </section>

      <section id="latest" className="section-block">
        <div className="section-header">
          <div>
            <span className="eyebrow">Trending in Nigeria</span>
            <h2>Fresh stories for your readers</h2>
          </div>
          <p>
            These stories are wired into the content layer so the homepage stays current and easy
            to browse.
          </p>
        </div>

        <div className="post-grid">
          {secondaryPosts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
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
