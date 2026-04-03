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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Century Blog",
    description:
      "Century Blog is a Nigerian blog focused on lifestyle, health, education, and daily gist.",
    url: getSiteUrl(),
    inLanguage: "en-NG",
    blogPost: posts.slice(0, 3).map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      datePublished: post.publishedAt,
      author: {
        "@type": "Organization",
        name: "Century Blog"
      },
      url: `${getSiteUrl()}/news/${post.slug}`
    }))
  };

  return (
    <main className="page-shell">
      <section className="hero-grid">
        <div className="hero-copy">
          <span className="eyebrow">Century Blog</span>
          <h1>
            Dark, sharp, and built for the stories Nigerians are actually talking about.
          </h1>
          <p className="hero-text">
            A dynamic blog covering lifestyle, health, education, and daily gist with a polished
            reading experience and a dashboard that makes publishing simple.
          </p>
          <div className="hero-actions">
            <Link href="/dashboard" className="button button-primary">
              Open dashboard
            </Link>
            <a href="#latest" className="button button-secondary">
              Explore latest posts
            </a>
          </div>
        </div>

        {featuredPost ? (
          <article className={`feature-card ${featuredPost.coverStyle}`}>
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
            These starter posts are already wired into the CMS data layer, so new posts from the
            dashboard show up here automatically.
          </p>
        </div>

        <div className="post-grid">
          {secondaryPosts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      </section>

      <section className="dashboard-promo">
        <div>
          <span className="eyebrow">Publisher Ready</span>
          <h2>Your admin dashboard is part of the site</h2>
          <p>
            Log in, create a post, choose a category, and publish. The homepage, article page,
            sitemap, and internal links update from the same content source.
          </p>
        </div>
        <Link href="/dashboard" className="button button-primary">
          Manage posts
        </Link>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  );
}
