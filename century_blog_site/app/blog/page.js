import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";
import { getPosts } from "@/lib/posts-store";
import { buildPageMetadata, formatLongDate, sortPostsByRecency } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Blog",
  description: "Browse the latest stories, analysis, explainers, and updates published on Century Blog.",
  path: "/blog",
  keywords: ["Century Blog", "Nigeria blog", "latest stories", "news explainers", "editorial updates"]
});

export default async function BlogPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const page = Math.max(1, Number.parseInt(String(resolvedSearchParams?.page || "1"), 10) || 1);
  const posts = sortPostsByRecency(await getPosts());
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(posts.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visiblePosts = posts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <main className="page-shell">
      <section className="section-card" style={{ maxWidth: "960px", margin: "0 auto" }}>
        <div className="section-header">
          <div>
            <span className="eyebrow">Blog</span>
            <h1>Latest stories from Century Blog</h1>
          </div>
          <p>
            Explore recent news, features, and practical stories published across Nigeria, world,
            business, technology, entertainment, health, lifestyle, education, and daily gist.
          </p>
        </div>

        <div style={{ display: "grid", gap: "1rem" }}>
          {visiblePosts.map((post) => (
            <article key={post.id} className="dashboard-post-card">
              <div className="dashboard-post-card__content">
                <p className="dashboard-post-card__meta">
                  {post.category} | {formatLongDate(post.updatedAt || post.publishedAt)}
                </p>
                <h2 style={{ marginBottom: "0.5rem" }}>
                  <Link href={`/news/${post.slug}`}>{post.title}</Link>
                </h2>
                <p>{post.excerpt}</p>
              </div>
            </article>
          ))}
        </div>
        {posts.length > pageSize ? (
          <div className="pagination-row">
            {currentPage > 1 ? (
              <Link href={currentPage - 1 === 1 ? "/blog" : `/blog?page=${currentPage - 1}`} className="button button-secondary">
                Newer page
              </Link>
            ) : (
              <span className="pagination-row__spacer" />
            )}
            <span className="pagination-row__label">
              Page {currentPage} of {totalPages}
            </span>
            {currentPage < totalPages ? (
              <Link href={`/blog?page=${currentPage + 1}`} className="button button-secondary">
                Older page
              </Link>
            ) : (
              <span className="pagination-row__spacer" />
            )}
          </div>
        ) : null}
      </section>
      <SiteFooter />
    </main>
  );
}
