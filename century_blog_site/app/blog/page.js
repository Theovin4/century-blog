import Link from "next/link";
import { AudienceGrowthPanel } from "@/components/site/AudienceGrowthPanel";
import { SiteFooter } from "@/components/site/SiteFooter";
import { filterIndexablePosts } from "@/lib/content-quality";
import { getPostSummaries } from "@/lib/posts-store";
import { buildPageMetadata, formatLongDate, sortPostsByRecency } from "@/lib/site";

export const revalidate = 900;

export const metadata = buildPageMetadata({
  title: "Blog",
  description: "Browse the latest stories, analysis, explainers, and updates published on Century Blog.",
  path: "/blog",
  keywords: ["Century Blog", "Nigeria blog", "latest stories", "news explainers", "editorial updates"]
});

export default async function BlogPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const page = Math.max(1, Number.parseInt(String(resolvedSearchParams?.page || "1"), 10) || 1);
  const posts = sortPostsByRecency(filterIndexablePosts(await getPostSummaries()));
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
            Explore the stronger public archive of Century Blog stories across Nigeria, world,
            business, sports, technology, entertainment, health, lifestyle, education, and daily gist.
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
        {visiblePosts.length === 0 ? (
          <p className="empty-state">No indexable stories are available in the public archive yet.</p>
        ) : null}
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
      <AudienceGrowthPanel
        eyebrow="Reader Growth"
        title="Follow Century Blog beyond a single visit"
        description="Get the Century Briefing for selected Nigeria and global updates, then keep exploring through the homepage, key sections, and the strongest recent stories."
        actions={[
          { href: "/", label: "Return to homepage" },
          { href: "/category/nigeria", label: "Follow Nigeria stories", variant: "secondary" },
          { href: "/category/sports", label: "Follow sports coverage", variant: "secondary" }
        ]}
        note="This archive is designed for deeper browsing, cleaner catch-up reading, and stronger internal discovery."
        showSocial
      />
      <SiteFooter />
    </main>
  );
}
