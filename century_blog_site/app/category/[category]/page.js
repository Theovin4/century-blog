import Link from "next/link";
import { notFound } from "next/navigation";
import { PostFilters } from "@/components/site/PostFilters";
import { PostCard } from "@/components/site/PostCard";
import { SiteFooter } from "@/components/site/SiteFooter";
import { getPosts } from "@/lib/posts-store";
import {
  buildBreadcrumbJsonLd,
  buildCategoryKeywords,
  categoryOptions,
  filterPosts,
  getActiveCategories,
  getCategoryMeta,
  getSiteUrl,
  isValidCategory,
  prioritizePosts
} from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { category } = await params;

  if (!isValidCategory(category)) {
    return { title: "Category Not Found" };
  }

  const meta = getCategoryMeta(category);
  const siteUrl = getSiteUrl();
  const canonical = `${siteUrl}/category/${category}`;

  return {
    title: `${meta.label} Posts`,
    description: meta.description,
    keywords: buildCategoryKeywords(category),
    alternates: {
      canonical: `/category/${category}`
    },
    openGraph: {
      title: `${meta.label} | Century Blog`,
      description: meta.description,
      url: canonical,
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title: `${meta.label} | Century Blog`,
      description: meta.description
    }
  };
}

export async function generateStaticParams() {
  const posts = await getPosts();
  return getActiveCategories(posts).map((category) => ({ category }));
}

export default async function CategoryPage({ params, searchParams }) {
  const { category } = await params;

  if (!isValidCategory(category)) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const query = String(resolvedSearchParams?.q || "").trim();
  const posts = await getPosts();
  const activeCategories = getActiveCategories(posts);

  if (!activeCategories.includes(category)) {
    notFound();
  }

  const filteredPosts = prioritizePosts(filterPosts(posts, { query, category }));
  const meta = getCategoryMeta(category);
  const siteUrl = getSiteUrl();

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${meta.label} | Century Blog`,
      url: `${siteUrl}/category/${category}`,
      description: meta.description
    },
    buildBreadcrumbJsonLd([
      { name: "Home", url: siteUrl },
      { name: meta.label, url: `${siteUrl}/category/${category}` }
    ])
  ];

  return (
    <main className="page-shell">
      <section className="section-block section-card">
        <Link href="/" className="back-home-button">
          Back to Home
        </Link>
        <span className="eyebrow">Category</span>
        <h1 className="category-page__title">{meta.label}</h1>
        <p className="hero-text">{meta.description}</p>
      </section>

      <PostFilters query={query} category={category} action={`/category/${category}`} categories={activeCategories} />

      <section className="section-block">
        <div className="post-grid">
          {filteredPosts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      </section>

      <SiteFooter />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  );
}
