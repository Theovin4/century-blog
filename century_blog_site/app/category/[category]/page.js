import Link from "next/link";
import { notFound } from "next/navigation";
import { AudienceGrowthPanel } from "@/components/site/AudienceGrowthPanel";
import { PostFilters } from "@/components/site/PostFilters";
import { PostCard } from "@/components/site/PostCard";
import { SiteFooter } from "@/components/site/SiteFooter";
import { filterIndexablePosts } from "@/lib/content-quality";
import { getPostSummaries } from "@/lib/posts-store";
import {
  getActiveCategories,
  buildBreadcrumbJsonLd,
  buildCategoryKeywords,
  filterPosts,
  getCategoryMeta,
  getSiteUrl,
  isValidCategory,
  sortPostsByRecency
} from "@/lib/site";

export const revalidate = 900;

export async function generateMetadata({ params }) {
  const { category } = await params;

  if (!isValidCategory(category)) {
    return { title: "Category Not Found" };
  }

  const posts = filterIndexablePosts(await getPostSummaries());
  const activeCategories = getActiveCategories(posts);

  if (!activeCategories.includes(category)) {
    return { title: "Category Not Found" };
  }

  const meta = getCategoryMeta(category);
  const siteUrl = getSiteUrl();
  const canonical = `${siteUrl}/category/${category}`;
  const defaultImage = `${siteUrl}/century-blog-logo.png`;

  return {
    title: `${meta.label} News and Stories`,
    description: meta.description,
    keywords: buildCategoryKeywords(category),
    alternates: {
      canonical
    },
    openGraph: {
      title: `${meta.label} | Century Blog`,
      description: meta.description,
      url: canonical,
      type: "website",
      images: [{ url: defaultImage, alt: "Century Blog logo" }]
    },
    twitter: {
      card: "summary_large_image",
      title: `${meta.label} | Century Blog`,
      description: meta.description,
      images: [defaultImage]
    }
  };
}

export async function generateStaticParams() {
  const posts = filterIndexablePosts(await getPostSummaries());
  return getActiveCategories(posts).map((category) => ({ category }));
}

export default async function CategoryPage({ params, searchParams }) {
  const { category } = await params;

  if (!isValidCategory(category)) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const query = String(resolvedSearchParams?.q || "").trim();
  const page = Math.max(1, Number.parseInt(String(resolvedSearchParams?.page || "1"), 10) || 1);
  const posts = filterIndexablePosts(await getPostSummaries());
  const activeCategories = getActiveCategories(posts);

  if (!activeCategories.includes(category)) {
    notFound();
  }

  const filteredPosts = sortPostsByRecency(filterPosts(posts, { query, category }));
  const meta = getCategoryMeta(category);
  const siteUrl = getSiteUrl();
  const featuredPosts = filteredPosts.slice(0, 3);
  const listPosts = filteredPosts.slice(featuredPosts.length);
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(listPosts.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedPosts = listPosts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const structuredPosts = currentPage === 1 ? [...featuredPosts, ...paginatedPosts] : paginatedPosts;
  const buildPageHref = (nextPage) => {
    const search = new URLSearchParams();

    if (query) {
      search.set("q", query);
    }

    if (nextPage > 1) {
      search.set("page", String(nextPage));
    }

    const suffix = search.toString();
    return suffix ? `/category/${category}?${suffix}` : `/category/${category}`;
  };

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${meta.label} | Century Blog`,
      url: `${siteUrl}/category/${category}`,
      description: meta.description
    },
    structuredPosts.length ? {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: structuredPosts.map((post, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${siteUrl}/news/${post.slug}`,
        name: post.title
      }))
    } : null,
    buildBreadcrumbJsonLd([
      { name: "Home", url: siteUrl },
      { name: meta.label, url: `${siteUrl}/category/${category}` }
    ])
  ].filter(Boolean);

  return (
    <main className="page-shell">
      <section className="section-block section-card">
        <Link href="/" className="back-home-button">
          Back to Home
        </Link>
        <span className="eyebrow">Category</span>
        <h1 className="category-page__title">{meta.label}</h1>
        <p className="hero-text">
          {meta.description} Explore recent Century Blog reporting, analysis, and practical context across {meta.label.toLowerCase()} stories in one organised archive.
        </p>
        <div className="category-summary-grid">
          <div className="category-summary-card">
            <span className="pill">Coverage</span>
            <p>{filteredPosts.length} indexable stories are currently available in this section.</p>
          </div>
          <div className="category-summary-card">
            <span className="pill">Browse</span>
            <p>Use the filters below to refine recent stories without leaving the public category archive.</p>
          </div>
          <div className="category-summary-card">
            <span className="pill">Latest</span>
            <p>Fresh articles are shown in clean publishing order so readers and search engines can find the newest strong coverage quickly.</p>
          </div>
        </div>
      </section>

      <PostFilters
        query={query}
        category={category}
        action={`/category/${category}`}
        categories={activeCategories}
      />

      {featuredPosts.length ? (
        <section className="section-block section-card top-stories-panel">
          <div className="section-header">
            <div>
              <span className="eyebrow">Top Stories</span>
              <h2>Featured coverage in {meta.label}</h2>
            </div>
            <p>These are the most valuable stories currently leading this section.</p>
          </div>
          <div className="article-related__links">
            {featuredPosts.map((post) => (
              <Link key={`featured-${post.slug}`} href={`/news/${post.slug}`} className="article-related__item">
                <strong>{post.title}</strong>
                <span>{post.excerpt}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="section-block">
        <div className="post-grid">
          {paginatedPosts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
        {filteredPosts.length === 0 ? (
          <p className="empty-state">No posts matched this category filter yet.</p>
        ) : null}
        {!paginatedPosts.length && featuredPosts.length ? (
          <p className="empty-state">This section is currently led by the featured stories above.</p>
        ) : null}
        {listPosts.length > pageSize ? (
          <div className="pagination-row">
            {currentPage > 1 ? (
              <Link href={buildPageHref(currentPage - 1)} className="button button-secondary">
                Newer page
              </Link>
            ) : (
              <span className="pagination-row__spacer" />
            )}
            <span className="pagination-row__label">
              Page {currentPage} of {totalPages}
            </span>
            {currentPage < totalPages ? (
              <Link href={buildPageHref(currentPage + 1)} className="button button-secondary">
                Older page
              </Link>
            ) : (
              <span className="pagination-row__spacer" />
            )}
          </div>
        ) : null}
      </section>

      <AudienceGrowthPanel
        eyebrow={`${meta.label} Updates`}
        title={`Stay on top of ${meta.label.toLowerCase()} stories without checking back all day`}
        description={`Use the Century Briefing to follow stronger ${meta.label.toLowerCase()} coverage, then move into related reporting through the main blog archive and today's homepage headlines.`}
        actions={[
          featuredPosts[0]
            ? { href: `/news/${featuredPosts[0].slug}`, label: "Read the lead story" }
            : { href: "/", label: "See home headlines" },
          { href: "/blog", label: "Browse latest coverage", variant: "secondary" },
          { href: "/", label: "Return to homepage", variant: "secondary" }
        ]}
        note={`This section is organised to help readers and search engines find stronger ${meta.label.toLowerCase()} coverage quickly.`}
      />

      <SiteFooter />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  );
}
