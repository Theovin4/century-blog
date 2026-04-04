import Link from "next/link";
import { notFound } from "next/navigation";
import { PostFilters } from "@/components/site/PostFilters";
import { PostCard } from "@/components/site/PostCard";
import { getPosts } from "@/lib/posts-store";
import { categoryOptions, filterPosts, getCategoryMeta, getSiteUrl, isValidCategory } from "@/lib/site";

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { category } = await params;

  if (!isValidCategory(category)) {
    return { title: "Category Not Found" };
  }

  const meta = getCategoryMeta(category);
  return {
    title: `${meta.label} Posts`,
    description: meta.description,
    alternates: {
      canonical: `/category/${category}`
    }
  };
}

export function generateStaticParams() {
  return categoryOptions.map((category) => ({ category }));
}
export default async function CategoryPage({ params, searchParams }) {
  const { category } = await params;

  if (!isValidCategory(category)) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const query = String(resolvedSearchParams?.q || "").trim();
  const posts = await getPosts();
  const filteredPosts = filterPosts(posts, { query, category });
  const meta = getCategoryMeta(category);
  const siteUrl = getSiteUrl();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${meta.label} | Century Blog`,
    url: `${siteUrl}/category/${category}`,
    description: meta.description
  };

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

      <PostFilters query={query} category={category} />

      <section className="section-block">
        <div className="post-grid">
          {filteredPosts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
        {filteredPosts.length === 0 ? (
          <p className="empty-state">No posts matched this category filter yet.</p>
        ) : null}
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  );
}
